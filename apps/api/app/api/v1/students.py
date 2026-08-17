import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.constants import Role, StudentStatus
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.repositories.student import get_student, get_student_by_user_id, list_students
from app.schemas.common import Page
from app.schemas.student import StudentOut, StudentRegister, StudentUpdate
from app.services import student as service
from app.services.audit import log_action

router = APIRouter(prefix="/students", tags=["students"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
READ = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER)


@router.get("", response_model=Page[StudentOut])
def list_all_students(
    branch_id: uuid.UUID | None = None,
    status: StudentStatus | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(READ),
) -> Page[StudentOut]:
    rows, total = list_students(db, branch_id, status, search, page, page_size)
    return Page(items=[StudentOut.model_validate(service.student_to_out(r)) for r in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=StudentOut, status_code=201)
def register_student(body: StudentRegister, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> StudentOut:
    profile = service.register_student(db, body.model_dump())
    log_action(db, current_user.id, "student.created", "student", str(profile.id))
    return StudentOut.model_validate(service.student_to_out(profile))


@router.get("/me", response_model=StudentOut)
def my_profile(db: Session = Depends(get_db), current_user=Depends(require_roles(Role.STUDENT))) -> StudentOut:
    profile = get_student_by_user_id(db, current_user.id)
    if profile is None:
        raise HTTPException(404, "Student profile not found")
    return StudentOut.model_validate(service.student_to_out(profile))


@router.get("/{student_id}", response_model=StudentOut)
def get_one(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> StudentOut:
    profile = get_student(db, student_id)
    if profile is None:
        raise HTTPException(404, "Student not found")
    if current_user.role == Role.STUDENT and profile.user_id != current_user.id:
        raise HTTPException(403, "Cannot view another student's profile")
    return StudentOut.model_validate(service.student_to_out(profile))


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(student_id: uuid.UUID, body: StudentUpdate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> StudentOut:
    profile = get_student(db, student_id)
    if profile is None:
        raise HTTPException(404, "Student not found")
    profile = service.update_student(db, profile, body.model_dump(exclude_unset=True))
    log_action(db, current_user.id, "student.updated", "student", str(student_id))
    return StudentOut.model_validate(service.student_to_out(profile))
