import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import require_roles
from app.repositories.student import get_trainer, list_trainers
from app.schemas.trainer import TrainerOut, TrainerRegister, TrainerUpdate
from app.services import student as service
from app.services.audit import log_action

router = APIRouter(prefix="/trainers", tags=["trainers"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN)
READ = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER, Role.STUDENT)


@router.get("", response_model=list[TrainerOut])
def list_all_trainers(branch_id: uuid.UUID | None = None, search: str | None = None, db: Session = Depends(get_db), current_user=Depends(READ)) -> list[TrainerOut]:
    rows = list_trainers(db, branch_id, search)
    return [TrainerOut.model_validate(service.trainer_to_out(r)) for r in rows]


@router.post("", response_model=TrainerOut, status_code=201)
def register_trainer(body: TrainerRegister, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> TrainerOut:
    profile = service.register_trainer(db, body.model_dump())
    log_action(db, current_user.id, "trainer.created", "trainer", str(profile.id))
    return TrainerOut.model_validate(service.trainer_to_out(profile))


@router.get("/{trainer_id}", response_model=TrainerOut)
def get_one(trainer_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(READ)) -> TrainerOut:
    profile = get_trainer(db, trainer_id)
    if profile is None:
        raise HTTPException(404, "Trainer not found")
    return TrainerOut.model_validate(service.trainer_to_out(profile))


@router.patch("/{trainer_id}", response_model=TrainerOut)
def update_trainer(trainer_id: uuid.UUID, body: TrainerUpdate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> TrainerOut:
    profile = get_trainer(db, trainer_id)
    if profile is None:
        raise HTTPException(404, "Trainer not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            if k == "full_name" or k == "phone":
                setattr(profile.user, k, v)
            else:
                setattr(profile, k, v)
    db.commit()
    db.refresh(profile)
    log_action(db, current_user.id, "trainer.updated", "trainer", str(trainer_id))
    return TrainerOut.model_validate(service.trainer_to_out(profile))
