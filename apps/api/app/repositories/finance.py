import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import MembershipStatus, PaymentStatus
from app.models.membership import Membership, MembershipPlan
from app.models.payment import Invoice, Payment


def list_membership_plans(db: Session, active_only: bool = True):
    query = select(MembershipPlan)
    if active_only:
        query = query.where(MembershipPlan.is_active.is_(True))
    return db.execute(query.order_by(MembershipPlan.name)).scalars().all()


def get_membership_plan(db: Session, plan_id: uuid.UUID) -> MembershipPlan | None:
    return db.get(MembershipPlan, plan_id)


def list_memberships(db: Session, student_id: uuid.UUID | None, status: MembershipStatus | None):
    query = select(Membership)
    if student_id:
        query = query.where(Membership.student_id == student_id)
    if status:
        query = query.where(Membership.status == status)
    return db.execute(query.order_by(Membership.start_date.desc())).scalars().all()


def get_membership(db: Session, membership_id: uuid.UUID) -> Membership | None:
    return db.get(Membership, membership_id)


def list_expiring_memberships(db: Session, within_days: int = 14):
    cutoff = date.today() + timedelta(days=within_days)
    return db.execute(
        select(Membership).where(
            Membership.status == MembershipStatus.ACTIVE,
            Membership.end_date.is_not(None),
            Membership.end_date <= cutoff,
        )
    ).scalars().all()


def list_payments(db: Session, branch_id, student_id, status: PaymentStatus | None, page: int, page_size: int):
    query = select(Payment)
    if branch_id:
        query = query.where(Payment.branch_id == branch_id)
    if student_id:
        query = query.where(Payment.student_id == student_id)
    if status:
        query = query.where(Payment.status == status)
    total = len(db.execute(query).scalars().all())
    rows = db.execute(query.order_by(Payment.payment_date.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return rows, total


def get_payment(db: Session, payment_id: uuid.UUID) -> Payment | None:
    return db.get(Payment, payment_id)


def revenue_between(db: Session, branch_id, start: date, end: date) -> float:
    query = select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == PaymentStatus.PAID, Payment.payment_date >= start, Payment.payment_date <= end
    )
    if branch_id:
        query = query.where(Payment.branch_id == branch_id)
    return float(db.execute(query).scalar_one())


def pending_payments_summary(db: Session, branch_id):
    query = select(func.count(), func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == PaymentStatus.PENDING)
    if branch_id:
        query = query.where(Payment.branch_id == branch_id)
    count, total = db.execute(query).one()
    return count, float(total)
