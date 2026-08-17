import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import EnrollmentStatus
from app.models.academy import Batch, BatchSchedule, ClassSession, Course, CourseLevel
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

def list_batches(db: Session, branch_id: uuid.UUID | None, course_level_id: uuid.UUID | None, trainer_id: uuid.UUID | None):
    query = select(Batch).where(Batch.deleted_at.is_(None))
    if branch_id:
        query = query.where(Batch.branch_id == branch_id)
    if course_level_id:
        query = query.where(Batch.course_level_id == course_level_id)
    if trainer_id:
        query = query.where(Batch.trainer_id == trainer_id)
    return db.execute(query.order_by(Batch.name)).scalars().all()


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


# ---- Class Sessions ----

def list_class_sessions(db: Session, branch_id=None, trainer_id=None, batch_id=None, on_date: date | None = None):
    query = select(ClassSession)
    if branch_id:
        query = query.where(ClassSession.branch_id == branch_id)
    if trainer_id:
        query = query.where(ClassSession.trainer_id == trainer_id)
    if batch_id:
        query = query.where(ClassSession.batch_id == batch_id)
    if on_date:
        query = query.where(ClassSession.session_date == on_date)
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
