import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.constants import MediaStatus, Role
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.repositories import media as repo
from app.schemas.media import (
    AlbumCreate,
    AlbumOut,
    DownloadPermissionUpdate,
    MediaAssetOut,
    MediaRejectRequest,
    MediaTagRequest,
    PhotographerAssign,
    PhotographerOut,
)
from app.services import media as service
from app.services.audit import log_action

router = APIRouter(tags=["media"])

MODERATE = require_roles(Role.SUPER_ADMIN, Role.ADMIN)
UPLOADERS = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER, Role.PHOTOGRAPHER)


@router.get("/albums", response_model=list[AlbumOut])
def list_albums(event_id: uuid.UUID | None = None, branch_id: uuid.UUID | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[AlbumOut]:
    return [AlbumOut.model_validate(service.album_to_out(db, a)) for a in repo.list_albums(db, event_id, branch_id)]


@router.post("/albums", response_model=AlbumOut, status_code=201)
def create_album(body: AlbumCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> AlbumOut:
    album = service.create_album(db, body.model_dump(), current_user.id)
    log_action(db, current_user.id, "album.created", "album", str(album.id))
    return AlbumOut.model_validate(service.album_to_out(db, album))


@router.post("/events/{event_id}/photographers", status_code=201)
def assign_photographer(event_id: uuid.UUID, body: PhotographerAssign, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> dict:
    repo.assign_photographer(db, event_id, body.photographer_id)
    log_action(db, current_user.id, "photographer.assigned", "event", str(event_id), {"photographer_id": str(body.photographer_id)})
    return {"assigned": True}


@router.get("/events/{event_id}/photographers", response_model=list[PhotographerOut])
def list_event_photographers(event_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> list[PhotographerOut]:
    rows = repo.list_assigned_photographers(db, event_id)
    return [PhotographerOut(photographer_id=user.id, full_name=user.full_name, email=user.email) for _, user in rows]


@router.get("/albums/{album_id}/media", response_model=list[MediaAssetOut])
def list_media(album_id: uuid.UUID, status: MediaStatus | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[MediaAssetOut]:
    rows = repo.list_media(db, album_id, status, None)
    if current_user.role == Role.STUDENT:
        rows = [r for r in rows if r.status == MediaStatus.PUBLISHED]
    return [MediaAssetOut.model_validate(service.media_to_out(r)) for r in rows]


@router.post("/albums/{album_id}/media", response_model=MediaAssetOut, status_code=201)
async def upload_media(album_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db), current_user=Depends(UPLOADERS)) -> MediaAssetOut:
    album = repo.get_album(db, album_id)
    if album is None:
        raise HTTPException(404, "Album not found")
    service.assert_can_upload(db, album, current_user)
    content = await file.read()
    asset = service.upload_media(db, album, content, file.content_type, file.filename, current_user.id)
    log_action(db, current_user.id, "media.uploaded", "media_asset", str(asset.id))
    return MediaAssetOut.model_validate(service.media_to_out(asset))


@router.get("/media/pending", response_model=list[MediaAssetOut])
def list_pending(db: Session = Depends(get_db), current_user=Depends(MODERATE)) -> list[MediaAssetOut]:
    rows = repo.list_media(db, None, MediaStatus.PENDING_APPROVAL, None)
    return [MediaAssetOut.model_validate(service.media_to_out(r)) for r in rows]


@router.get("/media", response_model=list[MediaAssetOut])
def list_all_media(status: MediaStatus | None = None, db: Session = Depends(get_db), current_user=Depends(MODERATE)) -> list[MediaAssetOut]:
    rows = repo.list_media(db, None, status, None)
    return [MediaAssetOut.model_validate(service.media_to_out(r)) for r in rows]


@router.post("/media/{media_id}/approve", response_model=MediaAssetOut)
def approve(media_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MODERATE)) -> MediaAssetOut:
    asset = repo.get_media(db, media_id)
    if asset is None:
        raise HTTPException(404, "Media not found")
    asset = service.approve_media(db, asset, current_user.id)
    log_action(db, current_user.id, "media.approved", "media_asset", str(media_id))
    return MediaAssetOut.model_validate(service.media_to_out(asset))


@router.post("/media/{media_id}/reject", response_model=MediaAssetOut)
def reject(media_id: uuid.UUID, body: MediaRejectRequest, db: Session = Depends(get_db), current_user=Depends(MODERATE)) -> MediaAssetOut:
    asset = repo.get_media(db, media_id)
    if asset is None:
        raise HTTPException(404, "Media not found")
    asset = service.reject_media(db, asset, body.reason)
    log_action(db, current_user.id, "media.rejected", "media_asset", str(media_id))
    return MediaAssetOut.model_validate(service.media_to_out(asset))


@router.post("/media/{media_id}/publish", response_model=MediaAssetOut)
def publish(media_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MODERATE)) -> MediaAssetOut:
    asset = repo.get_media(db, media_id)
    if asset is None:
        raise HTTPException(404, "Media not found")
    asset = service.publish_media(db, asset)
    log_action(db, current_user.id, "media.published", "media_asset", str(media_id))
    return MediaAssetOut.model_validate(service.media_to_out(asset))


@router.post("/media/{media_id}/downloads", response_model=MediaAssetOut)
def set_download_permission(
    media_id: uuid.UUID, body: DownloadPermissionUpdate, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))
) -> MediaAssetOut:
    asset = repo.get_media(db, media_id)
    if asset is None:
        raise HTTPException(404, "Media not found")
    asset = service.set_download_permission(db, asset, body.downloads_enabled)
    log_action(db, current_user.id, "media.download_permission_changed", "media_asset", str(media_id), {"downloads_enabled": body.downloads_enabled})
    return MediaAssetOut.model_validate(service.media_to_out(asset))


@router.post("/albums/{album_id}/auto-tag-performers")
def auto_tag_performers(album_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> dict:
    album = repo.get_album(db, album_id)
    if album is None:
        raise HTTPException(404, "Album not found")
    count = service.auto_tag_performers(db, album, current_user.id)
    log_action(db, current_user.id, "media.auto_tagged", "album", str(album_id), {"tags_created": count})
    return {"tags_created": count}


@router.post("/media/{media_id}/tags", status_code=201)
def tag_students(media_id: uuid.UUID, body: MediaTagRequest, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> dict:
    asset = repo.get_media(db, media_id)
    if asset is None:
        raise HTTPException(404, "Media not found")
    tags = service.tag_students(db, asset, body.student_ids, current_user.id)
    log_action(db, current_user.id, "media.tagged", "media_asset", str(media_id), {"count": len(tags)})
    return {"tagged": len(tags)}


@router.get("/students/{student_id}/media", response_model=list[MediaAssetOut])
def student_media(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[MediaAssetOut]:
    if current_user.role == Role.STUDENT:
        from app.repositories.student import get_student_by_user_id

        profile = get_student_by_user_id(db, current_user.id)
        if profile is None or profile.id != student_id:
            raise HTTPException(403, "Cannot view another student's media")
    return [MediaAssetOut.model_validate(service.media_to_out(m)) for m in repo.student_media(db, student_id)]
