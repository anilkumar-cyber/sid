from datetime import date, timedelta

from app.core.constants import Role


def login(client, email, password="Welcome@123"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _make_student(db, branch_id, email="s360@test.com"):
    from app.core.security import hash_password
    from app.models.student import StudentProfile
    from app.models.user import User

    user = User(email=email, full_name="360 Student", hashed_password=hash_password("Welcome@123"), role=Role.STUDENT, home_branch_id=branch_id)
    db.add(user)
    db.flush()
    profile = StudentProfile(user_id=user.id, joining_date=date.today())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _setup_course_level(db):
    from app.models.academy import Course, CourseLevel

    course = Course(name="Contemporary")
    db.add(course)
    db.flush()
    level = CourseLevel(course_id=course.id, name="Intermediate")
    db.add(level)
    db.commit()
    return level


def test_overview_reflects_membership_batch_and_payment(client, db, make_user, make_branch):
    from app.core.constants import MembershipStatus, PaymentMethod
    from app.models.academy import Batch
    from app.models.enrollment import Enrollment
    from app.models.membership import Membership, MembershipPlan
    from app.models.payment import Payment

    branch = make_branch("360 Branch A", "S3A")
    admin = make_user("admin_360@test.com", Role.ADMIN, home_branch_id=branch.id)
    student = _make_student(db, branch.id)
    level = _setup_course_level(db)

    batch = Batch(name="Contemporary Inter", course_level_id=level.id, branch_id=branch.id, capacity=10)
    db.add(batch)
    db.flush()
    db.add(Enrollment(student_id=student.id, batch_id=batch.id, status="active", enrolled_date=date.today()))

    plan = MembershipPlan(name="Monthly", price=2000)
    db.add(plan)
    db.flush()
    db.add(Membership(student_id=student.id, plan_id=plan.id, start_date=date.today(), status=MembershipStatus.ACTIVE))

    db.add(Payment(student_id=student.id, branch_id=branch.id, amount=500, method=PaymentMethod.CASH, status="pending", payment_date=date.today(), recorded_by_id=admin.id))
    db.commit()

    headers = login(client, "admin_360@test.com")
    resp = client.get(f"/api/v1/students/{student.id}/overview", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["current_membership"] is not None
    assert body["current_batches"] == [{"batch_id": str(batch.id), "batch_name": "Contemporary Inter"}]
    assert body["outstanding_payment_amount"] == 500.0


def test_student_cannot_view_another_students_overview(client, db, make_branch):
    branch = make_branch("360 Branch B", "S3B")
    s1 = _make_student(db, branch.id, email="s1_360@test.com")
    s2 = _make_student(db, branch.id, email="s2_360@test.com")

    headers = login(client, "s1_360@test.com")
    resp = client.get(f"/api/v1/students/{s2.id}/overview", headers=headers)
    assert resp.status_code == 403

    own = client.get(f"/api/v1/students/{s1.id}/overview", headers=headers)
    assert own.status_code == 200


def test_timeline_includes_enrollment_and_payment_entries(client, db, make_user, make_branch):
    from app.core.constants import PaymentMethod
    from app.models.academy import Batch
    from app.services.academy import enroll_student
    from app.models.payment import Payment

    branch = make_branch("360 Branch C", "S3C")
    admin = make_user("admin_timeline@test.com", Role.ADMIN, home_branch_id=branch.id)
    student = _make_student(db, branch.id, email="timeline@test.com")
    level = _setup_course_level(db)
    batch = Batch(name="Timeline Batch", course_level_id=level.id, branch_id=branch.id, capacity=10)
    db.add(batch)
    db.commit()

    enroll_student(db, student.id, batch.id, None, False, admin.id)
    db.add(Payment(student_id=student.id, branch_id=branch.id, amount=1000, method=PaymentMethod.CASH, status="paid", payment_date=date.today(), recorded_by_id=admin.id))
    db.commit()

    headers = login(client, "admin_timeline@test.com")
    resp = client.get(f"/api/v1/students/{student.id}/timeline", headers=headers)
    assert resp.status_code == 200, resp.text
    types = {e["type"] for e in resp.json()["entries"]}
    assert "enrollment" in types
    assert "payment" in types


def test_attendance_history_and_performances_endpoints_are_ownership_scoped(client, db, make_branch):
    branch = make_branch("360 Branch D", "S3D")
    s1 = _make_student(db, branch.id, email="s1_hist@test.com")
    s2 = _make_student(db, branch.id, email="s2_hist@test.com")

    headers = login(client, "s1_hist@test.com")
    resp = client.get(f"/api/v1/attendance/students/{s2.id}/history", headers=headers)
    assert resp.status_code == 403

    resp2 = client.get(f"/api/v1/students/{s2.id}/performances", headers=headers)
    assert resp2.status_code == 403

    resp3 = client.get(f"/api/v1/students/{s2.id}/tickets", headers=headers)
    assert resp3.status_code == 403

    own = client.get(f"/api/v1/attendance/students/{s1.id}/history", headers=headers)
    assert own.status_code == 200
    assert own.json() == []
