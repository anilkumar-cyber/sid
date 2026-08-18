import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import TicketStatus
from app.models.event import Event, EventActivity, EventParticipant, TicketType
from app.models.ticket import Ticket


def list_events(db: Session, branch_id: uuid.UUID | None = None):
    query = select(Event).where(Event.deleted_at.is_(None))
    if branch_id:
        query = query.where((Event.branch_id == branch_id) | (Event.branch_id.is_(None)))
    return db.execute(query.order_by(Event.event_date.desc())).scalars().all()


def get_event(db: Session, event_id: uuid.UUID) -> Event | None:
    return db.get(Event, event_id)


def list_activities(db: Session, event_id: uuid.UUID):
    return db.execute(select(EventActivity).where(EventActivity.event_id == event_id).order_by(EventActivity.start_time)).scalars().all()


def get_activity(db: Session, activity_id: uuid.UUID) -> EventActivity | None:
    return db.get(EventActivity, activity_id)


def list_participants(db: Session, activity_id: uuid.UUID):
    return db.execute(select(EventParticipant).where(EventParticipant.activity_id == activity_id)).scalars().all()


def list_ticket_types(db: Session, event_id: uuid.UUID):
    return db.execute(select(TicketType).where(TicketType.event_id == event_id)).scalars().all()


def get_ticket_type(db: Session, ticket_type_id: uuid.UUID) -> TicketType | None:
    return db.get(TicketType, ticket_type_id)


def get_ticket_by_secret(db: Session, qr_secret: str) -> Ticket | None:
    return db.execute(select(Ticket).where(Ticket.qr_secret == qr_secret)).scalar_one_or_none()


def list_tickets_for_holder(db: Session, holder_user_id: uuid.UUID):
    return db.execute(
        select(Ticket).where(Ticket.holder_user_id == holder_user_id).order_by(Ticket.created_at.desc())
    ).scalars().all()


def list_tickets_for_event(db: Session, event_id: uuid.UUID):
    return db.execute(select(Ticket).where(Ticket.event_id == event_id).order_by(Ticket.created_at.desc())).scalars().all()


def event_stats(db: Session, event_id: uuid.UUID) -> dict:
    from app.core.constants import MediaStatus, MediaType
    from app.models.media import Album, MediaAsset

    sold = db.execute(select(func.count()).select_from(Ticket).where(Ticket.event_id == event_id)).scalar_one()
    checked_in = db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.event_id == event_id, Ticket.status == TicketStatus.CHECKED_IN)
    ).scalar_one()
    complimentary = db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.event_id == event_id, Ticket.is_complimentary.is_(True))
    ).scalar_one()
    revenue = db.execute(select(func.coalesce(func.sum(Ticket.amount_paid), 0)).where(Ticket.event_id == event_id)).scalar_one()

    activity_ids = db.execute(select(EventActivity.id).where(EventActivity.event_id == event_id)).scalars().all()
    performances_count = len(activity_ids)
    participants_count = (
        db.execute(select(func.count(func.distinct(EventParticipant.id))).where(EventParticipant.activity_id.in_(activity_ids))).scalar_one()
        if activity_ids
        else 0
    )

    album_filter = Album.event_id == event_id
    if activity_ids:
        album_filter = album_filter | Album.activity_id.in_(activity_ids)
    album_ids = db.execute(select(Album.id).where(album_filter)).scalars().all()
    photos_count = 0
    videos_count = 0
    if album_ids:
        media_counts = db.execute(
            select(MediaAsset.media_type, func.count())
            .where(MediaAsset.album_id.in_(album_ids), MediaAsset.status == MediaStatus.PUBLISHED)
            .group_by(MediaAsset.media_type)
        ).all()
        counts = {row[0]: row[1] for row in media_counts}
        photos_count = counts.get(MediaType.PHOTO, 0)
        videos_count = counts.get(MediaType.VIDEO, 0)

    return {
        "tickets_sold": sold,
        "checked_in": checked_in,
        "no_show": sold - checked_in,
        "complimentary": complimentary,
        "revenue": float(revenue),
        "performances_count": performances_count,
        "participants_count": participants_count,
        "photos_count": photos_count,
        "videos_count": videos_count,
    }


def event_attendance_summary(db: Session, event_id: uuid.UUID) -> dict:
    sold = db.execute(select(func.count()).select_from(Ticket).where(Ticket.event_id == event_id)).scalar_one()
    checked_in = db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.event_id == event_id, Ticket.status == TicketStatus.CHECKED_IN)
    ).scalar_one()
    complimentary = db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.event_id == event_id, Ticket.is_complimentary.is_(True))
    ).scalar_one()
    return {"tickets_sold": sold, "checked_in": checked_in, "no_show": sold - checked_in, "complimentary": complimentary}
