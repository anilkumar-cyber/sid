import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.repositories import learning as repo
from app.schemas.learning import (
    AssessmentCreate,
    AssessmentOut,
    CertificateIssue,
    CertificateOut,
    LearningContentOut,
)
from app.services import learning as service
from app.services.audit import log_action

router = APIRouter(tags=["learning"])

CONTENT_MANAGERS = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)


@router.get("/learning-content", response_model=list[LearningContentOut])
def list_content(
    course_id: uuid.UUID | None = None,
    course_level_id: uuid.UUID | None = None,
    batch_id: uuid.UUID | None = None,
    content_type: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[LearningContentOut]:
    rows = repo.list_content(db, course_id, course_level_id, batch_id, content_type)
    return [LearningContentOut.model_validate(service.content_to_out(db, r, current_user.id)) for r in rows]


@router.post("/learning-content", response_model=LearningContentOut, status_code=201)
async def upload_content(
    title: str = Form(...),
    content_type: str = Form(...),
    description: str | None = Form(None),
    course_id: uuid.UUID | None = Form(None),
    course_level_id: uuid.UUID | None = Form(None),
    batch_id: uuid.UUID | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(CONTENT_MANAGERS),
) -> LearningContentOut:
    content = await file.read()
    item = service.upload_content(
        db,
        {"title": title, "content_type": content_type, "description": description, "course_id": course_id, "course_level_id": course_level_id, "batch_id": batch_id},
        content,
        file.content_type,
        current_user.id,
    )
    log_action(db, current_user.id, "learning_content.uploaded", "learning_content", str(item.id))
    return LearningContentOut.model_validate(service.content_to_out(db, item, current_user.id))


@router.post("/learning-content/{content_id}/favorite")
def toggle_favorite(content_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> dict:
    favorited = service.toggle_favorite(db, content_id, current_user.id)
    return {"favorited": favorited}


@router.get("/students/{student_id}/assessments", response_model=list[AssessmentOut])
def list_assessments(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[AssessmentOut]:
    if current_user.role == Role.STUDENT:
        from app.repositories.student import get_student_by_user_id

        profile = get_student_by_user_id(db, current_user.id)
        if profile is None or profile.id != student_id:
            raise HTTPException(403, "Cannot view another student's assessments")
    return [AssessmentOut.model_validate(a) for a in repo.list_assessments(db, student_id)]


@router.post("/assessments", response_model=AssessmentOut, status_code=201)
def add_assessment(body: AssessmentCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.TRAINER))) -> AssessmentOut:
    assessment = service.add_assessment(db, body.model_dump(), current_user.id)
    log_action(db, current_user.id, "assessment.created", "student_assessment", str(assessment.id))
    return AssessmentOut.model_validate(assessment)


@router.get("/students/{student_id}/certificates", response_model=list[CertificateOut])
def list_certificates(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[CertificateOut]:
    if current_user.role == Role.STUDENT:
        from app.repositories.student import get_student_by_user_id

        profile = get_student_by_user_id(db, current_user.id)
        if profile is None or profile.id != student_id:
            raise HTTPException(403, "Cannot view another student's certificates")
    return [CertificateOut.model_validate(c) for c in repo.list_certificates(db, student_id)]


@router.post("/certificates", response_model=CertificateOut, status_code=201)
def issue_certificate(body: CertificateIssue, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))) -> CertificateOut:
    cert = service.issue_certificate(db, body.student_id, body.achievement_type, body.title)
    log_action(db, current_user.id, "certificate.issued", "certificate", str(cert.id))
    return CertificateOut.model_validate(cert)


@router.get("/certificates/verify/{verification_code}", response_model=CertificateOut)
def verify_certificate(verification_code: str, db: Session = Depends(get_db)) -> CertificateOut:
    """Public endpoint: no auth required, for certificate verification."""
    cert = repo.get_certificate_by_code(db, verification_code)
    if cert is None:
        raise HTTPException(404, "Certificate not found or invalid")
    return CertificateOut.model_validate(cert)
