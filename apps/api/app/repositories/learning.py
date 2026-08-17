import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.learning import Certificate, LearningContent, LearningFavorite, StudentAssessment


def list_content(db: Session, course_id=None, course_level_id=None, batch_id=None, content_type=None):
    query = select(LearningContent).where(LearningContent.deleted_at.is_(None), LearningContent.is_published.is_(True))
    if course_id:
        query = query.where(LearningContent.course_id == course_id)
    if course_level_id:
        query = query.where(LearningContent.course_level_id == course_level_id)
    if batch_id:
        query = query.where(LearningContent.batch_id == batch_id)
    if content_type:
        query = query.where(LearningContent.content_type == content_type)
    return db.execute(query.order_by(LearningContent.created_at.desc())).scalars().all()


def get_content(db: Session, content_id: uuid.UUID) -> LearningContent | None:
    return db.get(LearningContent, content_id)


def is_favorited(db: Session, content_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    return (
        db.execute(select(LearningFavorite).where(LearningFavorite.content_id == content_id, LearningFavorite.user_id == user_id)).scalar_one_or_none()
        is not None
    )


def list_assessments(db: Session, student_id: uuid.UUID):
    return db.execute(select(StudentAssessment).where(StudentAssessment.student_id == student_id).order_by(StudentAssessment.created_at.desc())).scalars().all()


def list_certificates(db: Session, student_id: uuid.UUID):
    return db.execute(select(Certificate).where(Certificate.student_id == student_id).order_by(Certificate.issued_date.desc())).scalars().all()


def get_certificate_by_code(db: Session, verification_code: str) -> Certificate | None:
    return db.execute(select(Certificate).where(Certificate.verification_code == verification_code)).scalar_one_or_none()
