import uuid
from datetime import date, datetime, time

from pydantic import BaseModel

from app.core.constants import EventScope, EventStatus, TicketStatus


class EventCreate(BaseModel):
    name: str
    description: str | None = None
    banner_url: str | None = None
    event_date: date
    start_time: time | None = None
    end_time: time | None = None
    venue: str | None = None
    branch_id: uuid.UUID | None = None
    scope: EventScope = EventScope.BRANCH


class EventUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    banner_url: str | None = None
    event_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue: str | None = None
    status: EventStatus | None = None


class EventOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    banner_url: str | None
    event_date: date
    start_time: time | None
    end_time: time | None
    venue: str | None
    branch_id: uuid.UUID | None
    scope: EventScope
    status: EventStatus

    model_config = {"from_attributes": True}


class ActivityCreate(BaseModel):
    event_id: uuid.UUID
    start_time: time
    title: str
    description: str | None = None
    performer_group: str | None = None
    trainer_id: uuid.UUID | None = None


class ActivityOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    start_time: time
    title: str
    description: str | None
    performer_group: str | None
    trainer_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class ParticipantAdd(BaseModel):
    student_ids: list[uuid.UUID] = []
    trainer_ids: list[uuid.UUID] = []
    guest_names: list[str] = []


class ParticipantOut(BaseModel):
    id: uuid.UUID
    activity_id: uuid.UUID
    student_id: uuid.UUID | None
    trainer_id: uuid.UUID | None
    guest_name: str | None
    role: str

    model_config = {"from_attributes": True}


class TicketTypeCreate(BaseModel):
    event_id: uuid.UUID
    name: str
    price: float
    quantity_total: int
    complimentary_quota: int = 0


class TicketTypeOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    name: str
    price: float
    quantity_total: int
    quantity_sold: int
    complimentary_quota: int
    available: int = 0

    model_config = {"from_attributes": True}


class TicketPurchase(BaseModel):
    ticket_type_id: uuid.UUID
    holder_name: str
    is_complimentary: bool = False


class TicketOut(BaseModel):
    id: uuid.UUID
    ticket_number: str
    ticket_type_id: uuid.UUID
    event_id: uuid.UUID
    holder_name: str
    is_complimentary: bool
    amount_paid: float
    qr_secret: str
    status: TicketStatus
    checked_in_at: datetime | None

    model_config = {"from_attributes": True}


class TicketValidateRequest(BaseModel):
    qr_secret: str


class TicketValidateResult(BaseModel):
    valid: bool
    message: str
    ticket: TicketOut | None = None


class EventAttendanceSummary(BaseModel):
    tickets_sold: int
    checked_in: int
    no_show: int
    complimentary: int
