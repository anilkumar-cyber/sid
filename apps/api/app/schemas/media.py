import uuid
from datetime import datetime

from pydantic import BaseModel

from app.core.constants import MediaStatus, MediaType


class AlbumCreate(BaseModel):
    name: str
    event_id: uuid.UUID | None = None
    activity_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None


class AlbumOut(BaseModel):
    id: uuid.UUID
    name: str
    event_id: uuid.UUID | None
    activity_id: uuid.UUID | None
    branch_id: uuid.UUID | None
    media_count: int = 0

    model_config = {"from_attributes": True}


class MediaAssetOut(BaseModel):
    id: uuid.UUID
    album_id: uuid.UUID
    media_type: MediaType
    url: str
    thumbnail_url: str | None
    status: MediaStatus
    uploaded_by_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class MediaRejectRequest(BaseModel):
    reason: str


class MediaTagRequest(BaseModel):
    student_ids: list[uuid.UUID]


class PhotographerAssign(BaseModel):
    photographer_id: uuid.UUID
