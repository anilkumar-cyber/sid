import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.constants import Role, StudentStatus
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.repositories import dance_journey as repo_journey
from app.repositories import student_360 as repo_360
from app.repositories.student import get_student, get_student_by_user_id, list_students
from app.schemas.common import Page
from app.schemas.dance_journey import Achievement, DanceJourney
from app.schemas.event import TicketOut
from app.schemas.student import StudentOut, StudentRegister, StudentUpdate
from app.schemas.student_360 import StudentOverview, StudentPerformanceOut, StudentTimeline
from app.services import dance_journey as service_journey
from app.services import student as service
from app.services import student_360 as service_360
from app.services.audit import log_action

router = APIRouter(prefix="/students", tags=["students"])

MANAGE = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
READ = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER)


def _assert_can_view(db: Session, current_user, student_id: uuid.UUID):
    profile = get_student(db, student_id)
    if profile is None:
        raise HTTPException(404, "Student not found")
    if current_user.role == Role.STUDENT and profile.user_id != current_user.id:
        raise HTTPException(403, "Cannot view another student's data")
    if current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER, Role.STUDENT):
        raise HTTPException(403, "Not permitted to view student data")
    return profile


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


@router.get("/{student_id}/overview", response_model=StudentOverview)
def student_overview(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> StudentOverview:
    profile = _assert_can_view(db, current_user, student_id)
    return StudentOverview.model_validate(service_360.build_overview(db, profile))


@router.get("/{student_id}/timeline", response_model=StudentTimeline)
def student_timeline(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> StudentTimeline:
    profile = _assert_can_view(db, current_user, student_id)
    return StudentTimeline(entries=service_360.build_timeline(db, profile))


@router.get("/{student_id}/performances", response_model=list[StudentPerformanceOut])
def student_performances(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[StudentPerformanceOut]:
    profile = _assert_can_view(db, current_user, student_id)
    rows = repo_360.performances(db, profile.id)
    return [
        StudentPerformanceOut(
            activity_id=activity.id, activity_title=activity.title, event_id=event.id, event_name=event.name,
            event_date=event.event_date, role=participant.role,
        )
        for participant, activity, event in rows
    ]


@router.get("/{student_id}/tickets", response_model=list[TicketOut])
def student_tickets(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[TicketOut]:
    profile = _assert_can_view(db, current_user, student_id)
    tickets = repo_360.tickets_for_student(db, profile.user_id)
    return [TicketOut.model_validate(t) for t in tickets]


@router.get("/{student_id}/journey", response_model=DanceJourney)
def student_journey(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> DanceJourney:
    profile = _assert_can_view(db, current_user, student_id)
    return DanceJourney.model_validate(service_journey.build_journey(db, profile))


@router.get("/{student_id}/achievements", response_model=list[Achievement])
def student_achievements(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[Achievement]:
    profile = _assert_can_view(db, current_user, student_id)
    return [Achievement.model_validate(a) for a in service_journey.build_achievements(db, profile)]


@router.post("/{student_id}/practice", status_code=201)
def log_practice(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.STUDENT))) -> dict:
    from datetime import date

    profile = get_student(db, student_id)
    if profile is None:
        raise HTTPException(404, "Student not found")
    if profile.user_id != current_user.id:
        raise HTTPException(403, "You can only log your own practice")
    created = repo_journey.log_practice(db, student_id, date.today())
    return {"logged": created}
