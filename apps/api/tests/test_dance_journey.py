from datetime import date, timedelta

from app.core.constants import Role


def login(client, email, password="Welcome@123"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _make_student(db, branch_id, email):
    from app.core.security import hash_password
    from app.models.student import StudentProfile
    from app.models.user import User

    user = User(email=email, full_name="Journey Student", hashed_password=hash_password("Welcome@123"), role=Role.STUDENT, home_branch_id=branch_id)
    db.add(user)
    db.flush()
    profile = StudentProfile(user_id=user.id, joining_date=date.today())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def test_practice_log_is_idempotent_per_day(client, db, make_branch):
    branch = make_branch("Journey Branch A", "JRA")
    _make_student(db, branch.id, "practice1@test.com")

    headers = login(client, "practice1@test.com")
    resp_me = client.get("/api/v1/students/me", headers=headers)
    student_id = resp_me.json()["id"]

    first = client.post(f"/api/v1/students/{student_id}/practice", headers=headers)
    assert first.status_code == 201
    assert first.json()["logged"] is True

    second = client.post(f"/api/v1/students/{student_id}/practice", headers=headers)
    assert second.status_code == 201
    assert second.json()["logged"] is False


def test_practice_streak_computation_across_gap(db):
    from app.repositories.dance_journey import compute_streak

    today = date.today()
    # 3-day current streak (today, yesterday, day before), then a gap, then an older 5-day streak.
    dates = [
        today, today - timedelta(days=1), today - timedelta(days=2),
        today - timedelta(days=10), today - timedelta(days=11), today - timedelta(days=12),
        today - timedelta(days=13), today - timedelta(days=14),
    ]
    result = compute_streak(dates)
    assert result["current_streak_days"] == 3
    assert result["longest_streak_days"] == 5
    assert result["total_days_logged"] == 8
    assert result["practiced_today"] is True


def test_practice_streak_broken_when_yesterday_missing(db):
    from app.repositories.dance_journey import compute_streak

    today = date.today()
    dates = [today - timedelta(days=2), today - timedelta(days=3)]
    result = compute_streak(dates)
    assert result["current_streak_days"] == 0
    assert result["practiced_today"] is False


def test_student_cannot_log_practice_for_another_student(client, db, make_branch):
    branch = make_branch("Journey Branch B", "JRB")
    s1 = _make_student(db, branch.id, "js1@test.com")
    _make_student(db, branch.id, "js2@test.com")

    headers = login(client, "js1@test.com")
    resp = client.post(f"/api/v1/students/{s1.id}/practice", headers=headers)
    assert resp.status_code == 201

    headers2 = login(client, "js2@test.com")
    resp2 = client.post(f"/api/v1/students/{s1.id}/practice", headers=headers2)
    assert resp2.status_code == 403


def test_achievements_reflect_real_attendance_and_certificates(client, db, make_user, make_branch):
    from app.core.constants import AttendanceStatus
    from app.models.academy import Batch, ClassSession
    from app.models.attendance import AttendanceRecord
    from app.models.learning import Certificate

    branch = make_branch("Journey Branch C", "JRC")
    admin = make_user("admin_journey@test.com", Role.ADMIN, home_branch_id=branch.id)
    student = _make_student(db, branch.id, "achieve@test.com")

    from app.models.academy import Course, CourseLevel

    course = Course(name="Salsa")
    db.add(course)
    db.flush()
    level = CourseLevel(course_id=course.id, name="Beginner")
    db.add(level)
    db.flush()
    batch = Batch(name="Salsa Batch", course_level_id=level.id, branch_id=branch.id, capacity=10)
    db.add(batch)
    db.flush()

    session = ClassSession(batch_id=batch.id, branch_id=branch.id, session_date=date.today(), start_time="18:00:00", end_time="19:00:00")
    db.add(session)
    db.flush()
    db.add(AttendanceRecord(class_session_id=session.id, student_id=student.id, status=AttendanceStatus.PRESENT, marked_by_id=admin.id, marked_at=session.created_at))

    db.add(Certificate(
        student_id=student.id, certificate_number="CERT-1", achievement_type="course_completion",
        title="Salsa Beginner Complete", issued_date=date.today(), verification_code="VER-1",
    ))
    db.commit()

    headers = login(client, "admin_journey@test.com")
    resp = client.get(f"/api/v1/students/{student.id}/achievements", headers=headers)
    assert resp.status_code == 200, resp.text
    by_id = {a["id"]: a for a in resp.json()}
    assert by_id["classes_1"]["earned"] is True
    assert by_id["classes_10"]["earned"] is False
    assert by_id["course_completed"]["earned"] is True
    assert by_id["competition_participant"]["earned"] is False
    assert by_id["first_performance"]["earned"] is False
