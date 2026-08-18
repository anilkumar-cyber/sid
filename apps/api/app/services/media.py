import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import MediaStatus, MediaType, Role
from app.models.media import Album, MediaAsset, MediaTag
from app.models.student import StudentProfile
from app.repositories import media as repo
from app.services import notification as notification_service
from app.utils.storage import generate_thumbnail, save_file, storage_url, validate_upload


def create_album(db: Session, data: dict, created_by_id: uuid.UUID) -> Album:
    album = Album(**data, created_by_id=created_by_id)
    db.add(album)
    db.commit()
    db.refresh(album)
    return album


def album_to_out(db: Session, album: Album) -> dict:
    return {
        "id": album.id,
        "name": album.name,
        "event_id": album.event_id,
        "activity_id": album.activity_id,
        "branch_id": album.branch_id,
        "media_count": repo.album_media_count(db, album.id),
    }


def assert_can_upload(db: Session, album: Album, current_user) -> None:
    if current_user.role == Role.PHOTOGRAPHER:
        if album.event_id is None or not repo.is_photographer_assigned(db, album.event_id, current_user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You are not assigned to this event's media")
    elif current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You are not permitted to upload media")


def upload_media(db: Session, album: Album, content: bytes, mime_type: str, original_filename: str, uploaded_by_id: uuid.UUID) -> MediaAsset:
    is_video = mime_type.startswith("video/")
    try:
        validate_upload(mime_type, len(content), expect_video=is_video)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    storage_key = save_file(content, mime_type, subdir=f"albums/{album.id}")
    thumbnail_key = None if is_video else generate_thumbnail(storage_key)

    asset = MediaAsset(
        album_id=album.id,
        media_type=MediaType.VIDEO if is_video else MediaType.PHOTO,
        storage_key=storage_key,
        thumbnail_key=thumbnail_key,
        original_filename=original_filename,
        mime_type=mime_type,
        size_bytes=len(content),
        uploaded_by_id=uploaded_by_id,
        status=MediaStatus.PENDING_APPROVAL,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def media_to_out(asset: MediaAsset) -> dict:
    return {
        "id": asset.id,
        "album_id": asset.album_id,
        "media_type": asset.media_type,
        "url": storage_url(asset.storage_key),
        "thumbnail_url": storage_url(asset.thumbnail_key),
        "status": asset.status,
        "uploaded_by_id": asset.uploaded_by_id,
        "created_at": asset.created_at,
    }


def approve_media(db: Session, asset: MediaAsset, approved_by_id: uuid.UUID) -> MediaAsset:
    if asset.status != MediaStatus.PENDING_APPROVAL:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Only pending media can be approved")
    asset.status = MediaStatus.APPROVED
    asset.approved_by_id = approved_by_id
    asset.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(asset)
    return asset


def reject_media(db: Session, asset: MediaAsset, reason: str) -> MediaAsset:
    asset.status = MediaStatus.REJECTED
    asset.rejection_reason = reason
    db.commit()
    db.refresh(asset)
    return asset


def publish_media(db: Session, asset: MediaAsset) -> MediaAsset:
    if asset.status != MediaStatus.APPROVED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Only approved media can be published")
    asset.status = MediaStatus.PUBLISHED
    db.commit()
    db.refresh(asset)

    tagged_student_ids = db.execute(select(MediaTag.student_id).where(MediaTag.media_asset_id == asset.id)).scalars().all()
    if tagged_student_ids:
        user_ids = db.execute(select(StudentProfile.user_id).where(StudentProfile.id.in_(tagged_student_ids))).scalars().all()
        if user_ids:
            notification_service.notify(
                db, list(user_ids), type="media.published", title="New photos of you are up!",
                body="Check out the album you were tagged in.", link_url="/media",
            )
    return asset


def tag_students(db: Session, asset: MediaAsset, student_ids: list[uuid.UUID], tagged_by_id: uuid.UUID) -> list[MediaTag]:
    tags = [MediaTag(media_asset_id=asset.id, student_id=sid, tagged_by_id=tagged_by_id) for sid in student_ids]
    db.add_all(tags)
    db.commit()
    return tags
