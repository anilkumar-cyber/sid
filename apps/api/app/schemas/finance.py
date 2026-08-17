import uuid
from datetime import date

from pydantic import BaseModel

from app.core.constants import MembershipScope, MembershipStatus, PaymentMethod, PaymentStatus


class MembershipPlanCreate(BaseModel):
    name: str
    description: str | None = None
    duration_days: int | None = None
    class_credits: int | None = None
    price: float
    scope: MembershipScope = MembershipScope.SINGLE_BRANCH


class MembershipPlanOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    duration_days: int | None
    class_credits: int | None
    price: float
    scope: MembershipScope
    is_active: bool

    model_config = {"from_attributes": True}


class MembershipCreate(BaseModel):
    student_id: uuid.UUID
    plan_id: uuid.UUID
    start_date: date
    allowed_branch_ids: list[uuid.UUID] = []


class MembershipOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    plan_id: uuid.UUID
    start_date: date
    end_date: date | None
    remaining_credits: int | None
    status: MembershipStatus

    model_config = {"from_attributes": True}


class MembershipFreeze(BaseModel):
    reason: str


class PaymentCreate(BaseModel):
    student_id: uuid.UUID
    branch_id: uuid.UUID
    membership_id: uuid.UUID | None = None
    amount: float
    method: PaymentMethod
    payment_date: date
    reference: str | None = None
    notes: str | None = None


class PaymentUpdateStatus(BaseModel):
    status: PaymentStatus


class PaymentOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    branch_id: uuid.UUID
    membership_id: uuid.UUID | None
    amount: float
    method: PaymentMethod
    status: PaymentStatus
    payment_date: date
    reference: str | None
    invoice_number: str | None = None

    model_config = {"from_attributes": True}


class RevenueSummary(BaseModel):
    today_revenue: float
    month_revenue: float
    pending_payments_count: int
    pending_payments_amount: float
    expiring_memberships_count: int
