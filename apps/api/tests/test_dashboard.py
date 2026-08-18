from datetime import date

from app.core.constants import Role


def login(client, email, password="Welcome@123"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_student_and_trainer_cannot_access_action_center(client, db, make_user, make_branch):
    branch = make_branch("Branch A", "DBA")
    make_user("student_ac@test.com", Role.STUDENT, home_branch_id=branch.id)
    make_user("trainer_ac@test.com", Role.TRAINER, home_branch_id=branch.id)

    for email in ("student_ac@test.com", "trainer_ac@test.com"):
        headers = login(client, email)
        resp = client.get("/api/v1/dashboard/action-center", headers=headers)
        assert resp.status_code == 403


def _make_student(db, branch_id, email="stu_ac@test.com"):
    from app.core.security import hash_password
    from app.models.student import StudentProfile
    from app.models.user import User

    user = User(email=email, full_name="Test Student", hashed_password=hash_password("Welcome@123"), role=Role.STUDENT, home_branch_id=branch_id)
    db.add(user)
    db.flush()
    profile = StudentProfile(user_id=user.id, joining_date=date.today())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def test_pending_payment_appears_in_action_center(client, db, make_user, make_branch):
    from app.core.constants import PaymentMethod
    from app.models.payment import Payment

    branch = make_branch("Branch B", "DBB")
    admin = make_user("admin_ac@test.com", Role.ADMIN, home_branch_id=branch.id)
    student = _make_student(db, branch.id)

    payment = Payment(
        student_id=student.id, branch_id=branch.id, amount=1500, method=PaymentMethod.CASH,
        payment_date=date.today(), recorded_by_id=admin.id,
    )
    db.add(payment)
    db.commit()

    headers = login(client, "admin_ac@test.com")
    resp = client.get("/api/v1/dashboard/action-center", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    payment_item = next((i for i in items if i["id"] == "payments-pending"), None)
    assert payment_item is not None
    assert payment_item["count"] == 1
    assert payment_item["link"] == "/payments?status=pending"
    assert payment_item["priority"] == "high"


def test_action_center_respects_branch_isolation(client, db, make_user, make_branch):
    from app.core.constants import PaymentMethod
    from app.models.payment import Payment

    branch_a = make_branch("Branch Iso A", "DIA")
    branch_b = make_branch("Branch Iso B", "DIB")
    admin_a = make_user("admin_iso_a@test.com", Role.ADMIN, home_branch_id=branch_a.id)
    student_b = _make_student(db, branch_b.id, email="stu_iso_b@test.com")

    # Payment belongs to branch B; admin only has access to branch A.
    payment = Payment(
        student_id=student_b.id, branch_id=branch_b.id, amount=999, method=PaymentMethod.CASH,
        payment_date=date.today(), recorded_by_id=admin_a.id,
    )
    db.add(payment)
    db.commit()

    headers = login(client, "admin_iso_a@test.com")
    resp = client.get("/api/v1/dashboard/action-center", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert not any(i["id"] == "payments-pending" for i in items)


def test_admin_cannot_query_unauthorized_branch(client, db, make_user, make_branch):
    branch_a = make_branch("Branch Deny A", "DDA")
    branch_b = make_branch("Branch Deny B", "DDB")
    make_user("admin_deny@test.com", Role.ADMIN, home_branch_id=branch_a.id)

    headers = login(client, "admin_deny@test.com")
    resp = client.get("/api/v1/dashboard/action-center", headers=headers, params={"branch_id": str(branch_b.id)})
    assert resp.status_code == 403


def test_super_admin_sees_platform_wide_by_default(client, db, make_user, make_branch):
    from app.core.constants import PaymentMethod
    from app.models.payment import Payment

    branch = make_branch("Branch Super", "DSU")
    make_user("super_ac@test.com", Role.SUPER_ADMIN)
    student = _make_student(db, branch.id, email="stu_super@test.com")
    admin_recorder = make_user("recorder_ac@test.com", Role.ADMIN, home_branch_id=branch.id)

    payment = Payment(
        student_id=student.id, branch_id=branch.id, amount=500, method=PaymentMethod.CASH,
        payment_date=date.today(), recorded_by_id=admin_recorder.id,
    )
    db.add(payment)
    db.commit()

    headers = login(client, "super_ac@test.com")
    resp = client.get("/api/v1/dashboard/action-center", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(i["id"] == "payments-pending" and i["count"] >= 1 for i in items)
