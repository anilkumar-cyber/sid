import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.notification import Notification
from app.schemas.notification import NotificationCreate, NotificationOut
from app.services import notification as service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_my_notifications(unread_only: bool = False, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[NotificationOut]:
    return [NotificationOut.model_validate(n) for n in service.list_for_user(db, current_user.id, unread_only)]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> dict:
    return {"count": service.unread_count(db, current_user.id)}


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> NotificationOut:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.id:
        raise HTTPException(404, "Notification not found")
    return NotificationOut.model_validate(service.mark_read(db, notification))


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> dict:
    count = service.mark_all_read(db, current_user.id)
    return {"marked": count}


@router.post("/broadcast", response_model=list[NotificationOut])
def broadcast(body: NotificationCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> list[NotificationOut]:
    rows = service.notify(db, body.user_ids, body.type, body.title, body.body, body.link_url)
    return [NotificationOut.model_validate(n) for n in rows]
