import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class LearningContentOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    content_type: str
    url: str
    course_id: uuid.UUID | None
    course_level_id: uuid.UUID | None
    batch_id: uuid.UUID | None
    is_favorited: bool = False

    model_config = {"from_attributes": True}


class AssessmentCreate(BaseModel):
    student_id: uuid.UUID
    batch_id: uuid.UUID | None = None
    rhythm: int = Field(ge=1, le=5)
    timing: int = Field(ge=1, le=5)
    technique: int = Field(ge=1, le=5)
    expression: int = Field(ge=1, le=5)
    coordination: int = Field(ge=1, le=5)
    performance: int = Field(ge=1, le=5)
    comments: str | None = None


class AssessmentOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    trainer_id: uuid.UUID
    rhythm: int
    timing: int
    technique: int
    expression: int
    coordination: int
    performance: int
    comments: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CertificateIssue(BaseModel):
    student_id: uuid.UUID
    achievement_type: str
    title: str


class CertificateOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    certificate_number: str
    achievement_type: str
    title: str
    issued_date: date
    verification_code: str

    model_config = {"from_attributes": True}
