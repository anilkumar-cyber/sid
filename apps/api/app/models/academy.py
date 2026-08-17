import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, SmallInteger, String, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ClassSessionStatus
from app.models.base import BaseModel, SoftDeleteMixin


class Course(BaseModel, SoftDeleteMixin):
    """A dance style, e.g. Bollywood, Hip Hop."""

    __tablename__ = "courses"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CourseLevel(BaseModel):
    """A level within a course, e.g. Beginner, Intermediate, Advanced."""

    __tablename__ = "course_levels"
    __table_args__ = (UniqueConstraint("course_id", "name", name="uq_course_level_name"),)

    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    duration_weeks: Mapped[int | None] = mapped_column(Integer, nullable=True)

    course: Mapped["Course"] = relationship()


class Batch(BaseModel, SoftDeleteMixin):
    __tablename__ = "batches"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    course_level_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("course_levels.id"), nullable=False)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True)
    studio_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("studios.id"), nullable=True)
    trainer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    course_level: Mapped["CourseLevel"] = relationship()
    branch: Mapped["Branch"] = relationship()
    studio: Mapped["Studio | None"] = relationship()
    schedules: Mapped[list["BatchSchedule"]] = relationship(back_populates="batch", cascade="all, delete-orphan")


class BatchSchedule(BaseModel):
    """Recurring weekly slot, e.g. Monday 18:00-19:00, used to auto-generate ClassSessions."""

    __tablename__ = "batch_schedules"

    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=Monday ... 6=Sunday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    batch: Mapped["Batch"] = relationship(back_populates="schedules")


class ClassSession(BaseModel):
    """A single dated occurrence of a batch's class, generated from BatchSchedule."""

    __tablename__ = "class_sessions"
    __table_args__ = (UniqueConstraint("batch_id", "session_date", "start_time", name="uq_class_session_slot"),)

    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True)
    studio_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("studios.id"), nullable=True)
    trainer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    status: Mapped[ClassSessionStatus] = mapped_column(
        Enum(ClassSessionStatus, name="class_session_status_enum"), default=ClassSessionStatus.SCHEDULED, nullable=False
    )
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    attendance_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    batch: Mapped["Batch"] = relationship()
    trainer: Mapped["User | None"] = relationship()
