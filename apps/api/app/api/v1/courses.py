import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import require_roles
from app.repositories import academy as repo
from app.schemas.academy import CourseCreate, CourseLevelCreate, CourseLevelOut, CourseOut
from app.services import academy as service
from app.services.audit import log_action

router = APIRouter(tags=["courses"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN)
READ = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER, Role.STUDENT, Role.PHOTOGRAPHER)


@router.get("/courses", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db), current_user=Depends(READ)) -> list[CourseOut]:
    return [CourseOut.model_validate(c) for c in repo.list_courses(db)]


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(body: CourseCreate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> CourseOut:
    course = service.create_course(db, body.model_dump())
    log_action(db, current_user.id, "course.created", "course", str(course.id))
    return CourseOut.model_validate(course)


@router.get("/course-levels", response_model=list[CourseLevelOut])
def list_course_levels(course_id: uuid.UUID | None = None, db: Session = Depends(get_db), current_user=Depends(READ)) -> list[CourseLevelOut]:
    return [CourseLevelOut.model_validate(c) for c in repo.list_course_levels(db, course_id)]


@router.post("/course-levels", response_model=CourseLevelOut, status_code=201)
def create_course_level(body: CourseLevelCreate, db: Session = Depends(get_db), current_user=Depends(MANAGE)) -> CourseLevelOut:
    level = service.create_course_level(db, body.model_dump())
    log_action(db, current_user.id, "course_level.created", "course_level", str(level.id))
    return CourseLevelOut.model_validate(level)
