import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import AttendanceStatus, ClassSessionStatus, EnrollmentStatus
from app.models.academy import Batch, BatchSchedule, ClassSession, Course, CourseLevel
from app.models.attendance import AttendanceRecord
from app.models.branch import Branch, Studio
from app.models.enrollment import Enrollment


# ---- Branch / Studio ----

def list_branches(db: Session, active_only: bool = False) -> list[Branch]:
    query = select(Branch).where(Branch.deleted_at.is_(None))
    if active_only:
        query = query.where(Branch.is_active.is_(True))
    return db.execute(query.order_by(Branch.name)).scalars().all()


def get_branch(db: Session, branch_id: uuid.UUID) -> Branch | None:
    return db.get(Branch, branch_id)


def list_studios(db: Session, branch_id: uuid.UUID | None) -> list[Studio]:
    query = select(Studio)
    if branch_id:
        query = query.where(Studio.branch_id == branch_id)
    return db.execute(query.order_by(Studio.name)).scalars().all()


# ---- Course / Level ----

def list_courses(db: Session) -> list[Course]:
    return db.execute(select(Course).where(Course.deleted_at.is_(None)).order_by(Course.name)).scalars().all()


def list_course_levels(db: Session, course_id: uuid.UUID | None) -> list[CourseLevel]:
    query = select(CourseLevel)
    if course_id:
        query = query.where(CourseLevel.course_id == course_id)
    return db.execute(query).scalars().all()


# ---- Batch ----

def list_batches(
    db: Session,
    branch_id: uuid.UUID | None,
    course_level_id: uuid.UUID | None,
    trainer_id: uuid.UUID | None,
    is_active: bool | None = None,
    day_of_week: int | None = None,
):
    query = select(Batch).where(Batch.deleted_at.is_(None))
    if branch_id:
        query = query.where(Batch.branch_id == branch_id)
    if course_level_id:
        query = query.where(Batch.course_level_id == course_level_id)
    if trainer_id:
        query = query.where(Batch.trainer_id == trainer_id)
    if is_active is not None:
        query = query.where(Batch.is_active.is_(is_active))
    if day_of_week is not None:
        query = query.join(BatchSchedule, BatchSchedule.batch_id == Batch.id).where(
            BatchSchedule.day_of_week == day_of_week, BatchSchedule.is_active.is_(True)
        )
    return db.execute(query.order_by(Batch.name).distinct()).scalars().all()


def get_batch(db: Session, batch_id: uuid.UUID) -> Batch | None:
    return db.get(Batch, batch_id)


def enrolled_count(db: Session, batch_id: uuid.UUID) -> int:
    return db.execute(
        select(func.count()).select_from(Enrollment).where(
            Enrollment.batch_id == batch_id, Enrollment.status == EnrollmentStatus.ACTIVE
        )
    ).scalar_one()


def waitlist_count(db: Session, batch_id: uuid.UUID) -> int:
    return db.execute(
        select(func.count()).select_from(Enrollment).where(
            Enrollment.batch_id == batch_id, Enrollment.status == EnrollmentStatus.WAITLISTED
        )
    ).scalar_one()


def check_trainer_conflict(db: Session, trainer_id: uuid.UUID, day_of_week: int, start, end, exclude_batch_id=None) -> bool:
    query = (
        select(BatchSchedule)
        .join(Batch, Batch.id == BatchSchedule.batch_id)
        .where(Batch.trainer_id == trainer_id, BatchSchedule.day_of_week == day_of_week, BatchSchedule.is_active.is_(True))
    )
    if exclude_batch_id:
        query = query.where(Batch.id != exclude_batch_id)
    for sched in db.execute(query).scalars().all():
        if start < sched.end_time and end > sched.start_time:
            return True
    return False


def check_studio_conflict(db: Session, studio_id: uuid.UUID, day_of_week: int, start, end, exclude_batch_id=None) -> bool:
    query = (
        select(BatchSchedule)
        .join(Batch, Batch.id == BatchSchedule.batch_id)
        .where(Batch.studio_id == studio_id, BatchSchedule.day_of_week == day_of_week, BatchSchedule.is_active.is_(True))
    )
    if exclude_batch_id:
        query = query.where(Batch.id != exclude_batch_id)
    for sched in db.execute(query).scalars().all():
        if start < sched.end_time and end > sched.start_time:
            return True
    return False


def batch_schedules(db: Session, batch_id: uuid.UUID) -> list[BatchSchedule]:
    return db.execute(
        select(BatchSchedule).where(BatchSchedule.batch_id == batch_id, BatchSchedule.is_active.is_(True)).order_by(BatchSchedule.day_of_week)
    ).scalars().all()


def batch_attendance_percent(db: Session, batch_id: uuid.UUID) -> float | None:
    query = (
        select(AttendanceRecord.status, func.count())
        .join(ClassSession, ClassSession.id == AttendanceRecord.class_session_id)
        .where(ClassSession.batch_id == batch_id)
        .group_by(AttendanceRecord.status)
    )
    counts = {row[0]: row[1] for row in db.execute(query).all()}
    total = sum(counts.values())
    if not total:
        return None
    attended = counts.get(AttendanceStatus.PRESENT, 0) + counts.get(AttendanceStatus.LATE, 0)
    return round((attended / total) * 100, 1)


def batch_conflicts(db: Session, branch_id: uuid.UUID | None = None) -> dict[uuid.UUID, set[str]]:
    """Bulk-scan active batch schedules for trainer/studio double-bookings. Returns {batch_id: {"trainer_conflict", "studio_conflict"}}."""
    query = select(BatchSchedule, Batch).join(Batch, Batch.id == BatchSchedule.batch_id).where(
        BatchSchedule.is_active.is_(True), Batch.deleted_at.is_(None), Batch.is_active.is_(True)
    )
    if branch_id:
        query = query.where(Batch.branch_id == branch_id)
    rows = db.execute(query).all()

    result: dict[uuid.UUID, set[str]] = {}
    for i, (sched_a, batch_a) in enumerate(rows):
        for sched_b, batch_b in rows[i + 1 :]:
            if batch_a.id == batch_b.id or sched_a.day_of_week != sched_b.day_of_week:
                continue
            if not (sched_a.start_time < sched_b.end_time and sched_a.end_time > sched_b.start_time):
                continue
            if batch_a.trainer_id and batch_a.trainer_id == batch_b.trainer_id:
                result.setdefault(batch_a.id, set()).add("trainer_conflict")
                result.setdefault(batch_b.id, set()).add("trainer_conflict")
            if batch_a.studio_id and batch_a.studio_id == batch_b.studio_id:
                result.setdefault(batch_a.id, set()).add("studio_conflict")
                result.setdefault(batch_b.id, set()).add("studio_conflict")
    return result


# ---- Class Sessions ----

def list_class_sessions(db: Session, branch_id=None, trainer_id=None, batch_id=None, on_date: date | None = None, unsubmitted: bool = False):
    query = select(ClassSession)
    if branch_id:
        query = query.where(ClassSession.branch_id == branch_id)
    if trainer_id:
        query = query.where(ClassSession.trainer_id == trainer_id)
    if batch_id:
        query = query.where(ClassSession.batch_id == batch_id)
    if on_date:
        query = query.where(ClassSession.session_date == on_date)
    if unsubmitted:
        query = query.where(
            ClassSession.session_date <= date.today(),
            ClassSession.attendance_submitted_at.is_(None),
            ClassSession.status.in_([ClassSessionStatus.SCHEDULED, ClassSessionStatus.RESCHEDULED, ClassSessionStatus.COMPLETED]),
        )
    return db.execute(query.order_by(ClassSession.session_date, ClassSession.start_time)).scalars().all()


def get_class_session(db: Session, session_id: uuid.UUID) -> ClassSession | None:
    return db.get(ClassSession, session_id)


# ---- Enrollment ----

def list_enrollments(db: Session, student_id=None, batch_id=None, status: EnrollmentStatus | None = None):
    query = select(Enrollment)
    if student_id:
        query = query.where(Enrollment.student_id == student_id)
    if batch_id:
        query = query.where(Enrollment.batch_id == batch_id)
    if status:
        query = query.where(Enrollment.status == status)
    return db.execute(query.order_by(Enrollment.enrolled_date.desc())).scalars().all()


def get_enrollment(db: Session, enrollment_id: uuid.UUID) -> Enrollment | None:
    return db.get(Enrollment, enrollment_id)


def get_active_enrollment(db: Session, student_id: uuid.UUID, batch_id: uuid.UUID) -> Enrollment | None:
    return db.execute(
        select(Enrollment).where(Enrollment.student_id == student_id, Enrollment.batch_id == batch_id)
    ).scalar_one_or_none()
