import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import EnrollmentStatus, Role
from app.core.database import get_db
from app.core.deps import require_roles
from app.repositories import academy as repo
from app.schemas.academy import EnrollmentCreate, EnrollmentOut, EnrollmentTransfer
from app.services import academy as service
from app.services.audit import log_action

router = APIRouter(prefix="/enrollments", tags=["enrollments"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
READ = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER, Role.STUDENT)


@router.get("", response_model=list[EnrollmentOut])
def list_enrollments(
    student_id: uuid.UUID | None = None,
    batch_id: uuid.UUID | None = None,
    status: EnrollmentStatus | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(READ),
) -> list[EnrollmentOut]:
    if current_user.role == Role.STUDENT:
        from app.repositories.student import get_student_by_user_id

        profile = get_student_by_user_id(db, current_user.id)
        if profile is None or (student_id is not None and student_id != profile.id):
            raise HTTPException(403, "Cannot view another student's enrollments")
        student_id = profile.id
    return [EnrollmentOut.model_validate(e) for e in repo.list_enrollments(db, student_id, batch_id, status)]


@router.post("", response_model=EnrollmentOut, status_code=201)
def enroll(body: EnrollmentCreate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> EnrollmentOut:
    enrollment = service.enroll_student(
        db, body.student_id, body.batch_id, body.membership_id, body.override_capacity, current_user.id
    )
    log_action(db, current_user.id, "enrollment.created", "enrollment", str(enrollment.id))
    return EnrollmentOut.model_validate(enrollment)


@router.post("/{enrollment_id}/transfer", response_model=EnrollmentOut)
def transfer(enrollment_id: uuid.UUID, body: EnrollmentTransfer, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> EnrollmentOut:
    enrollment = repo.get_enrollment(db, enrollment_id)
    if enrollment is None:
        raise HTTPException(404, "Enrollment not found")
    enrollment = service.transfer_enrollment(db, enrollment, body.to_batch_id, body.notes, current_user.id)
    log_action(db, current_user.id, "enrollment.transferred", "enrollment", str(enrollment_id))
    return EnrollmentOut.model_validate(enrollment)


@router.post("/{enrollment_id}/cancel", response_model=EnrollmentOut)
def cancel(enrollment_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> EnrollmentOut:
    enrollment = repo.get_enrollment(db, enrollment_id)
    if enrollment is None:
        raise HTTPException(404, "Enrollment not found")
    enrollment = service.cancel_enrollment(db, enrollment, current_user.id)
    log_action(db, current_user.id, "enrollment.cancelled", "enrollment", str(enrollment_id))
    return EnrollmentOut.model_validate(enrollment)
