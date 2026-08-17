import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.constants import StudentStatus
from app.models.student import StudentProfile, TrainerProfile
from app.models.user import User


def list_students(db: Session, branch_id: uuid.UUID | None, status: StudentStatus | None, search: str | None, page: int, page_size: int):
    query = select(StudentProfile).join(User, User.id == StudentProfile.user_id).where(StudentProfile.deleted_at.is_(None))
    if branch_id:
        query = query.where(User.home_branch_id == branch_id)
    if status:
        query = query.where(StudentProfile.status == status)
    if search:
        like = f"%{search}%"
        query = query.where((User.full_name.ilike(like)) | (User.email.ilike(like)))
    total = len(db.execute(query).scalars().all())
    rows = db.execute(query.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return rows, total


def get_student(db: Session, student_id: uuid.UUID) -> StudentProfile | None:
    return db.get(StudentProfile, student_id)


def get_student_by_user_id(db: Session, user_id: uuid.UUID) -> StudentProfile | None:
    return db.execute(select(StudentProfile).where(StudentProfile.user_id == user_id)).scalar_one_or_none()


def list_trainers(db: Session, branch_id: uuid.UUID | None, search: str | None):
    from app.models.user import BranchAccess
    from app.core.constants import Role

    query = select(TrainerProfile).join(User, User.id == TrainerProfile.user_id).where(User.role == Role.TRAINER)
    if branch_id:
        query = query.where(
            (User.home_branch_id == branch_id) | (User.id.in_(select(BranchAccess.user_id).where(BranchAccess.branch_id == branch_id)))
        )
    if search:
        query = query.where(User.full_name.ilike(f"%{search}%"))
    return db.execute(query.order_by(User.full_name)).scalars().all()


def get_trainer(db: Session, trainer_id: uuid.UUID) -> TrainerProfile | None:
    return db.get(TrainerProfile, trainer_id)
