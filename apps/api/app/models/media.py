import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import MediaStatus, MediaType
from app.models.base import BaseModel, SoftDeleteMixin


class Album(BaseModel, SoftDeleteMixin):
    __tablename__ = "albums"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=True, index=True)
    activity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("event_activities.id"), nullable=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    media_assets: Mapped[list["MediaAsset"]] = relationship(back_populates="album", cascade="all, delete-orphan")


class MediaAsset(BaseModel):
    __tablename__ = "media_assets"

    album_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("albums.id"), nullable=False, index=True)
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType, name="media_type_enum"), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[MediaStatus] = mapped_column(
        Enum(MediaStatus, name="media_status_enum"), default=MediaStatus.DRAFT, nullable=False, index=True
    )
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    album: Mapped["Album"] = relationship(back_populates="media_assets")
    tags: Mapped[list["MediaTag"]] = relationship(back_populates="media_asset", cascade="all, delete-orphan")


class MediaTag(BaseModel):
    """Manual tag of a student in a media asset (no AI face recognition)."""

    __tablename__ = "media_tags"

    media_asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True)
    tagged_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    media_asset: Mapped["MediaAsset"] = relationship(back_populates="tags")
