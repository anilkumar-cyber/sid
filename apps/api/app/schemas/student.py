import uuid
from datetime import date

from pydantic import BaseModel, EmailStr, Field

from app.core.constants import StudentStatus


class StudentRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8, default="Welcome@123")
    date_of_birth: date | None = None
    gender: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    parent_guardian_name: str | None = None
    parent_guardian_phone: str | None = None
    dance_experience: str | None = None
    skill_level: str | None = None
    home_branch_id: uuid.UUID
    status: StudentStatus = StudentStatus.TRIAL


class StudentUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    parent_guardian_name: str | None = None
    parent_guardian_phone: str | None = None
    dance_experience: str | None = None
    skill_level: str | None = None
    status: StudentStatus | None = None
    home_branch_id: uuid.UUID | None = None


class StudentOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    date_of_birth: date | None
    gender: str | None
    status: StudentStatus
    skill_level: str | None
    home_branch_id: uuid.UUID | None
    joining_date: date

    model_config = {"from_attributes": True}
