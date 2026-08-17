import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import Role, UserStatus
from app.core.database import get_db
from app.core.security import TokenType, decode_token
from app.models.user import BranchAccess, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials") from exc

    if payload.get("type") != TokenType.ACCESS.value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload.get("sub")
    user = db.get(User, uuid.UUID(user_id))
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
    return user


def require_roles(*allowed_roles: Role):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions for this action")
        return current_user

    return dependency


def get_user_branch_ids(db: Session, user: User) -> set[uuid.UUID]:
    """Branch IDs a staff user is authorized to operate in. Super admin => all branches (caller must check role)."""
    rows = db.execute(select(BranchAccess.branch_id).where(BranchAccess.user_id == user.id)).scalars().all()
    branch_ids = set(rows)
    if user.home_branch_id:
        branch_ids.add(user.home_branch_id)
    return branch_ids


def assert_branch_access(db: Session, user: User, branch_id: uuid.UUID) -> None:
    if user.role == Role.SUPER_ADMIN:
        return
    if branch_id not in get_user_branch_ids(db, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this branch")
