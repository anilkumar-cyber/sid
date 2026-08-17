import uuid
from datetime import datetime

from pydantic import BaseModel

from app.core.constants import PostVisibility, ReportReason


class PostCreate(BaseModel):
    caption: str | None = None
    visibility: PostVisibility = PostVisibility.ACADEMY
    branch_id: uuid.UUID | None = None
    batch_id: uuid.UUID | None = None
    event_id: uuid.UUID | None = None
    is_official: bool = False


class PostMediaOut(BaseModel):
    id: uuid.UUID
    url: str
    thumbnail_url: str | None
    media_type: str

    model_config = {"from_attributes": True}


class PostOut(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author_name: str
    caption: str | None
    visibility: PostVisibility
    is_official: bool
    comments_disabled: bool
    like_count: int
    comment_count: int
    liked_by_me: bool
    saved_by_me: bool
    media: list[PostMediaOut]
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    body: str


class CommentOut(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    author_id: uuid.UUID
    author_name: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    reason: ReportReason
    details: str | None = None


class ReportOut(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    reported_by_id: uuid.UUID
    reason: ReportReason
    details: str | None
    status: str

    model_config = {"from_attributes": True}
