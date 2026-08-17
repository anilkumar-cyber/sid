from datetime import date, time, timedelta

from app.core.constants import EnrollmentStatus, Role


def login(client, email, password="Welcome@123"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _setup_class_with_students(db, make_user, make_branch):
    from app.models.academy import Batch, BatchSchedule, ClassSession, Course, CourseLevel
    from app.models.branch import Studio
    from app.models.enrollment import Enrollment
    from app.models.student import StudentProfile

    branch = make_branch("Attendance Branch", "ATB")
    studio = Studio(branch_id=branch.id, name="Main Studio", capacity=20)
    db.add(studio)
    db.flush()

    trainer = make_user("attendance_trainer@test.com", Role.TRAINER, home_branch_id=branch.id)
    other_trainer = make_user("other_trainer@test.com", Role.TRAINER, home_branch_id=branch.id)

    course = Course(name="Bollywood")
    db.add(course)
    db.flush()
    level = CourseLevel(course_id=course.id, name="Beginner")
    db.add(level)
    db.flush()

    batch = Batch(name="Test Batch", course_level_id=level.id, branch_id=branch.id, studio_id=studio.id, trainer_id=trainer.id, capacity=10)
    db.add(batch)
    db.flush()

    session = ClassSession(
        batch_id=batch.id, branch_id=branch.id, studio_id=studio.id, trainer_id=trainer.id,
        session_date=date.today(), start_time=time(18, 0), end_time=time(19, 0),
    )
    db.add(session)
    db.flush()

    students = []
    for i in range(3):
        student_user = make_user(f"att_student{i}@test.com", Role.STUDENT, home_branch_id=branch.id)
        profile = StudentProfile(user_id=student_user.id, joining_date=date.today())
        db.add(profile)
        db.flush()
        db.add(Enrollment(student_id=profile.id, batch_id=batch.id, status=EnrollmentStatus.ACTIVE, enrolled_date=date.today()))
        students.append(profile)
    db.commit()

    return branch, trainer, other_trainer, batch, session, students


def test_trainer_can_submit_attendance_for_own_class(client, db, make_user, make_branch):
    branch, trainer, other_trainer, batch, session, students = _setup_class_with_students(db, make_user, make_branch)
    headers = login(client, "attendance_trainer@test.com")

    roster = client.get(f"/api/v1/attendance/sessions/{session.id}/roster", headers=headers)
    assert roster.status_code == 200
    assert len(roster.json()["students"]) == 3

    records = [
        {"student_id": str(students[0].id), "status": "present"},
        {"student_id": str(students[1].id), "status": "present"},
        {"student_id": str(students[2].id), "status": "absent"},
    ]
    submit = client.post(f"/api/v1/attendance/sessions/{session.id}/submit", headers=headers, json={"records": records})
    assert submit.status_code == 200, submit.text
    summary = submit.json()["summary"]
    assert summary == {"present": 2, "absent": 1, "late": 0, "excused": 0, "total": 3}


def test_trainer_cannot_submit_for_another_trainers_class(client, db, make_user, make_branch):
    branch, trainer, other_trainer, batch, session, students = _setup_class_with_students(db, make_user, make_branch)
    headers = login(client, "other_trainer@test.com")

    resp = client.get(f"/api/v1/attendance/sessions/{session.id}/roster", headers=headers)
    assert resp.status_code == 403


def test_cannot_mark_attendance_for_student_not_in_batch(client, db, make_user, make_branch):
    from app.models.student import StudentProfile

    branch, trainer, other_trainer, batch, session, students = _setup_class_with_students(db, make_user, make_branch)
    outsider_user = make_user("outsider@test.com", Role.STUDENT, home_branch_id=branch.id)
    outsider = StudentProfile(user_id=outsider_user.id, joining_date=date.today())
    db.add(outsider)
    db.commit()

    headers = login(client, "attendance_trainer@test.com")
    resp = client.post(
        f"/api/v1/attendance/sessions/{session.id}/submit",
        headers=headers,
        json={"records": [{"student_id": str(outsider.id), "status": "present"}]},
    )
    assert resp.status_code == 400


def test_attendance_correction_workflow(client, db, make_user, make_branch):
    branch, trainer, other_trainer, batch, session, students = _setup_class_with_students(db, make_user, make_branch)
    trainer_headers = login(client, "attendance_trainer@test.com")

    submit = client.post(
        f"/api/v1/attendance/sessions/{session.id}/submit",
        headers=trainer_headers,
        json={"records": [{"student_id": str(students[0].id), "status": "absent"}]},
    )
    record_id = submit.json()["records"][0]["id"]

    correction = client.post(
        "/api/v1/attendance/corrections",
        headers=trainer_headers,
        json={"attendance_record_id": record_id, "requested_status": "present", "reason": "Student arrived late, was marked absent by mistake"},
    )
    assert correction.status_code == 201
    request_id = correction.json()["id"]

    # Trainer cannot approve their own correction request.
    resp = client.post(f"/api/v1/attendance/corrections/{request_id}/approve", headers=trainer_headers)
    assert resp.status_code == 403

    admin = make_user("attendance_admin@test.com", Role.ADMIN, home_branch_id=branch.id)
    admin_headers = login(client, "attendance_admin@test.com")
    approve = client.post(f"/api/v1/attendance/corrections/{request_id}/approve", headers=admin_headers)
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"


def test_student_attendance_stats(client, db, make_user, make_branch):
    branch, trainer, other_trainer, batch, session, students = _setup_class_with_students(db, make_user, make_branch)
    trainer_headers = login(client, "attendance_trainer@test.com")

    client.post(
        f"/api/v1/attendance/sessions/{session.id}/submit",
        headers=trainer_headers,
        json={"records": [{"student_id": str(students[0].id), "status": "present"}]},
    )

    resp = client.get(f"/api/v1/attendance/students/{students[0].id}/stats", headers=trainer_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_sessions"] == 1
    assert body["attendance_percent"] == 100.0
