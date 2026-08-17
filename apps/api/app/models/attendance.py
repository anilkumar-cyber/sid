import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import AttendanceStatus
from app.models.base import BaseModel


class AttendanceRecord(BaseModel):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("class_session_id", "student_id", name="uq_attendance_session_student"),)

    class_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sessions.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus, name="attendance_status_enum"), nullable=False)
    marked_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    class_session: Mapped["ClassSession"] = relationship()
    student: Mapped["StudentProfile"] = relationship()


class AttendanceCorrectionRequest(BaseModel):
    """Trainer requests a change to already-submitted attendance; admin approves/rejects."""

    __tablename__ = "attendance_correction_requests"

    attendance_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attendance_records.id"), nullable=False, index=True
    )
    requested_status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus, name="attendance_status_enum_req"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    requested_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(default="pending", nullable=False)  # pending | approved | rejected
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
