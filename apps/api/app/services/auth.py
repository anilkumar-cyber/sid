import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_user_branch_ids
from app.core.security import TokenType, create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.repositories.auth import (
    get_refresh_token,
    get_user_by_email,
    get_user_by_id,
    is_refresh_token_valid,
    revoke_refresh_token,
    store_refresh_token,
)
from app.models.user import User


def _issue_tokens(db: Session, user: User) -> tuple[str, str]:
    access_token = create_access_token(str(user.id), user.role.value, str(user.home_branch_id) if user.home_branch_id else None)
    refresh_token = create_refresh_token(str(user.id))
    payload = decode_token(refresh_token)
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    store_refresh_token(db, user.id, payload["jti"], expires_at)
    return access_token, refresh_token


def authenticate(db: Session, email: str, password: str) -> tuple[str, str]:
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if user.status.value != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
    return _issue_tokens(db, user)


def refresh_access_token(db: Session, refresh_token: str) -> tuple[str, str]:
    try:
        payload = decode_token(refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if payload.get("type") != TokenType.REFRESH.value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    token_row = get_refresh_token(db, payload["jti"])
    if not is_refresh_token_valid(token_row):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

    user = get_user_by_id(db, uuid.UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    revoke_refresh_token(db, payload["jti"])  # rotation
    return _issue_tokens(db, user)


def logout(db: Session, refresh_token: str) -> None:
    try:
        payload = decode_token(refresh_token)
        revoke_refresh_token(db, payload["jti"])
    except ValueError:
        pass


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    db.commit()


def build_me_response(db: Session, user: User) -> dict:
    branch_ids = list(get_user_branch_ids(db, user))
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "status": user.status.value,
        "home_branch_id": user.home_branch_id,
        "avatar_url": user.avatar_url,
        "accessible_branch_ids": branch_ids,
    }
