import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.notification import Notification


def notify(db: Session, user_ids: list[uuid.UUID], type: str, title: str, body: str | None = None, link_url: str | None = None) -> list[Notification]:
    rows = [Notification(user_id=uid, type=type, title=title, body=body, link_url=link_url) for uid in user_ids]
    db.add_all(rows)
    db.commit()
    return rows


def list_for_user(db: Session, user_id: uuid.UUID, unread_only: bool = False):
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    return db.execute(query.order_by(Notification.created_at.desc()).limit(100)).scalars().all()


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    return db.execute(
        select(func.count()).select_from(Notification).where(Notification.user_id == user_id, Notification.is_read.is_(False))
    ).scalar_one()


def mark_read(db: Session, notification: Notification) -> Notification:
    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_read(db: Session, user_id: uuid.UUID) -> int:
    rows = db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read.is_(False)).all()
    for r in rows:
        r.is_read = True
        r.read_at = datetime.now(timezone.utc)
    db.commit()
    return len(rows)
