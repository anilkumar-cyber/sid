import uuid
from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import MembershipScope, MembershipStatus
from app.models.base import BaseModel


class MembershipPlan(BaseModel):
    __tablename__ = "membership_plans"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)  # null = credit-based
    class_credits: Mapped[int | None] = mapped_column(Integer, nullable=True)  # null = unlimited
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    scope: Mapped[MembershipScope] = mapped_column(
        Enum(MembershipScope, name="membership_scope_enum"), default=MembershipScope.SINGLE_BRANCH, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Membership(BaseModel):
    __tablename__ = "memberships"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("membership_plans.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    remaining_credits: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[MembershipStatus] = mapped_column(
        Enum(MembershipStatus, name="membership_status_enum"), default=MembershipStatus.ACTIVE, nullable=False, index=True
    )
    frozen_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    freeze_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    student: Mapped["StudentProfile"] = relationship()
    plan: Mapped["MembershipPlan"] = relationship()
    allowed_branches: Mapped[list["MembershipBranch"]] = relationship(back_populates="membership", cascade="all, delete-orphan")


class MembershipBranch(BaseModel):
    """Branches a multi-branch/all-branch membership is valid in."""

    __tablename__ = "membership_branches"

    membership_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("memberships.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True)

    membership: Mapped["Membership"] = relationship(back_populates="allowed_branches")
    branch: Mapped["Branch"] = relationship()
