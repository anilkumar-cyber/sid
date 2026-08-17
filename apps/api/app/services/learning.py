import secrets
import uuid
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.learning import Certificate, LearningContent, LearningFavorite, StudentAssessment
from app.repositories import learning as repo
from app.utils.storage import save_file, storage_url, validate_upload


def upload_content(db: Session, data: dict, content: bytes, mime_type: str, uploaded_by_id: uuid.UUID) -> LearningContent:
    is_video = mime_type.startswith("video/")
    if mime_type.startswith(("image/", "video/")):
        try:
            validate_upload(mime_type, len(content), expect_video=is_video)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    key = save_file(content, mime_type, subdir="learning")
    item = LearningContent(**data, storage_key=key, uploaded_by_id=uploaded_by_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def content_to_out(db: Session, item: LearningContent, user_id: uuid.UUID) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "content_type": item.content_type,
        "url": storage_url(item.storage_key),
        "course_id": item.course_id,
        "course_level_id": item.course_level_id,
        "batch_id": item.batch_id,
        "is_favorited": repo.is_favorited(db, item.id, user_id),
    }


def toggle_favorite(db: Session, content_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    existing = db.query(LearningFavorite).filter(LearningFavorite.content_id == content_id, LearningFavorite.user_id == user_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return False
    db.add(LearningFavorite(content_id=content_id, user_id=user_id))
    db.commit()
    return True


def add_assessment(db: Session, data: dict, trainer_id: uuid.UUID) -> StudentAssessment:
    assessment = StudentAssessment(**data, trainer_id=trainer_id)
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


def issue_certificate(db: Session, student_id: uuid.UUID, achievement_type: str, title: str) -> Certificate:
    year = datetime.now().year
    cert = Certificate(
        student_id=student_id,
        certificate_number=f"SB-CERT-{year}-{secrets.token_hex(4).upper()}",
        achievement_type=achievement_type,
        title=title,
        issued_date=date.today(),
        verification_code=secrets.token_urlsafe(16),
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert
