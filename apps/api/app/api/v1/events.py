import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.repositories import event as repo
from app.schemas.event import (
    ActivityCreate,
    ActivityOut,
    EventAttendanceSummary,
    EventCreate,
    EventOut,
    EventUpdate,
    ParticipantAdd,
    ParticipantOut,
)
from app.services import event as service
from app.services.audit import log_action

router = APIRouter(prefix="/events", tags=["events"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN)


@router.get("", response_model=list[EventOut])
def list_events(branch_id: uuid.UUID | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[EventOut]:
    return [EventOut.model_validate(e) for e in repo.list_events(db, branch_id)]


@router.post("", response_model=EventOut, status_code=201)
def create_event(body: EventCreate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> EventOut:
    event = service.create_event(db, body.model_dump())
    log_action(db, current_user.id, "event.created", "event", str(event.id))
    return EventOut.model_validate(event)


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> EventOut:
    event = repo.get_event(db, event_id)
    if event is None:
        raise HTTPException(404, "Event not found")
    return EventOut.model_validate(event)


@router.patch("/{event_id}", response_model=EventOut)
def update_event(event_id: uuid.UUID, body: EventUpdate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> EventOut:
    event = repo.get_event(db, event_id)
    if event is None:
        raise HTTPException(404, "Event not found")
    event = service.update_event(db, event, body.model_dump(exclude_unset=True))
    log_action(db, current_user.id, "event.updated", "event", str(event_id))
    return EventOut.model_validate(event)


@router.get("/{event_id}/attendance-summary", response_model=EventAttendanceSummary)
def attendance_summary(event_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> EventAttendanceSummary:
    return EventAttendanceSummary(**repo.event_attendance_summary(db, event_id))


@router.get("/{event_id}/activities", response_model=list[ActivityOut])
def list_activities(event_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[ActivityOut]:
    return [ActivityOut.model_validate(a) for a in repo.list_activities(db, event_id)]


@router.post("/activities", response_model=ActivityOut, status_code=201)
def create_activity(body: ActivityCreate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> ActivityOut:
    activity = service.create_activity(db, body.model_dump())
    log_action(db, current_user.id, "event_activity.created", "event_activity", str(activity.id))
    return ActivityOut.model_validate(activity)


@router.get("/activities/{activity_id}/participants", response_model=list[ParticipantOut])
def list_participants(activity_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[ParticipantOut]:
    return [ParticipantOut.model_validate(p) for p in repo.list_participants(db, activity_id)]


@router.post("/activities/{activity_id}/participants", response_model=list[ParticipantOut], status_code=201)
def add_participants(activity_id: uuid.UUID, body: ParticipantAdd, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> list[ParticipantOut]:
    rows = service.add_participants(db, activity_id, body.student_ids, body.trainer_ids, body.guest_names)
    log_action(db, current_user.id, "event_participants.added", "event_activity", str(activity_id), {"count": len(rows)})
    return [ParticipantOut.model_validate(r) for r in rows]
