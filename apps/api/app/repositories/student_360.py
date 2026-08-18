import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import ClassSessionStatus, EnrollmentStatus, MembershipStatus, PaymentStatus, TicketStatus
from app.models.academy import Batch, ClassSession
from app.models.attendance import AttendanceRecord
from app.models.enrollment import Enrollment
from app.models.event import Event, EventActivity, EventParticipant
from app.models.learning import Certificate
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.ticket import Ticket


def current_membership(db: Session, student_id: uuid.UUID) -> Membership | None:
    return db.execute(
        select(Membership)
        .where(Membership.student_id == student_id, Membership.status == MembershipStatus.ACTIVE)
        .order_by(Membership.start_date.desc())
        .limit(1)
    ).scalar_one_or_none()


def current_batches(db: Session, student_id: uuid.UUID) -> list[tuple[uuid.UUID, str]]:
    rows = db.execute(
        select(Batch.id, Batch.name)
        .join(Enrollment, Enrollment.batch_id == Batch.id)
        .where(Enrollment.student_id == student_id, Enrollment.status == EnrollmentStatus.ACTIVE)
    ).all()
    return [(r[0], r[1]) for r in rows]


def next_class(db: Session, batch_ids: list[uuid.UUID]) -> ClassSession | None:
    if not batch_ids:
        return None
    return db.execute(
        select(ClassSession)
        .where(ClassSession.batch_id.in_(batch_ids), ClassSession.session_date >= date.today(), ClassSession.status != ClassSessionStatus.CANCELLED)
        .order_by(ClassSession.session_date, ClassSession.start_time)
        .limit(1)
    ).scalar_one_or_none()


def outstanding_payment_amount(db: Session, student_id: uuid.UUID) -> float:
    return float(
        db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.student_id == student_id, Payment.status == PaymentStatus.PENDING)
        ).scalar_one()
    )


def upcoming_events_count(db: Session, student_id: uuid.UUID, user_id: uuid.UUID) -> int:
    from_tickets = select(Ticket.event_id).join(Event, Event.id == Ticket.event_id).where(
        Ticket.holder_user_id == user_id, Event.event_date >= date.today(), Ticket.status != TicketStatus.CANCELLED
    )
    from_activities = (
        select(EventActivity.event_id)
        .join(EventParticipant, EventParticipant.activity_id == EventActivity.id)
        .join(Event, Event.id == EventActivity.event_id)
        .where(EventParticipant.student_id == student_id, Event.event_date >= date.today())
    )
    ids = set(db.execute(from_tickets).scalars().all()) | set(db.execute(from_activities).scalars().all())
    return len(ids)


def recent_certificate_title(db: Session, student_id: uuid.UUID) -> str | None:
    return db.execute(
        select(Certificate.title).where(Certificate.student_id == student_id).order_by(Certificate.issued_date.desc()).limit(1)
    ).scalar_one_or_none()


def attendance_history(db: Session, student_id: uuid.UUID, limit: int = 100) -> list[tuple[AttendanceRecord, str | None, "date"]]:
    rows = db.execute(
        select(AttendanceRecord, Batch.name, ClassSession.session_date)
        .join(ClassSession, ClassSession.id == AttendanceRecord.class_session_id)
        .join(Batch, Batch.id == ClassSession.batch_id)
        .where(AttendanceRecord.student_id == student_id)
        .order_by(ClassSession.session_date.desc())
        .limit(limit)
    ).all()
    return [(r[0], r[1], r[2]) for r in rows]


def performances(db: Session, student_id: uuid.UUID) -> list[tuple[EventParticipant, EventActivity, Event]]:
    rows = db.execute(
        select(EventParticipant, EventActivity, Event)
        .join(EventActivity, EventActivity.id == EventParticipant.activity_id)
        .join(Event, Event.id == EventActivity.event_id)
        .where(EventParticipant.student_id == student_id)
        .order_by(Event.event_date.desc())
    ).all()
    return [(r[0], r[1], r[2]) for r in rows]


def tickets_for_student(db: Session, user_id: uuid.UUID) -> list[Ticket]:
    return db.execute(select(Ticket).where(Ticket.holder_user_id == user_id).order_by(Ticket.created_at.desc())).scalars().all()


def enrollment_history_for_timeline(db: Session, student_id: uuid.UUID):
    from app.models.enrollment import Enrollment, EnrollmentHistory

    return db.execute(
        select(EnrollmentHistory, Batch.name)
        .join(Enrollment, Enrollment.id == EnrollmentHistory.enrollment_id)
        .outerjoin(Batch, Batch.id == EnrollmentHistory.to_batch_id)
        .where(Enrollment.student_id == student_id)
        .order_by(EnrollmentHistory.created_at.desc())
    ).all()
