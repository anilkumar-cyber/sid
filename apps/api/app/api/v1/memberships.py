import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import MembershipStatus, Role
from app.core.database import get_db
from app.core.deps import require_roles
from app.repositories import finance as repo
from app.schemas.finance import (
    MembershipCreate,
    MembershipFreeze,
    MembershipOut,
    MembershipPlanCreate,
    MembershipPlanOut,
)
from app.services import finance as service
from app.services.audit import log_action

router = APIRouter(tags=["memberships"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
READ = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.STUDENT)


@router.get("/membership-plans", response_model=list[MembershipPlanOut])
def list_plans(db: Session = Depends(get_db), current_user=Depends(READ)) -> list[MembershipPlanOut]:
    return [MembershipPlanOut.model_validate(p) for p in repo.list_membership_plans(db)]


@router.post("/membership-plans", response_model=MembershipPlanOut, status_code=201)
def create_plan(body: MembershipPlanCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> MembershipPlanOut:
    plan = service.create_membership_plan(db, body.model_dump())
    log_action(db, current_user.id, "membership_plan.created", "membership_plan", str(plan.id))
    return MembershipPlanOut.model_validate(plan)


@router.get("/memberships", response_model=list[MembershipOut])
def list_memberships(student_id: uuid.UUID | None = None, status: MembershipStatus | None = None, db: Session = Depends(get_db), current_user=Depends(READ)) -> list[MembershipOut]:
    return [MembershipOut.model_validate(m) for m in repo.list_memberships(db, student_id, status)]


@router.post("/memberships", response_model=MembershipOut, status_code=201)
def create_membership(body: MembershipCreate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> MembershipOut:
    membership = service.create_membership(db, body.student_id, body.plan_id, body.start_date, body.allowed_branch_ids)
    log_action(db, current_user.id, "membership.created", "membership", str(membership.id))
    return MembershipOut.model_validate(membership)


def _get_or_404(db: Session, membership_id: uuid.UUID):
    membership = repo.get_membership(db, membership_id)
    if membership is None:
        raise HTTPException(404, "Membership not found")
    return membership


@router.post("/memberships/{membership_id}/freeze", response_model=MembershipOut)
def freeze(membership_id: uuid.UUID, body: MembershipFreeze, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> MembershipOut:
    membership = service.freeze_membership(db, _get_or_404(db, membership_id), body.reason)
    log_action(db, current_user.id, "membership.frozen", "membership", str(membership_id))
    return MembershipOut.model_validate(membership)


@router.post("/memberships/{membership_id}/resume", response_model=MembershipOut)
def resume(membership_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> MembershipOut:
    membership = service.resume_membership(db, _get_or_404(db, membership_id))
    log_action(db, current_user.id, "membership.resumed", "membership", str(membership_id))
    return MembershipOut.model_validate(membership)


@router.post("/memberships/{membership_id}/cancel", response_model=MembershipOut)
def cancel(membership_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> MembershipOut:
    membership = service.cancel_membership(db, _get_or_404(db, membership_id))
    log_action(db, current_user.id, "membership.cancelled", "membership", str(membership_id))
    return MembershipOut.model_validate(membership)


@router.post("/memberships/{membership_id}/renew", response_model=MembershipOut)
def renew(membership_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> MembershipOut:
    membership = service.renew_membership(db, _get_or_404(db, membership_id))
    log_action(db, current_user.id, "membership.renewed", "membership", str(membership_id))
    return MembershipOut.model_validate(membership)
