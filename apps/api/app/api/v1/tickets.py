import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.ticket import Ticket
from app.repositories import event as repo
from app.schemas.event import (
    TicketOut,
    TicketPurchase,
    TicketTypeCreate,
    TicketTypeOut,
    TicketValidateRequest,
    TicketValidateResult,
)
from app.services import event as service
from app.services.audit import log_action

router = APIRouter(tags=["tickets"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)


@router.get("/events/{event_id}/ticket-types", response_model=list[TicketTypeOut])
def list_ticket_types(event_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[TicketTypeOut]:
    return [TicketTypeOut.model_validate(service.ticket_type_to_out(t)) for t in repo.list_ticket_types(db, event_id)]


@router.post("/ticket-types", response_model=TicketTypeOut, status_code=201)
def create_ticket_type(body: TicketTypeCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> TicketTypeOut:
    tt = service.create_ticket_type(db, body.model_dump())
    log_action(db, current_user.id, "ticket_type.created", "ticket_type", str(tt.id))
    return TicketTypeOut.model_validate(service.ticket_type_to_out(tt))


@router.get("/tickets/my", response_model=list[TicketOut])
def my_tickets(db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[TicketOut]:
    return [TicketOut.model_validate(t) for t in repo.list_tickets_for_holder(db, current_user.id)]


@router.get("/events/{event_id}/tickets", response_model=list[TicketOut])
def event_tickets(event_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> list[TicketOut]:
    return [TicketOut.model_validate(t) for t in repo.list_tickets_for_event(db, event_id)]


@router.post("/tickets/purchase", response_model=TicketOut, status_code=201)
def purchase(body: TicketPurchase, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> TicketOut:
    if body.is_complimentary and current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST):
        raise HTTPException(403, "Only staff can issue complimentary tickets")
    ticket = service.purchase_ticket(db, body.ticket_type_id, body.holder_name, body.is_complimentary, current_user.id)
    log_action(db, current_user.id, "ticket.purchased", "ticket", str(ticket.id))
    return TicketOut.model_validate(ticket)


@router.post("/tickets/{ticket_id}/cancel", response_model=TicketOut)
def cancel(ticket_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> TicketOut:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(404, "Ticket not found")
    ticket = service.cancel_ticket(db, ticket)
    log_action(db, current_user.id, "ticket.cancelled", "ticket", str(ticket_id))
    return TicketOut.model_validate(ticket)


@router.post("/tickets/validate", response_model=TicketValidateResult)
def validate(body: TicketValidateRequest, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> TicketValidateResult:
    result = service.validate_and_checkin(db, body.qr_secret, current_user.id)
    log_action(db, current_user.id, "ticket.scanned", "ticket", None, {"valid": result["valid"]})
    return TicketValidateResult(
        valid=result["valid"], message=result["message"], ticket=TicketOut.model_validate(result["ticket"]) if result["ticket"] else None
    )
