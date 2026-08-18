import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.constants import PaymentStatus, Role
from app.core.database import get_db
from app.core.deps import assert_branch_access, require_roles
from app.repositories import finance as repo
from app.schemas.common import Page
from app.schemas.finance import PaymentCreate, PaymentOut, PaymentUpdateStatus, RevenueSummary
from app.services import finance as service
from app.services.audit import log_action

router = APIRouter(prefix="/payments", tags=["payments"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
READ = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.STUDENT)


@router.get("", response_model=Page[PaymentOut])
def list_payments(
    branch_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
    status: PaymentStatus | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(READ),
) -> Page[PaymentOut]:
    if current_user.role == Role.STUDENT:
        from app.repositories.student import get_student_by_user_id

        profile = get_student_by_user_id(db, current_user.id)
        if profile is None or (student_id is not None and student_id != profile.id):
            raise HTTPException(403, "Cannot view another student's payments")
        student_id = profile.id
    rows, total = repo.list_payments(db, branch_id, student_id, status, page, page_size)
    return Page(items=[PaymentOut.model_validate(service.payment_to_out(p)) for p in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=PaymentOut, status_code=201)
def record_payment(body: PaymentCreate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> PaymentOut:
    assert_branch_access(db, current_user, body.branch_id)
    payment = service.record_payment(db, body.model_dump(), current_user.id)
    log_action(db, current_user.id, "payment.recorded", "payment", str(payment.id), {"amount": float(payment.amount)})
    return PaymentOut.model_validate(service.payment_to_out(payment))


@router.patch("/{payment_id}/status", response_model=PaymentOut)
def update_status(payment_id: uuid.UUID, body: PaymentUpdateStatus, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> PaymentOut:
    payment = repo.get_payment(db, payment_id)
    if payment is None:
        raise HTTPException(404, "Payment not found")
    payment = service.update_payment_status(db, payment, body.status)
    log_action(db, current_user.id, "payment.status_updated", "payment", str(payment_id), {"status": body.status.value})
    return PaymentOut.model_validate(service.payment_to_out(payment))


@router.get("/summary", response_model=RevenueSummary)
def revenue_summary(branch_id: uuid.UUID | None = None, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> RevenueSummary:
    today = date.today()
    month_start = today.replace(day=1)
    today_revenue = repo.revenue_between(db, branch_id, today, today)
    month_revenue = repo.revenue_between(db, branch_id, month_start, today)
    pending_count, pending_amount = repo.pending_payments_summary(db, branch_id)
    expiring = repo.list_expiring_memberships(db)
    return RevenueSummary(
        today_revenue=today_revenue,
        month_revenue=month_revenue,
        pending_payments_count=pending_count,
        pending_payments_amount=pending_amount,
        expiring_memberships_count=len(expiring),
    )
