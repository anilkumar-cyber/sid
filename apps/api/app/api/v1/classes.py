import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import require_roles
from app.repositories import academy as repo
from app.schemas.academy import ClassSessionCancel, ClassSessionOut, ClassSessionReschedule
from app.services import academy as service
from app.services.audit import log_action

router = APIRouter(prefix="/classes", tags=["classes"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
READ = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER, Role.STUDENT, Role.PHOTOGRAPHER)


def _to_out(db: Session, session) -> ClassSessionOut:
    out = ClassSessionOut.model_validate(session)
    out.batch_name = session.batch.name if session.batch else None
    out.student_count = repo.enrolled_count(db, session.batch_id)
    return out


@router.get("", response_model=list[ClassSessionOut])
def list_classes(
    branch_id: uuid.UUID | None = None,
    trainer_id: uuid.UUID | None = None,
    batch_id: uuid.UUID | None = None,
    on_date: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(READ),
) -> list[ClassSessionOut]:
    rows = repo.list_class_sessions(db, branch_id, trainer_id, batch_id, on_date)
    return [_to_out(db, r) for r in rows]


@router.get("/today", response_model=list[ClassSessionOut])
def todays_classes(db: Session = Depends(get_db), current_user=Depends(READ)) -> list[ClassSessionOut]:
    trainer_id = None
    if current_user.role == Role.TRAINER:
        trainer_id = current_user.id
    rows = repo.list_class_sessions(db, trainer_id=trainer_id, on_date=date.today())
    return [_to_out(db, r) for r in rows]


@router.patch("/{session_id}/reschedule", response_model=ClassSessionOut)
def reschedule(session_id: uuid.UUID, body: ClassSessionReschedule, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> ClassSessionOut:
    session = repo.get_class_session(db, session_id)
    if session is None:
        raise HTTPException(404, "Class session not found")
    session = service.reschedule_class_session(db, session, body.model_dump(exclude_unset=True), current_user)
    log_action(db, current_user.id, "class_session.rescheduled", "class_session", str(session_id))
    return _to_out(db, session)


@router.patch("/{session_id}/cancel", response_model=ClassSessionOut)
def cancel(session_id: uuid.UUID, body: ClassSessionCancel, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> ClassSessionOut:
    session = repo.get_class_session(db, session_id)
    if session is None:
        raise HTTPException(404, "Class session not found")
    session = service.cancel_class_session(db, session, body.reason)
    log_action(db, current_user.id, "class_session.cancelled", "class_session", str(session_id))
    return _to_out(db, session)
