import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import StudentStatus
from app.models.base import BaseModel, SoftDeleteMixin


class StudentProfile(BaseModel, SoftDeleteMixin):
    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    parent_guardian_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    parent_guardian_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    dance_experience: Mapped[str | None] = mapped_column(Text, nullable=True)
    skill_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[StudentStatus] = mapped_column(
        Enum(StudentStatus, name="student_status_enum"), default=StudentStatus.TRIAL, nullable=False, index=True
    )
    joining_date: Mapped[date] = mapped_column(Date, nullable=False)

    user: Mapped["User"] = relationship()


class TrainerProfile(BaseModel, SoftDeleteMixin):
    __tablename__ = "trainer_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    specialization: Mapped[str | None] = mapped_column(String(255), nullable=True)
    experience_years: Mapped[int | None] = mapped_column(nullable=True)
    availability: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship()
