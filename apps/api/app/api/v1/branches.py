import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import require_roles
from app.repositories import academy as repo
from app.schemas.academy import BranchCreate, BranchOut, BranchUpdate, StudioCreate, StudioOut
from app.services import academy as service
from app.services.audit import log_action

router = APIRouter(tags=["branches"])

SUPER_ADMIN_ONLY = require_roles(Role.SUPER_ADMIN)
ANY_STAFF = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER, Role.PHOTOGRAPHER)


@router.get("/branches", response_model=list[BranchOut])
def list_branches(active_only: bool = False, db: Session = Depends(get_db), current_user=Depends(ANY_STAFF)) -> list[BranchOut]:
    return [BranchOut.model_validate(b) for b in repo.list_branches(db, active_only)]


@router.post("/branches", response_model=BranchOut, status_code=201)
def create_branch(body: BranchCreate, db: Session = Depends(get_db), current_user=Depends(SUPER_ADMIN_ONLY)) -> BranchOut:
    branch = service.create_branch(db, body.model_dump())
    log_action(db, current_user.id, "branch.created", "branch", str(branch.id))
    return BranchOut.model_validate(branch)


@router.patch("/branches/{branch_id}", response_model=BranchOut)
def update_branch(branch_id: uuid.UUID, body: BranchUpdate, db: Session = Depends(get_db), current_user=Depends(SUPER_ADMIN_ONLY)) -> BranchOut:
    from fastapi import HTTPException

    branch = repo.get_branch(db, branch_id)
    if branch is None:
        raise HTTPException(404, "Branch not found")
    branch = service.update_branch(db, branch, body.model_dump(exclude_unset=True))
    log_action(db, current_user.id, "branch.updated", "branch", str(branch_id))
    return BranchOut.model_validate(branch)


@router.get("/studios", response_model=list[StudioOut])
def list_studios(branch_id: uuid.UUID | None = None, db: Session = Depends(get_db), current_user=Depends(ANY_STAFF)) -> list[StudioOut]:
    return [StudioOut.model_validate(s) for s in repo.list_studios(db, branch_id)]


@router.post("/studios", response_model=StudioOut, status_code=201)
def create_studio(body: StudioCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> StudioOut:
    studio = service.create_studio(db, body.model_dump())
    log_action(db, current_user.id, "studio.created", "studio", str(studio.id))
    return StudioOut.model_validate(studio)
