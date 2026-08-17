import uuid

from pydantic import BaseModel, EmailStr, Field

from app.core.constants import Role, UserStatus


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    phone: str | None = None
    password: str = Field(min_length=8)
    role: Role
    home_branch_id: uuid.UUID | None = None
    branch_ids: list[uuid.UUID] = Field(default_factory=list)


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    status: UserStatus | None = None
    home_branch_id: uuid.UUID | None = None
    branch_ids: list[uuid.UUID] | None = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    role: Role
    status: UserStatus
    home_branch_id: uuid.UUID | None
    avatar_url: str | None

    model_config = {"from_attributes": True}


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8)
