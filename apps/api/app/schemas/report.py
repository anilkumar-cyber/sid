import uuid
from datetime import date, datetime

from pydantic import BaseModel


class StudentReport(BaseModel):
    active: int
    inactive: int
    trial: int
    suspended: int
    former: int
    new_this_month: int


class AttendanceReport(BaseModel):
    total_sessions: int
    total_records: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate_percent: float


class BatchOccupancyRow(BaseModel):
    batch_id: uuid.UUID
    batch_name: str
    capacity: int
    enrolled: int
    occupancy_percent: float


class EventReportRow(BaseModel):
    event_id: uuid.UUID
    event_name: str
    tickets_sold: int
    revenue: float
    checked_in: int


class AuditLogOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    entity_type: str
    entity_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
