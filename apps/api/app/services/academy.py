import uuid
from datetime import date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import ClassSessionStatus, EnrollmentStatus, MembershipStatus
from app.models.academy import Batch, BatchSchedule, ClassSession, Course, CourseLevel
from app.models.branch import Branch, Studio
from app.models.enrollment import Enrollment, EnrollmentHistory
from app.models.membership import Membership
from app.repositories import academy as repo
from app.repositories.attendance import get_roster
from app.services import notification as notification_service


# ---- Branch / Studio ----

def create_branch(db: Session, data: dict) -> Branch:
    branch = Branch(**data)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


def update_branch(db: Session, branch: Branch, updates: dict) -> Branch:
    for k, v in updates.items():
        if v is not None:
            setattr(branch, k, v)
    db.commit()
    db.refresh(branch)
    return branch


def create_studio(db: Session, data: dict) -> Studio:
    studio = Studio(**data)
    db.add(studio)
    db.commit()
    db.refresh(studio)
    return studio


# ---- Course ----

def create_course(db: Session, data: dict) -> Course:
    course = Course(**data)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def create_course_level(db: Session, data: dict) -> CourseLevel:
    level = CourseLevel(**data)
    db.add(level)
    db.commit()
    db.refresh(level)
    return level


# ---- Batch ----

def create_batch(db: Session, data: dict) -> Batch:
    schedules_in = data.pop("schedules", [])
    batch = Batch(**data)

    for sched in schedules_in:
        if batch.trainer_id and repo.check_trainer_conflict(db, batch.trainer_id, sched["day_of_week"], sched["start_time"], sched["end_time"]):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Trainer is already booked for an overlapping slot")
        if batch.studio_id and repo.check_studio_conflict(db, batch.studio_id, sched["day_of_week"], sched["start_time"], sched["end_time"]):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Studio is already booked for an overlapping slot")

    db.add(batch)
    db.flush()
    for sched in schedules_in:
        db.add(BatchSchedule(batch_id=batch.id, **sched))
    db.commit()
    db.refresh(batch)
    generate_class_sessions(db, batch.id, weeks_ahead=8)
    return batch


def update_batch(db: Session, batch: Batch, updates: dict) -> Batch:
    new_trainer_id = updates.get("trainer_id", batch.trainer_id)
    new_studio_id = updates.get("studio_id", batch.studio_id)
    if "trainer_id" in updates or "studio_id" in updates:
        for sched in repo.batch_schedules(db, batch.id):
            if new_trainer_id and repo.check_trainer_conflict(
                db, new_trainer_id, sched.day_of_week, sched.start_time, sched.end_time, exclude_batch_id=batch.id
            ):
                raise HTTPException(status.HTTP_409_CONFLICT, detail="Trainer is already booked for an overlapping slot")
            if new_studio_id and repo.check_studio_conflict(
                db, new_studio_id, sched.day_of_week, sched.start_time, sched.end_time, exclude_batch_id=batch.id
            ):
                raise HTTPException(status.HTTP_409_CONFLICT, detail="Studio is already booked for an overlapping slot")

    for k, v in updates.items():
        if v is not None:
            setattr(batch, k, v)
    db.commit()
    db.refresh(batch)
    return batch


def batch_to_out(db: Session, batch: Batch, conflicts: set[str] | None = None) -> dict:
    from app.models.user import User

    enrolled = repo.enrolled_count(db, batch.id)
    waitlist = repo.waitlist_count(db, batch.id)
    attendance_percent = repo.batch_attendance_percent(db, batch.id)
    schedules = repo.batch_schedules(db, batch.id)
    if conflicts is None:
        conflicts = repo.batch_conflicts(db, batch.branch_id).get(batch.id, set())

    health: list[str] = list(conflicts)
    occupancy = enrolled / batch.capacity if batch.capacity else 0
    if occupancy >= 0.9 and waitlist >= 3:
        health.append("high_demand")
    if occupancy <= 0.3 and (attendance_percent is not None and attendance_percent <= 50):
        health.append("low_utilization")

    trainer = db.get(User, batch.trainer_id) if batch.trainer_id else None
    course_level = batch.course_level
    course = course_level.course if course_level else None

    return {
        "id": batch.id,
        "name": batch.name,
        "course_level_id": batch.course_level_id,
        "course_name": course.name if course else None,
        "level_name": course_level.name if course_level else None,
        "branch_id": batch.branch_id,
        "branch_name": batch.branch.name if batch.branch else None,
        "studio_id": batch.studio_id,
        "studio_name": batch.studio.name if batch.studio else None,
        "trainer_id": batch.trainer_id,
        "trainer_name": trainer.full_name if trainer else None,
        "capacity": batch.capacity,
        "is_active": batch.is_active,
        "enrolled_count": enrolled,
        "waitlist_count": waitlist,
        "available_seats": max(0, batch.capacity - enrolled),
        "attendance_percent": attendance_percent,
        "schedules": schedules,
        "health": health,
    }


def list_batches_out(db: Session, batches: list[Batch]) -> list[dict]:
    conflicts_by_batch = repo.batch_conflicts(db)
    return [batch_to_out(db, b, conflicts_by_batch.get(b.id, set())) for b in batches]


def generate_class_sessions(db: Session, batch_id: uuid.UUID, weeks_ahead: int = 8) -> int:
    """Materialize ClassSession rows for the next N weeks from the batch's recurring schedule."""
    batch = repo.get_batch(db, batch_id)
    if batch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Batch not found")

    schedules = db.query(BatchSchedule).filter(BatchSchedule.batch_id == batch_id, BatchSchedule.is_active.is_(True)).all()
    today = date.today()
    created = 0
    for sched in schedules:
        for week in range(weeks_ahead):
            days_until = (sched.day_of_week - today.weekday() + 7) % 7 + week * 7
            session_date = today + timedelta(days=days_until)
            exists = (
                db.query(ClassSession)
                .filter(
                    ClassSession.batch_id == batch_id,
                    ClassSession.session_date == session_date,
                    ClassSession.start_time == sched.start_time,
                )
                .first()
            )
            if exists:
                continue
            db.add(
                ClassSession(
                    batch_id=batch_id,
                    branch_id=batch.branch_id,
                    studio_id=batch.studio_id,
                    trainer_id=batch.trainer_id,
                    session_date=session_date,
                    start_time=sched.start_time,
                    end_time=sched.end_time,
                )
            )
            created += 1
    db.commit()
    return created


def reschedule_class_session(db: Session, session: ClassSession, updates: dict, performed_by) -> ClassSession:
    reason = updates.pop("reason", None)
    trainer_id = updates.get("trainer_id", session.trainer_id)
    studio_id = updates.get("studio_id", session.studio_id)
    day_of_week = (updates.get("session_date") or session.session_date).weekday()
    start = updates.get("start_time") or session.start_time
    end = updates.get("end_time") or session.end_time

    if trainer_id:
        conflict = repo.check_trainer_conflict(db, trainer_id, day_of_week, start, end, exclude_batch_id=session.batch_id)
        if conflict:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Trainer has a conflicting class at that time")
    if studio_id:
        conflict = repo.check_studio_conflict(db, studio_id, day_of_week, start, end, exclude_batch_id=session.batch_id)
        if conflict:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Studio has a conflicting booking at that time")

    for k, v in updates.items():
        if v is not None:
            setattr(session, k, v)
    session.status = ClassSessionStatus.RESCHEDULED
    session.cancellation_reason = reason
    db.commit()
    db.refresh(session)
    _notify_roster(
        db,
        session,
        type="class.rescheduled",
        title=f"{session.batch.name} rescheduled",
        body=f"Now on {session.session_date} at {session.start_time.strftime('%H:%M')}." + (f" {reason}" if reason else ""),
    )
    return session


def cancel_class_session(db: Session, session: ClassSession, reason: str) -> ClassSession:
    session.status = ClassSessionStatus.CANCELLED
    session.cancellation_reason = reason
    db.commit()
    db.refresh(session)
    _notify_roster(
        db,
        session,
        type="class.cancelled",
        title=f"{session.batch.name} cancelled — {session.session_date}",
        body=reason,
    )
    return session


def _notify_roster(db: Session, session: ClassSession, type: str, title: str, body: str | None) -> None:
    roster = get_roster(db, session.batch_id)
    user_ids = [s.user_id for s in roster]
    if session.trainer_id:
        user_ids.append(session.trainer_id)
    if user_ids:
        notification_service.notify(db, user_ids, type=type, title=title, body=body, link_url="/classes")


# ---- Enrollment ----

def enroll_student(db: Session, student_id: uuid.UUID, batch_id: uuid.UUID, membership_id, override_capacity: bool, performed_by_id) -> Enrollment:
    batch = repo.get_batch(db, batch_id)
    if batch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Batch not found")

    existing = repo.get_active_enrollment(db, student_id, batch_id)
    if existing and existing.status in (EnrollmentStatus.ACTIVE, EnrollmentStatus.WAITLISTED):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Student is already enrolled or waitlisted in this batch")

    if membership_id:
        membership = db.get(Membership, membership_id)
        if membership is None or membership.status != MembershipStatus.ACTIVE:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Membership is not active")
        if membership.remaining_credits is not None and membership.remaining_credits <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Membership has no remaining class credits")

    count = repo.enrolled_count(db, batch_id)
    status_value = EnrollmentStatus.ACTIVE
    waitlist_position = None
    if count >= batch.capacity and not override_capacity:
        status_value = EnrollmentStatus.WAITLISTED
        waitlist_position = repo.waitlist_count(db, batch_id) + 1

    enrollment = Enrollment(
        student_id=student_id,
        batch_id=batch_id,
        membership_id=membership_id,
        status=status_value,
        enrolled_date=date.today(),
        waitlist_position=waitlist_position,
    )
    db.add(enrollment)
    db.flush()
    db.add(
        EnrollmentHistory(
            enrollment_id=enrollment.id,
            action="waitlisted" if status_value == EnrollmentStatus.WAITLISTED else "enrolled",
            to_batch_id=batch_id,
            performed_by_id=performed_by_id,
        )
    )
    db.commit()
    db.refresh(enrollment)
    return enrollment


def transfer_enrollment(db: Session, enrollment: Enrollment, to_batch_id: uuid.UUID, notes: str | None, performed_by_id) -> Enrollment:
    to_batch = repo.get_batch(db, to_batch_id)
    if to_batch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Target batch not found")
    from_batch_id = enrollment.batch_id
    enrollment.batch_id = to_batch_id
    enrollment.status = EnrollmentStatus.ACTIVE
    db.add(
        EnrollmentHistory(
            enrollment_id=enrollment.id,
            action="transferred",
            from_batch_id=from_batch_id,
            to_batch_id=to_batch_id,
            performed_by_id=performed_by_id,
            notes=notes,
        )
    )
    db.commit()
    db.refresh(enrollment)
    return enrollment


def cancel_enrollment(db: Session, enrollment: Enrollment, performed_by_id) -> Enrollment:
    enrollment.status = EnrollmentStatus.CANCELLED
    db.add(
        EnrollmentHistory(
            enrollment_id=enrollment.id, action="cancelled", from_batch_id=enrollment.batch_id, performed_by_id=performed_by_id
        )
    )
    db.commit()

    if enrollment.waitlist_position is not None:
        next_waitlisted = (
            db.query(Enrollment)
            .filter(Enrollment.batch_id == enrollment.batch_id, Enrollment.status == EnrollmentStatus.WAITLISTED)
            .order_by(Enrollment.waitlist_position)
            .first()
        )
        if next_waitlisted:
            next_waitlisted.status = EnrollmentStatus.ACTIVE
            next_waitlisted.waitlist_position = None
            db.commit()

    db.refresh(enrollment)
    return enrollment
