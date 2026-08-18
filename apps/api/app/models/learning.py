import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin


class LearningContent(BaseModel, SoftDeleteMixin):
    __tablename__ = "learning_content"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_type: Mapped[str] = mapped_column(String(20), nullable=False)  # practice|choreography|music|notes
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    course_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=True)
    course_level_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("course_levels.id"), nullable=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class LearningFavorite(BaseModel):
    __tablename__ = "learning_favorites"
    __table_args__ = (UniqueConstraint("content_id", "user_id", name="uq_learning_favorite"),)

    content_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("learning_content.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)


class StudentAssessment(BaseModel):
    __tablename__ = "student_assessments"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    trainer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    rhythm: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1-5
    timing: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    technique: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    expression: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    coordination: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    performance: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)


class PracticeLog(BaseModel):
    """Minimal practice-streak tracking: one row per student per day they logged practice."""

    __tablename__ = "practice_logs"
    __table_args__ = (UniqueConstraint("student_id", "practiced_on", name="uq_practice_log_student_date"),)

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    practiced_on: Mapped[date] = mapped_column(Date, nullable=False)


class Certificate(BaseModel):
    __tablename__ = "certificates"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    certificate_number: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    achievement_type: Mapped[str] = mapped_column(String(40), nullable=False)  # course_completion|event_participation|competition
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    issued_date: Mapped[date] = mapped_column(Date, nullable=False)
    verification_code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    pdf_storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
