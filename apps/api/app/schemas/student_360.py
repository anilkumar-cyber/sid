import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.core.constants import AttendanceStatus
from app.schemas.finance import MembershipOut


class CurrentBatchOut(BaseModel):
    batch_id: uuid.UUID
    batch_name: str


class NextClassOut(BaseModel):
    class_session_id: uuid.UUID
    batch_name: str
    session_date: date
    start_time: str


class StudentOverview(BaseModel):
    current_membership: MembershipOut | None
    current_batches: list[CurrentBatchOut]
    next_class: NextClassOut | None
    attendance_percent: float | None
    outstanding_payment_amount: float
    upcoming_events_count: int
    recent_certificate_title: str | None


class TimelineEntry(BaseModel):
    date: datetime
    type: str
    title: str
    description: str | None = None
    link: str | None = None


class StudentTimeline(BaseModel):
    entries: list[TimelineEntry]


class AttendanceHistoryEntry(BaseModel):
    class_session_id: uuid.UUID
    batch_name: str | None
    session_date: date
    status: AttendanceStatus


class StudentPerformanceOut(BaseModel):
    activity_id: uuid.UUID
    activity_title: str
    event_id: uuid.UUID
    event_name: str
    event_date: date
    role: str
