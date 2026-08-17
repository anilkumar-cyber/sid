import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import assert_branch_access, require_roles
from app.repositories import academy as repo
from app.schemas.academy import BatchCreate, BatchOut, BatchUpdate
from app.services import academy as service
from app.services.audit import log_action

router = APIRouter(prefix="/batches", tags=["batches"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
READ = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER, Role.STUDENT, Role.PHOTOGRAPHER)


@router.get("", response_model=list[BatchOut])
def list_batches(
    branch_id: uuid.UUID | None = None,
    course_level_id: uuid.UUID | None = None,
    trainer_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(READ),
) -> list[BatchOut]:
    rows = repo.list_batches(db, branch_id, course_level_id, trainer_id)
    return [BatchOut.model_validate(service.batch_to_out(db, b)) for b in rows]


@router.post("", response_model=BatchOut, status_code=201)
def create_batch(body: BatchCreate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> BatchOut:
    assert_branch_access(db, current_user, body.branch_id)
    data = body.model_dump()
    data["schedules"] = [s for s in data["schedules"]]
    batch = service.create_batch(db, data)
    log_action(db, current_user.id, "batch.created", "batch", str(batch.id))
    return BatchOut.model_validate(service.batch_to_out(db, batch))


@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(batch_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(READ)) -> BatchOut:
    batch = repo.get_batch(db, batch_id)
    if batch is None:
        raise HTTPException(404, "Batch not found")
    return BatchOut.model_validate(service.batch_to_out(db, batch))


@router.patch("/{batch_id}", response_model=BatchOut)
def update_batch(batch_id: uuid.UUID, body: BatchUpdate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> BatchOut:
    batch = repo.get_batch(db, batch_id)
    if batch is None:
        raise HTTPException(404, "Batch not found")
    assert_branch_access(db, current_user, batch.branch_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(batch, k, v)
    db.commit()
    db.refresh(batch)
    log_action(db, current_user.id, "batch.updated", "batch", str(batch_id))
    return BatchOut.model_validate(service.batch_to_out(db, batch))
