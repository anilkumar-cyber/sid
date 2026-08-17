import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import EnrollmentStatus
from app.models.base import BaseModel


class Enrollment(BaseModel):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("student_id", "batch_id", name="uq_enrollment_student_batch"),)

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True)
    membership_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("memberships.id"), nullable=True)
    status: Mapped[EnrollmentStatus] = mapped_column(
        Enum(EnrollmentStatus, name="enrollment_status_enum"), default=EnrollmentStatus.ACTIVE, nullable=False, index=True
    )
    enrolled_date: Mapped[date] = mapped_column(Date, nullable=False)
    waitlist_position: Mapped[int | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    student: Mapped["StudentProfile"] = relationship()
    batch: Mapped["Batch"] = relationship()


class EnrollmentHistory(BaseModel):
    """Audit trail of enrollment changes: transfers, branch changes, cancellations."""

    __tablename__ = "enrollment_history"

    enrollment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("enrollments.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(nullable=False)  # enrolled | transferred | waitlisted | cancelled | completed
    from_batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    to_batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    performed_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
