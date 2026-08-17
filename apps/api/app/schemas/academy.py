import uuid
from datetime import date, time

from pydantic import BaseModel, Field

from app.core.constants import ClassSessionStatus, EnrollmentStatus


class BranchCreate(BaseModel):
    name: str
    code: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    manager_id: uuid.UUID | None = None
    opening_hours: str | None = None


class BranchUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    manager_id: uuid.UUID | None = None
    opening_hours: str | None = None
    is_active: bool | None = None


class BranchOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    address: str | None
    phone: str | None
    email: str | None
    manager_id: uuid.UUID | None
    opening_hours: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class StudioCreate(BaseModel):
    branch_id: uuid.UUID
    name: str
    capacity: int = 20
    floor_area: str | None = None


class StudioOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    name: str
    capacity: int
    floor_area: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class CourseCreate(BaseModel):
    name: str
    description: str | None = None


class CourseLevelCreate(BaseModel):
    course_id: uuid.UUID
    name: str
    duration_weeks: int | None = None


class CourseOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class CourseLevelOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    name: str
    duration_weeks: int | None

    model_config = {"from_attributes": True}


class BatchScheduleIn(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time


class BatchCreate(BaseModel):
    name: str
    course_level_id: uuid.UUID
    branch_id: uuid.UUID
    studio_id: uuid.UUID | None = None
    trainer_id: uuid.UUID | None = None
    capacity: int = 25
    schedules: list[BatchScheduleIn] = Field(default_factory=list)


class BatchUpdate(BaseModel):
    name: str | None = None
    studio_id: uuid.UUID | None = None
    trainer_id: uuid.UUID | None = None
    capacity: int | None = None
    is_active: bool | None = None


class BatchOut(BaseModel):
    id: uuid.UUID
    name: str
    course_level_id: uuid.UUID
    branch_id: uuid.UUID
    studio_id: uuid.UUID | None
    trainer_id: uuid.UUID | None
    capacity: int
    is_active: bool
    enrolled_count: int = 0
    waitlist_count: int = 0

    model_config = {"from_attributes": True}


class ClassSessionOut(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    batch_name: str | None = None
    branch_id: uuid.UUID
    studio_id: uuid.UUID | None
    trainer_id: uuid.UUID | None
    session_date: date
    start_time: time
    end_time: time
    status: ClassSessionStatus
    student_count: int = 0

    model_config = {"from_attributes": True}


class ClassSessionReschedule(BaseModel):
    session_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    studio_id: uuid.UUID | None = None
    trainer_id: uuid.UUID | None = None
    reason: str | None = None


class ClassSessionCancel(BaseModel):
    reason: str


class EnrollmentCreate(BaseModel):
    student_id: uuid.UUID
    batch_id: uuid.UUID
    membership_id: uuid.UUID | None = None
    override_capacity: bool = False


class EnrollmentTransfer(BaseModel):
    to_batch_id: uuid.UUID
    notes: str | None = None


class EnrollmentOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    batch_id: uuid.UUID
    membership_id: uuid.UUID | None
    status: EnrollmentStatus
    enrolled_date: date
    waitlist_position: int | None

    model_config = {"from_attributes": True}
