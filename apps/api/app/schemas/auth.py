import uuid

from pydantic import BaseModel, EmailStr, Field

from app.core.constants import Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class MeResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    status: str
    home_branch_id: uuid.UUID | None
    avatar_url: str | None
    accessible_branch_ids: list[uuid.UUID]

    model_config = {"from_attributes": True}
