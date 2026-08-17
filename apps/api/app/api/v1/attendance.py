import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.database import get_db
from app.core.deps import require_roles
from app.repositories import attendance as repo
from app.repositories.academy import get_class_session
from app.schemas.attendance import (
    AttendanceSubmit,
    AttendanceSubmitResult,
    ClassRoster,
    CorrectionRequestCreate,
    CorrectionRequestOut,
    StudentAttendanceStat,
)
from app.services import attendance as service
from app.services.audit import log_action

router = APIRouter(prefix="/attendance", tags=["attendance"])

TAKE_ATTENDANCE = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRAINER)
REVIEW = require_roles(Role.SUPER_ADMIN, Role.ADMIN)


@router.get("/sessions/{session_id}/roster", response_model=ClassRoster)
def get_roster(session_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(TAKE_ATTENDANCE)) -> ClassRoster:
    session = get_class_session(db, session_id)
    if session is None:
        raise HTTPException(404, "Class session not found")
    service.assert_can_take_attendance(session, current_user)
    return ClassRoster.model_validate(service.build_roster(db, session))


@router.post("/sessions/{session_id}/submit", response_model=AttendanceSubmitResult)
def submit(session_id: uuid.UUID, body: AttendanceSubmit, db: Session = Depends(get_db), current_user=Depends(TAKE_ATTENDANCE)) -> AttendanceSubmitResult:
    session = get_class_session(db, session_id)
    if session is None:
        raise HTTPException(404, "Class session not found")
    service.assert_can_take_attendance(session, current_user)
    result = service.submit_attendance(db, session, [m.model_dump() for m in body.records], current_user.id)
    log_action(db, current_user.id, "attendance.submitted", "class_session", str(session_id), {"summary": result["summary"]})
    return AttendanceSubmitResult.model_validate(result)


@router.get("/students/{student_id}/stats", response_model=StudentAttendanceStat)
def student_stats(student_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER, Role.STUDENT))) -> StudentAttendanceStat:
    from app.repositories.student import get_student

    profile = get_student(db, student_id)
    if profile is None:
        raise HTTPException(404, "Student not found")
    if current_user.role == Role.STUDENT and profile.user_id != current_user.id:
        raise HTTPException(403, "Cannot view another student's attendance")
    stats = service.student_attendance_percent(db, student_id)
    return StudentAttendanceStat(student_id=student_id, full_name=profile.user.full_name, **stats)


@router.post("/corrections", response_model=CorrectionRequestOut, status_code=201)
def request_correction(body: CorrectionRequestCreate, db: Session = Depends(get_db), current_user=Depends(TAKE_ATTENDANCE)) -> CorrectionRequestOut:
    req = service.request_correction(db, body.attendance_record_id, body.requested_status, body.reason, current_user.id)
    log_action(db, current_user.id, "attendance.correction_requested", "attendance_correction_request", str(req.id))
    return CorrectionRequestOut.model_validate(req)


@router.get("/corrections", response_model=list[CorrectionRequestOut])
def list_corrections(status: str | None = None, db: Session = Depends(get_db), current_user=Depends(REVIEW)) -> list[CorrectionRequestOut]:
    return [CorrectionRequestOut.model_validate(r) for r in repo.list_correction_requests(db, status)]


@router.post("/corrections/{request_id}/approve", response_model=CorrectionRequestOut)
def approve_correction(request_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(REVIEW)) -> CorrectionRequestOut:
    req = repo.get_correction_request(db, request_id)
    if req is None:
        raise HTTPException(404, "Correction request not found")
    req = service.review_correction(db, req, True, current_user.id)
    log_action(db, current_user.id, "attendance.correction_approved", "attendance_correction_request", str(request_id))
    return CorrectionRequestOut.model_validate(req)


@router.post("/corrections/{request_id}/reject", response_model=CorrectionRequestOut)
def reject_correction(request_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(REVIEW)) -> CorrectionRequestOut:
    req = repo.get_correction_request(db, request_id)
    if req is None:
        raise HTTPException(404, "Correction request not found")
    req = service.review_correction(db, req, False, current_user.id)
    log_action(db, current_user.id, "attendance.correction_rejected", "attendance_correction_request", str(request_id))
    return CorrectionRequestOut.model_validate(req)
