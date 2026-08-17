from app.core.constants import Role


def login(client, email, password="Welcome@123"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_receptionist_cannot_take_attendance(client, db, make_user, make_branch):
    branch = make_branch("Branch A", "BRA")
    make_user("recep@test.com", Role.RECEPTIONIST, home_branch_id=branch.id)

    headers = login(client, "recep@test.com")
    import uuid

    resp = client.get(f"/api/v1/attendance/sessions/{uuid.uuid4()}/roster", headers=headers)
    assert resp.status_code == 403


def test_trainer_cannot_manage_payments(client, db, make_user, make_branch):
    branch = make_branch("Branch B", "BRB")
    make_user("trainer_pay@test.com", Role.TRAINER, home_branch_id=branch.id)

    headers = login(client, "trainer_pay@test.com")
    resp = client.post(
        "/api/v1/payments",
        headers=headers,
        json={"student_id": "00000000-0000-0000-0000-000000000000", "branch_id": str(branch.id), "amount": 100, "method": "cash", "payment_date": "2026-01-01"},
    )
    assert resp.status_code == 403


def test_photographer_cannot_access_students(client, db, make_user, make_branch):
    branch = make_branch("Branch C", "BRC")
    make_user("photo@test.com", Role.PHOTOGRAPHER, home_branch_id=branch.id)

    headers = login(client, "photo@test.com")
    resp = client.get("/api/v1/students", headers=headers)
    assert resp.status_code == 403


def test_only_super_admin_creates_branches(client, db, make_user):
    make_user("admin_branch@test.com", Role.ADMIN)
    headers = login(client, "admin_branch@test.com")
    resp = client.post("/api/v1/branches", headers=headers, json={"name": "New Branch", "code": "NB1"})
    assert resp.status_code == 403

    make_user("super@test.com", Role.SUPER_ADMIN)
    headers = login(client, "super@test.com")
    resp = client.post("/api/v1/branches", headers=headers, json={"name": "New Branch", "code": "NB1"})
    assert resp.status_code == 201


def test_admin_without_branch_access_is_rejected(client, db, make_user, make_branch):
    branch_a = make_branch("Isolated A", "ISA")
    branch_b = make_branch("Isolated B", "ISB")
    # Admin's home branch is A; not granted access to B.
    make_user("scoped_admin@test.com", Role.ADMIN, home_branch_id=branch_a.id)
    headers = login(client, "scoped_admin@test.com")

    from app.models.academy import Course, CourseLevel

    course = Course(name="Test Course")
    db.add(course)
    db.flush()
    level = CourseLevel(course_id=course.id, name="Beginner")
    db.add(level)
    db.commit()

    resp = client.post(
        "/api/v1/batches",
        headers=headers,
        json={"name": "Batch in B", "course_level_id": str(level.id), "branch_id": str(branch_b.id), "capacity": 10, "schedules": []},
    )
    assert resp.status_code == 403


def test_student_cannot_view_another_students_profile(client, db, make_branch):
    from app.core.security import hash_password
    from app.models.student import StudentProfile
    from app.models.user import User
    from datetime import date

    branch = make_branch("Branch D", "BRD")
    u1 = User(email="s1@test.com", full_name="Student One", hashed_password=hash_password("Welcome@123"), role=Role.STUDENT, home_branch_id=branch.id)
    u2 = User(email="s2@test.com", full_name="Student Two", hashed_password=hash_password("Welcome@123"), role=Role.STUDENT, home_branch_id=branch.id)
    db.add_all([u1, u2])
    db.flush()
    p1 = StudentProfile(user_id=u1.id, joining_date=date.today())
    p2 = StudentProfile(user_id=u2.id, joining_date=date.today())
    db.add_all([p1, p2])
    db.commit()

    headers = login(client, "s1@test.com")
    resp = client.get(f"/api/v1/students/{p2.id}", headers=headers)
    assert resp.status_code == 403
