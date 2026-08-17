import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import require_roles
from app.repositories.user import list_users
from app.schemas.common import Page
from app.schemas.user import ResetPasswordRequest, UserCreate, UserOut, UserUpdate
from app.services import user as user_service
from app.services.audit import log_action

router = APIRouter(prefix="/users", tags=["users"])

MANAGE_USERS = require_roles(Role.SUPER_ADMIN, Role.ADMIN)


@router.get("", response_model=Page[UserOut])
def list_all_users(
    role: Role | None = None,
    branch_id: uuid.UUID | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(MANAGE_USERS),
) -> Page[UserOut]:
    rows, total = list_users(db, role, branch_id, search, page, page_size)
    return Page(items=[UserOut.model_validate(r) for r in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db), current_user=Depends(MANAGE_USERS)) -> UserOut:
    user = user_service.register_user(db, body.model_dump())
    log_action(db, current_user.id, "user.created", "user", str(user.id), {"role": user.role.value})
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, body: UserUpdate, db: Session = Depends(get_db), current_user=Depends(MANAGE_USERS)) -> UserOut:
    from app.repositories.auth import get_user_by_id

    user = get_user_by_id(db, user_id)
    if user is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="User not found")
    updated = user_service.update_user(db, user, body.model_dump(exclude_unset=True))
    log_action(db, current_user.id, "user.updated", "user", str(user_id))
    return UserOut.model_validate(updated)


@router.post("/{user_id}/reset-password", status_code=204)
def reset_password(user_id: uuid.UUID, body: ResetPasswordRequest, db: Session = Depends(get_db), current_user=Depends(MANAGE_USERS)) -> None:
    from fastapi import HTTPException

    from app.repositories.auth import get_user_by_id

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user_service.reset_password(db, user, body.new_password)
    log_action(db, current_user.id, "user.password_reset", "user", str(user_id))


@router.post("/{user_id}/activate", response_model=UserOut)
def activate_user(user_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MANAGE_USERS)) -> UserOut:
    return _toggle_active(db, user_id, current_user, True)


@router.post("/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(user_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MANAGE_USERS)) -> UserOut:
    return _toggle_active(db, user_id, current_user, False)


def _toggle_active(db: Session, user_id: uuid.UUID, current_user, is_active: bool) -> UserOut:
    from fastapi import HTTPException

    from app.repositories.auth import get_user_by_id

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    updated = user_service.set_active(db, user, is_active)
    log_action(db, current_user.id, "user.activated" if is_active else "user.deactivated", "user", str(user_id))
    return UserOut.model_validate(updated)
