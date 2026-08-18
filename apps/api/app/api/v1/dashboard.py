import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import require_roles
from app.schemas.dashboard import ActionCenterOut
from app.services import dashboard as service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

ACTION_CENTER_ACCESS = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)


@router.get("/action-center", response_model=ActionCenterOut)
def action_center(
    branch_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(ACTION_CENTER_ACCESS),
) -> ActionCenterOut:
    try:
        payload = service.action_center_payload(db, current_user, branch_id)
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    return ActionCenterOut.model_validate(payload)
