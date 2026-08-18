from app.core.constants import Role


def login(client, email, password="Welcome@123"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _setup_course_level(db):
    from app.models.academy import Course, CourseLevel

    course = Course(name="Hip Hop")
    db.add(course)
    db.flush()
    level = CourseLevel(course_id=course.id, name="Beginner")
    db.add(level)
    db.commit()
    return level


def test_batch_list_includes_resolved_names_and_schedule(client, db, make_user, make_branch):
    from app.models.branch import Studio

    branch = make_branch("Batch Branch A", "BBA")
    make_user("admin_batch@test.com", Role.ADMIN, home_branch_id=branch.id)
    trainer = make_user("trainer_batch@test.com", Role.TRAINER, home_branch_id=branch.id)
    studio = Studio(branch_id=branch.id, name="Studio 1")
    db.add(studio)
    db.commit()
    level = _setup_course_level(db)

    headers = login(client, "admin_batch@test.com")
    resp = client.post(
        "/api/v1/batches",
        headers=headers,
        json={
            "name": "Hip Hop Beginners",
            "course_level_id": str(level.id),
            "branch_id": str(branch.id),
            "studio_id": str(studio.id),
            "trainer_id": str(trainer.id),
            "capacity": 10,
            "schedules": [{"day_of_week": 0, "start_time": "18:00:00", "end_time": "19:00:00"}],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["trainer_name"] == trainer.full_name
    assert body["studio_name"] == "Studio 1"
    assert body["branch_name"] == "Batch Branch A"
    assert body["course_name"] == "Hip Hop"
    assert body["level_name"] == "Beginner"
    assert body["available_seats"] == 10
    assert len(body["schedules"]) == 1
    assert body["schedules"][0]["day_of_week"] == 0

    list_resp = client.get("/api/v1/batches", headers=headers)
    assert list_resp.status_code == 200
    assert any(b["id"] == body["id"] for b in list_resp.json())


def test_editing_batch_trainer_checks_for_conflict(client, db, make_user, make_branch):
    branch = make_branch("Batch Branch B", "BBB")
    make_user("admin_conflict@test.com", Role.ADMIN, home_branch_id=branch.id)
    trainer_a = make_user("trainer_a@test.com", Role.TRAINER, home_branch_id=branch.id)
    trainer_b = make_user("trainer_b@test.com", Role.TRAINER, home_branch_id=branch.id)
    level = _setup_course_level(db)

    headers = login(client, "admin_conflict@test.com")

    # Batch 1: trainer A, Monday 18:00-19:00
    resp1 = client.post(
        "/api/v1/batches",
        headers=headers,
        json={
            "name": "Batch One", "course_level_id": str(level.id), "branch_id": str(branch.id),
            "trainer_id": str(trainer_a.id), "capacity": 10,
            "schedules": [{"day_of_week": 0, "start_time": "18:00:00", "end_time": "19:00:00"}],
        },
    )
    assert resp1.status_code == 201, resp1.text

    # Batch 2: trainer B, same Monday slot (different trainer, no conflict at creation)
    resp2 = client.post(
        "/api/v1/batches",
        headers=headers,
        json={
            "name": "Batch Two", "course_level_id": str(level.id), "branch_id": str(branch.id),
            "trainer_id": str(trainer_b.id), "capacity": 10,
            "schedules": [{"day_of_week": 0, "start_time": "18:00:00", "end_time": "19:00:00"}],
        },
    )
    assert resp2.status_code == 201, resp2.text
    batch_two_id = resp2.json()["id"]

    # Now reassign batch 2's trainer to trainer A -> should conflict with batch 1's Monday slot.
    patch_resp = client.patch(
        f"/api/v1/batches/{batch_two_id}", headers=headers, json={"trainer_id": str(trainer_a.id)}
    )
    assert patch_resp.status_code == 409

    # List should reflect the (pre-existing, since patch was rejected) non-conflicting state.
    list_resp = client.get("/api/v1/batches", headers=headers)
    batch_two = next(b for b in list_resp.json() if b["id"] == batch_two_id)
    assert "trainer_conflict" not in batch_two["health"]


def test_batch_availability_and_health_filters(client, db, make_user, make_branch):
    branch = make_branch("Batch Branch C", "BBC")
    make_user("admin_avail@test.com", Role.ADMIN, home_branch_id=branch.id)
    level = _setup_course_level(db)
    headers = login(client, "admin_avail@test.com")

    resp = client.post(
        "/api/v1/batches",
        headers=headers,
        json={"name": "Small Batch", "course_level_id": str(level.id), "branch_id": str(branch.id), "capacity": 1, "schedules": []},
    )
    assert resp.status_code == 201
    batch_id = resp.json()["id"]
    assert resp.json()["available_seats"] == 1

    available = client.get("/api/v1/batches", headers=headers, params={"availability": "available"})
    assert any(b["id"] == batch_id for b in available.json())

    full = client.get("/api/v1/batches", headers=headers, params={"availability": "full"})
    assert not any(b["id"] == batch_id for b in full.json())
