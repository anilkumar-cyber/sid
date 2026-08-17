import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import TicketStatus
from app.models.base import BaseModel


class Ticket(BaseModel):
    __tablename__ = "tickets"

    ticket_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    ticket_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ticket_types.id"), nullable=False, index=True)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False, index=True)
    holder_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    holder_name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_complimentary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    qr_secret: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum"), default=TicketStatus.VALID, nullable=False, index=True
    )
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_in_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    ticket_type: Mapped["TicketType"] = relationship()
    event: Mapped["Event"] = relationship()
