import secrets
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import TicketStatus
from app.models.event import Event, EventActivity, EventParticipant, TicketType
from app.models.ticket import Ticket
from app.repositories import event as repo


def create_event(db: Session, data: dict) -> Event:
    event = Event(**data)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def update_event(db: Session, event: Event, updates: dict) -> Event:
    for k, v in updates.items():
        if v is not None:
            setattr(event, k, v)
    db.commit()
    db.refresh(event)
    return event


def create_activity(db: Session, data: dict) -> EventActivity:
    activity = EventActivity(**data)
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def add_participants(db: Session, activity_id: uuid.UUID, student_ids: list[uuid.UUID], trainer_ids: list[uuid.UUID], guest_names: list[str]) -> list[EventParticipant]:
    rows = []
    for sid in student_ids:
        rows.append(EventParticipant(activity_id=activity_id, student_id=sid, role="performer"))
    for tid in trainer_ids:
        rows.append(EventParticipant(activity_id=activity_id, trainer_id=tid, role="trainer"))
    for name in guest_names:
        rows.append(EventParticipant(activity_id=activity_id, guest_name=name, role="guest"))
    db.add_all(rows)
    db.commit()
    for r in rows:
        db.refresh(r)
    return rows


def create_ticket_type(db: Session, data: dict) -> TicketType:
    tt = TicketType(**data)
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return tt


def ticket_type_to_out(tt: TicketType) -> dict:
    return {
        "id": tt.id,
        "event_id": tt.event_id,
        "name": tt.name,
        "price": float(tt.price),
        "quantity_total": tt.quantity_total,
        "quantity_sold": tt.quantity_sold,
        "complimentary_quota": tt.complimentary_quota,
        "available": tt.quantity_total - tt.quantity_sold,
    }


def purchase_ticket(db: Session, ticket_type_id: uuid.UUID, holder_name: str, is_complimentary: bool, holder_user_id: uuid.UUID | None) -> Ticket:
    tt = repo.get_ticket_type(db, ticket_type_id)
    if tt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ticket type not found")
    if tt.quantity_sold >= tt.quantity_total:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="This ticket type is sold out")
    if is_complimentary and tt.complimentary_quota <= 0:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Complimentary ticket quota exhausted")

    year = datetime.now().year
    ticket_number = f"SB{year}-{secrets.token_hex(4).upper()}"
    ticket = Ticket(
        ticket_number=ticket_number,
        ticket_type_id=ticket_type_id,
        event_id=tt.event_id,
        holder_user_id=holder_user_id,
        holder_name=holder_name,
        is_complimentary=is_complimentary,
        amount_paid=0 if is_complimentary else tt.price,
        qr_secret=secrets.token_urlsafe(24),
        status=TicketStatus.VALID,
    )
    db.add(ticket)
    tt.quantity_sold += 1
    if is_complimentary:
        tt.complimentary_quota -= 1
    db.commit()
    db.refresh(ticket)
    return ticket


def cancel_ticket(db: Session, ticket: Ticket) -> Ticket:
    if ticket.status == TicketStatus.CHECKED_IN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot cancel a ticket that has already been checked in")
    ticket.status = TicketStatus.CANCELLED
    tt = repo.get_ticket_type(db, ticket.ticket_type_id)
    tt.quantity_sold = max(0, tt.quantity_sold - 1)
    db.commit()
    db.refresh(ticket)
    return ticket


def validate_and_checkin(db: Session, qr_secret: str, checked_in_by_id: uuid.UUID) -> dict:
    ticket = repo.get_ticket_by_secret(db, qr_secret)
    if ticket is None:
        return {"valid": False, "message": "Ticket not found or invalid QR code", "ticket": None}
    if ticket.status == TicketStatus.CANCELLED:
        return {"valid": False, "message": "This ticket has been cancelled", "ticket": ticket}
    if ticket.status == TicketStatus.CHECKED_IN:
        return {"valid": False, "message": f"Ticket already checked in at {ticket.checked_in_at}", "ticket": ticket}

    ticket.status = TicketStatus.CHECKED_IN
    ticket.checked_in_at = datetime.now(timezone.utc)
    ticket.checked_in_by_id = checked_in_by_id
    db.commit()
    db.refresh(ticket)
    return {"valid": True, "message": "Valid ticket. Entry allowed.", "ticket": ticket}
