import uuid

from pydantic import BaseModel, EmailStr, Field


class TrainerRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8, default="Welcome@123")
    specialization: str | None = None
    experience_years: int | None = None
    availability: str | None = None
    bio: str | None = None
    home_branch_id: uuid.UUID
    branch_ids: list[uuid.UUID] = Field(default_factory=list)


class TrainerUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    specialization: str | None = None
    experience_years: int | None = None
    availability: str | None = None
    bio: str | None = None


class TrainerOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    specialization: str | None
    experience_years: int | None
    availability: str | None

    model_config = {"from_attributes": True}
