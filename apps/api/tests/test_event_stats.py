from datetime import date

from app.core.constants import Role


def login(client, email, password="Welcome@123"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_event_stats_reflects_tickets_performances_and_participants(client, db, make_user, make_branch):
    from app.models.event import Event, EventActivity, EventParticipant
    from app.models.student import StudentProfile
    from app.core.security import hash_password
    from app.models.user import User

    branch = make_branch("Event Branch A", "EVA")
    make_user("admin_event@test.com", Role.ADMIN, home_branch_id=branch.id)

    event = Event(name="Annual Day", event_date=date.today(), branch_id=branch.id)
    db.add(event)
    db.flush()
    activity = EventActivity(event_id=event.id, start_time="18:00:00", title="Opening Number")
    db.add(activity)
    db.flush()

    student_user = User(email="perf_student@test.com", full_name="Perf Student", hashed_password=hash_password("Welcome@123"), role=Role.STUDENT, home_branch_id=branch.id)
    db.add(student_user)
    db.flush()
    student = StudentProfile(user_id=student_user.id, joining_date=date.today())
    db.add(student)
    db.flush()
    db.add(EventParticipant(activity_id=activity.id, student_id=student.id, role="performer"))
    db.commit()

    headers = login(client, "admin_event@test.com")
    resp = client.get(f"/api/v1/events/{event.id}/stats", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["performances_count"] == 1
    assert body["participants_count"] == 1
    assert body["tickets_sold"] == 0
    assert body["revenue"] == 0.0


def test_event_stats_requires_staff_role(client, db, make_user, make_branch):
    branch = make_branch("Event Branch B", "EVB")
    make_user("trainer_event@test.com", Role.TRAINER, home_branch_id=branch.id)
    from app.models.event import Event

    event = Event(name="Recital", event_date=date.today(), branch_id=branch.id)
    db.add(event)
    db.commit()

    headers = login(client, "trainer_event@test.com")
    resp = client.get(f"/api/v1/events/{event.id}/stats", headers=headers)
    assert resp.status_code == 403
