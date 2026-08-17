import uuid
from datetime import datetime

from pydantic import BaseModel

from app.core.constants import AttendanceStatus


class RosterStudent(BaseModel):
    student_id: uuid.UUID
    full_name: str
    existing_status: AttendanceStatus | None = None


class ClassRoster(BaseModel):
    class_session_id: uuid.UUID
    batch_name: str
    session_date: str
    start_time: str
    already_submitted: bool
    students: list[RosterStudent]


class AttendanceMark(BaseModel):
    student_id: uuid.UUID
    status: AttendanceStatus
    notes: str | None = None


class AttendanceSubmit(BaseModel):
    records: list[AttendanceMark]


class AttendanceRecordOut(BaseModel):
    id: uuid.UUID
    class_session_id: uuid.UUID
    student_id: uuid.UUID
    status: AttendanceStatus
    marked_at: datetime

    model_config = {"from_attributes": True}


class AttendanceSummary(BaseModel):
    present: int
    absent: int
    late: int
    excused: int
    total: int


class AttendanceSubmitResult(BaseModel):
    summary: AttendanceSummary
    records: list[AttendanceRecordOut]


class CorrectionRequestCreate(BaseModel):
    attendance_record_id: uuid.UUID
    requested_status: AttendanceStatus
    reason: str


class CorrectionRequestOut(BaseModel):
    id: uuid.UUID
    attendance_record_id: uuid.UUID
    requested_status: AttendanceStatus
    reason: str
    status: str
    requested_by_id: uuid.UUID

    model_config = {"from_attributes": True}


class StudentAttendanceStat(BaseModel):
    student_id: uuid.UUID
    full_name: str
    present: int
    absent: int
    late: int
    excused: int
    total_sessions: int
    attendance_percent: float
