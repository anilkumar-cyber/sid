import uuid
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import MembershipStatus, PaymentStatus
from app.models.membership import Membership, MembershipBranch, MembershipPlan
from app.models.payment import Invoice, Payment
from app.repositories import finance as repo


def create_membership_plan(db: Session, data: dict) -> MembershipPlan:
    plan = MembershipPlan(**data)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def create_membership(db: Session, student_id: uuid.UUID, plan_id: uuid.UUID, start_date: date, allowed_branch_ids: list[uuid.UUID]) -> Membership:
    plan = repo.get_membership_plan(db, plan_id)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Membership plan not found")

    end_date = start_date + timedelta(days=plan.duration_days) if plan.duration_days else None
    membership = Membership(
        student_id=student_id,
        plan_id=plan_id,
        start_date=start_date,
        end_date=end_date,
        remaining_credits=plan.class_credits,
        status=MembershipStatus.ACTIVE,
    )
    db.add(membership)
    db.flush()
    for bid in allowed_branch_ids:
        db.add(MembershipBranch(membership_id=membership.id, branch_id=bid))
    db.commit()
    db.refresh(membership)
    return membership


def freeze_membership(db: Session, membership: Membership, reason: str) -> Membership:
    if membership.status != MembershipStatus.ACTIVE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Only active memberships can be frozen")
    membership.status = MembershipStatus.FROZEN
    membership.frozen_at = date.today()
    membership.freeze_reason = reason
    db.commit()
    db.refresh(membership)
    return membership


def resume_membership(db: Session, membership: Membership) -> Membership:
    if membership.status != MembershipStatus.FROZEN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Only frozen memberships can be resumed")
    if membership.end_date and membership.frozen_at:
        frozen_days = (date.today() - membership.frozen_at).days
        membership.end_date = membership.end_date + timedelta(days=frozen_days)
    membership.status = MembershipStatus.ACTIVE
    membership.frozen_at = None
    membership.freeze_reason = None
    db.commit()
    db.refresh(membership)
    return membership


def cancel_membership(db: Session, membership: Membership) -> Membership:
    membership.status = MembershipStatus.CANCELLED
    db.commit()
    db.refresh(membership)
    return membership


def renew_membership(db: Session, membership: Membership) -> Membership:
    plan = repo.get_membership_plan(db, membership.plan_id)
    membership.start_date = date.today()
    membership.end_date = date.today() + timedelta(days=plan.duration_days) if plan.duration_days else None
    membership.remaining_credits = plan.class_credits
    membership.status = MembershipStatus.ACTIVE
    db.commit()
    db.refresh(membership)
    return membership


def record_payment(db: Session, data: dict, recorded_by_id: uuid.UUID) -> Payment:
    payment = Payment(**data, recorded_by_id=recorded_by_id, status=PaymentStatus.PAID if data["method"] != "online" else PaymentStatus.PENDING)
    db.add(payment)
    db.flush()

    if payment.status == PaymentStatus.PAID:
        invoice_number = f"INV-{date.today().strftime('%Y%m')}-{str(payment.id)[:8].upper()}"
        db.add(Invoice(payment_id=payment.id, invoice_number=invoice_number, issued_date=date.today()))

    db.commit()
    db.refresh(payment)
    return payment


def update_payment_status(db: Session, payment: Payment, new_status: PaymentStatus) -> Payment:
    payment.status = new_status
    if new_status == PaymentStatus.PAID and payment.invoice is None:
        invoice_number = f"INV-{date.today().strftime('%Y%m')}-{str(payment.id)[:8].upper()}"
        db.add(Invoice(payment_id=payment.id, invoice_number=invoice_number, issued_date=date.today()))
    db.commit()
    db.refresh(payment)
    return payment


def payment_to_out(payment: Payment) -> dict:
    return {
        "id": payment.id,
        "student_id": payment.student_id,
        "branch_id": payment.branch_id,
        "membership_id": payment.membership_id,
        "amount": float(payment.amount),
        "method": payment.method,
        "status": payment.status,
        "payment_date": payment.payment_date,
        "reference": payment.reference,
        "invoice_number": payment.invoice.invoice_number if payment.invoice else None,
    }
