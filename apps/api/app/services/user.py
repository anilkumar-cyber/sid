import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.repositories.auth import get_user_by_email
from app.repositories.user import create_user, list_users, set_branch_access


def register_user(db: Session, data: dict) -> User:
    if get_user_by_email(db, data["email"]):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    branch_ids = data.pop("branch_ids", [])
    password = data.pop("password")
    user = create_user(db, hashed_password=hash_password(password), email=data.pop("email").lower(), **data)
    if branch_ids:
        set_branch_access(db, user.id, branch_ids)
    return user


def update_user(db: Session, user: User, updates: dict) -> User:
    branch_ids = updates.pop("branch_ids", None)
    for key, value in updates.items():
        if value is not None:
            setattr(user, key, value)
    db.commit()
    db.refresh(user)
    if branch_ids is not None:
        set_branch_access(db, user.id, branch_ids)
    return user


def reset_password(db: Session, user: User, new_password: str) -> None:
    user.hashed_password = hash_password(new_password)
    user.must_change_password = True
    db.commit()


def set_active(db: Session, user: User, is_active: bool) -> User:
    from app.core.constants import UserStatus

    user.status = UserStatus.ACTIVE if is_active else UserStatus.INACTIVE
    db.commit()
    db.refresh(user)
    return user
