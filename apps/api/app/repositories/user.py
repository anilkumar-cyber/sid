import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.models.user import BranchAccess, User


def list_users(db: Session, role: Role | None, branch_id: uuid.UUID | None, search: str | None, page: int, page_size: int):
    query = select(User).where(User.deleted_at.is_(None))
    if role:
        query = query.where(User.role == role)
    if branch_id:
        query = query.where(
            (User.home_branch_id == branch_id)
            | (User.id.in_(select(BranchAccess.user_id).where(BranchAccess.branch_id == branch_id)))
        )
    if search:
        like = f"%{search}%"
        query = query.where((User.full_name.ilike(like)) | (User.email.ilike(like)))
    total = len(db.execute(query).scalars().all())
    rows = db.execute(query.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return rows, total


def create_user(db: Session, **kwargs) -> User:
    user = User(**kwargs)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def set_branch_access(db: Session, user_id: uuid.UUID, branch_ids: list[uuid.UUID]) -> None:
    db.query(BranchAccess).filter(BranchAccess.user_id == user_id).delete()
    for i, bid in enumerate(branch_ids):
        db.add(BranchAccess(user_id=user_id, branch_id=bid, is_primary=(i == 0)))
    db.commit()
