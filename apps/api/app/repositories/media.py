import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import MediaStatus
from app.models.event import EventPhotographer
from app.models.media import Album, MediaAsset, MediaTag


def list_albums(db: Session, event_id: uuid.UUID | None = None, branch_id: uuid.UUID | None = None):
    query = select(Album).where(Album.deleted_at.is_(None))
    if event_id:
        query = query.where(Album.event_id == event_id)
    if branch_id:
        query = query.where(Album.branch_id == branch_id)
    return db.execute(query.order_by(Album.created_at.desc())).scalars().all()


def get_album(db: Session, album_id: uuid.UUID) -> Album | None:
    return db.get(Album, album_id)


def album_media_count(db: Session, album_id: uuid.UUID) -> int:
    return db.execute(select(func.count()).select_from(MediaAsset).where(MediaAsset.album_id == album_id)).scalar_one()


def list_media(db: Session, album_id: uuid.UUID | None, status: MediaStatus | None, uploaded_by_id: uuid.UUID | None):
    query = select(MediaAsset)
    if album_id:
        query = query.where(MediaAsset.album_id == album_id)
    if status:
        query = query.where(MediaAsset.status == status)
    if uploaded_by_id:
        query = query.where(MediaAsset.uploaded_by_id == uploaded_by_id)
    return db.execute(query.order_by(MediaAsset.created_at.desc())).scalars().all()


def get_media(db: Session, media_id: uuid.UUID) -> MediaAsset | None:
    return db.get(MediaAsset, media_id)


def is_photographer_assigned(db: Session, event_id: uuid.UUID, photographer_id: uuid.UUID) -> bool:
    return (
        db.execute(
            select(EventPhotographer).where(EventPhotographer.event_id == event_id, EventPhotographer.photographer_id == photographer_id)
        ).scalar_one_or_none()
        is not None
    )


def assign_photographer(db: Session, event_id: uuid.UUID, photographer_id: uuid.UUID) -> EventPhotographer:
    row = EventPhotographer(event_id=event_id, photographer_id=photographer_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def student_media(db: Session, student_id: uuid.UUID):
    query = (
        select(MediaAsset)
        .join(MediaTag, MediaTag.media_asset_id == MediaAsset.id)
        .where(MediaTag.student_id == student_id, MediaAsset.status == MediaStatus.PUBLISHED)
    )
    return db.execute(query.order_by(MediaAsset.created_at.desc())).scalars().all()
