import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import RefreshToken, User


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def store_refresh_token(db: Session, user_id: uuid.UUID, jti: str, expires_at: datetime) -> RefreshToken:
    token = RefreshToken(user_id=user_id, jti=jti, expires_at=expires_at)
    db.add(token)
    db.commit()
    return token


def get_refresh_token(db: Session, jti: str) -> RefreshToken | None:
    return db.execute(select(RefreshToken).where(RefreshToken.jti == jti)).scalar_one_or_none()


def revoke_refresh_token(db: Session, jti: str) -> None:
    token = get_refresh_token(db, jti)
    if token:
        token.revoked = True
        db.commit()


def is_refresh_token_valid(token: RefreshToken | None) -> bool:
    if token is None or token.revoked:
        return False
    return token.expires_at > datetime.now(timezone.utc)
