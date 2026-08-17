import uuid
from datetime import date, time

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import EventScope, EventStatus
from app.models.base import BaseModel, SoftDeleteMixin


class Event(BaseModel, SoftDeleteMixin):
    __tablename__ = "events"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    venue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True, index=True)
    scope: Mapped[EventScope] = mapped_column(Enum(EventScope, name="event_scope_enum"), default=EventScope.BRANCH, nullable=False)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus, name="event_status_enum"), default=EventStatus.DRAFT, nullable=False)

    activities: Mapped[list["EventActivity"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    ticket_types: Mapped[list["TicketType"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class EventActivity(BaseModel):
    __tablename__ = "event_activities"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    performer_group: Mapped[str | None] = mapped_column(String(200), nullable=True)
    trainer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    event: Mapped["Event"] = relationship(back_populates="activities")
    participants: Mapped[list["EventParticipant"]] = relationship(back_populates="activity", cascade="all, delete-orphan")


class EventParticipant(BaseModel):
    __tablename__ = "event_participants"

    activity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("event_activities.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=True)
    trainer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    guest_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    role: Mapped[str] = mapped_column(String(30), default="performer", nullable=False)  # performer|guest|trainer

    activity: Mapped["EventActivity"] = relationship(back_populates="participants")


class EventPhotographer(BaseModel):
    """Assignment of a photographer user to an event; only assigned photographers may upload media for it."""

    __tablename__ = "event_photographers"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False, index=True)
    photographer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)


class TicketType(BaseModel):
    __tablename__ = "ticket_types"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    price: Mapped[float] = mapped_column(Integer, nullable=False)
    quantity_total: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_sold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    complimentary_quota: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    event: Mapped["Event"] = relationship(back_populates="ticket_types")
