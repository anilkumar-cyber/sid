import uuid
from datetime import date, timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.constants import (
    ClassSessionStatus,
    EnrollmentStatus,
    EventStatus,
    MediaStatus,
    MembershipStatus,
    PaymentStatus,
    StudentStatus,
)
from app.models.academy import Batch, BatchSchedule, ClassSession
from app.models.attendance import AttendanceCorrectionRequest, AttendanceRecord
from app.models.enrollment import Enrollment
from app.models.event import Event
from app.models.media import Album, MediaAsset
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.student import StudentProfile
from app.models.user import User

BranchScope = set[uuid.UUID] | None  # None means "no branch restriction" (super admin platform-wide)


def _branch_filter(query, column, branch_ids: BranchScope):
    if branch_ids is not None:
        query = query.where(column.in_(branch_ids))
    return query


def pending_payments(db: Session, branch_ids: BranchScope) -> tuple[int, float]:
    query = select(func.count(), func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == PaymentStatus.PENDING)
    query = _branch_filter(query, Payment.branch_id, branch_ids)
    count, total = db.execute(query).one()
    return count, float(total)


def expiring_memberships_count(db: Session, branch_ids: BranchScope, within_days: int = 14) -> int:
    cutoff = date.today() + timedelta(days=within_days)
    query = (
        select(func.count())
        .select_from(Membership)
        .join(StudentProfile, StudentProfile.id == Membership.student_id)
        .join(User, User.id == StudentProfile.user_id)
        .where(Membership.status == MembershipStatus.ACTIVE, Membership.end_date.is_not(None), Membership.end_date <= cutoff)
    )
    query = _branch_filter(query, User.home_branch_id, branch_ids)
    return db.execute(query).scalar_one()


def expired_memberships_count(db: Session, branch_ids: BranchScope) -> int:
    query = (
        select(func.count())
        .select_from(Membership)
        .join(StudentProfile, StudentProfile.id == Membership.student_id)
        .join(User, User.id == StudentProfile.user_id)
        .where(Membership.status == MembershipStatus.EXPIRED)
    )
    query = _branch_filter(query, User.home_branch_id, branch_ids)
    return db.execute(query).scalar_one()


def pending_corrections_count(db: Session, branch_ids: BranchScope) -> int:
    query = (
        select(func.count())
        .select_from(AttendanceCorrectionRequest)
        .join(AttendanceRecord, AttendanceRecord.id == AttendanceCorrectionRequest.attendance_record_id)
        .join(ClassSession, ClassSession.id == AttendanceRecord.class_session_id)
        .where(AttendanceCorrectionRequest.status == "pending")
    )
    query = _branch_filter(query, ClassSession.branch_id, branch_ids)
    return db.execute(query).scalar_one()


def unsubmitted_sessions_count(db: Session, branch_ids: BranchScope) -> int:
    query = select(func.count()).select_from(ClassSession).where(
        ClassSession.session_date <= date.today(),
        ClassSession.attendance_submitted_at.is_(None),
        ClassSession.status.in_([ClassSessionStatus.SCHEDULED, ClassSessionStatus.RESCHEDULED, ClassSessionStatus.COMPLETED]),
    )
    query = _branch_filter(query, ClassSession.branch_id, branch_ids)
    return db.execute(query).scalar_one()


def waitlisted_count(db: Session, branch_ids: BranchScope) -> int:
    query = (
        select(func.count())
        .select_from(Enrollment)
        .join(Batch, Batch.id == Enrollment.batch_id)
        .where(Enrollment.status == EnrollmentStatus.WAITLISTED)
    )
    query = _branch_filter(query, Batch.branch_id, branch_ids)
    return db.execute(query).scalar_one()


def schedule_conflicts(db: Session, branch_ids: BranchScope) -> list[dict]:
    """Bulk-scan active batch schedules for trainer/studio double-bookings."""
    query = select(BatchSchedule, Batch).join(Batch, Batch.id == BatchSchedule.batch_id).where(
        BatchSchedule.is_active.is_(True), Batch.deleted_at.is_(None), Batch.is_active.is_(True)
    )
    query = _branch_filter(query, Batch.branch_id, branch_ids)
    rows = db.execute(query).all()

    conflicts: list[dict] = []
    seen_pairs: set[tuple] = set()
    for i, (sched_a, batch_a) in enumerate(rows):
        for sched_b, batch_b in rows[i + 1 :]:
            if batch_a.id == batch_b.id or sched_a.day_of_week != sched_b.day_of_week:
                continue
            overlaps = sched_a.start_time < sched_b.end_time and sched_a.end_time > sched_b.start_time
            if not overlaps:
                continue
            if batch_a.trainer_id and batch_a.trainer_id == batch_b.trainer_id:
                key = ("trainer", batch_a.trainer_id, sched_a.day_of_week, tuple(sorted([str(batch_a.id), str(batch_b.id)])))
                if key not in seen_pairs:
                    seen_pairs.add(key)
                    conflicts.append({"type": "trainer", "batch_a_id": batch_a.id, "batch_b_id": batch_b.id})
            if batch_a.studio_id and batch_a.studio_id == batch_b.studio_id:
                key = ("studio", batch_a.studio_id, sched_a.day_of_week, tuple(sorted([str(batch_a.id), str(batch_b.id)])))
                if key not in seen_pairs:
                    seen_pairs.add(key)
                    conflicts.append({"type": "studio", "batch_a_id": batch_a.id, "batch_b_id": batch_b.id})
    return conflicts


def pending_media_count(db: Session, branch_ids: BranchScope) -> int:
    query = select(func.count()).select_from(MediaAsset).join(Album, Album.id == MediaAsset.album_id).where(
        MediaAsset.status == MediaStatus.PENDING_APPROVAL
    )
    if branch_ids is not None:
        query = query.outerjoin(Event, Event.id == Album.event_id).where(
            or_(Album.branch_id.in_(branch_ids), Event.branch_id.in_(branch_ids))
        )
    return db.execute(query).scalar_one()


def new_trial_students_count(db: Session, branch_ids: BranchScope, since_days: int = 7) -> int:
    cutoff = date.today() - timedelta(days=since_days)
    query = (
        select(func.count())
        .select_from(StudentProfile)
        .join(User, User.id == StudentProfile.user_id)
        .where(StudentProfile.status == StudentStatus.TRIAL, StudentProfile.joining_date >= cutoff, StudentProfile.deleted_at.is_(None))
    )
    query = _branch_filter(query, User.home_branch_id, branch_ids)
    return db.execute(query).scalar_one()


def draft_events_needing_publish_count(db: Session, branch_ids: BranchScope, within_days: int = 14) -> int:
    cutoff = date.today() + timedelta(days=within_days)
    query = select(func.count()).select_from(Event).where(
        Event.status == EventStatus.DRAFT, Event.event_date <= cutoff, Event.deleted_at.is_(None)
    )
    if branch_ids is not None:
        query = query.where(Event.branch_id.in_(branch_ids))
    return db.execute(query).scalar_one()
