import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import AttendanceStatus, Role
from app.models.academy import ClassSession
from app.models.attendance import AttendanceCorrectionRequest, AttendanceRecord
from app.repositories import attendance as repo
from app.services import notification as notification_service


def build_roster(db: Session, session: ClassSession) -> dict:
    roster = repo.get_roster(db, session.batch_id)
    existing = repo.get_existing_records(db, session.id)
    return {
        "class_session_id": session.id,
        "batch_name": session.batch.name,
        "session_date": str(session.session_date),
        "start_time": str(session.start_time),
        "already_submitted": session.attendance_submitted_at is not None,
        "students": [
            {
                "student_id": s.id,
                "full_name": s.user.full_name,
                "existing_status": existing[s.id].status if s.id in existing else None,
            }
            for s in roster
        ],
    }


def assert_can_take_attendance(session: ClassSession, current_user) -> None:
    if current_user.role == Role.TRAINER and session.trainer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only the trainer assigned to this class can take attendance")
    if current_user.role not in (Role.TRAINER, Role.SUPER_ADMIN, Role.ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You are not permitted to take attendance")


def submit_attendance(db: Session, session: ClassSession, marks: list[dict], marked_by_id: uuid.UUID) -> dict:
    roster_ids = {s.id for s in repo.get_roster(db, session.batch_id)}
    existing = repo.get_existing_records(db, session.id)
    now = datetime.now(timezone.utc)

    records = []
    for mark in marks:
        if mark["student_id"] not in roster_ids:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Student {mark['student_id']} is not enrolled in this class")
        if mark["student_id"] in existing:
            record = existing[mark["student_id"]]
            record.status = mark["status"]
            record.notes = mark.get("notes")
            record.marked_by_id = marked_by_id
            record.marked_at = now
        else:
            record = AttendanceRecord(
                class_session_id=session.id,
                student_id=mark["student_id"],
                status=mark["status"],
                notes=mark.get("notes"),
                marked_by_id=marked_by_id,
                marked_at=now,
            )
            db.add(record)
        records.append(record)

    session.attendance_submitted_at = now
    db.commit()
    for r in records:
        db.refresh(r)

    summary = {"present": 0, "absent": 0, "late": 0, "excused": 0, "total": len(records)}
    for r in records:
        summary[r.status.value] += 1

    return {"summary": summary, "records": records}


def request_correction(db: Session, attendance_record_id: uuid.UUID, requested_status: AttendanceStatus, reason: str, requested_by_id: uuid.UUID) -> AttendanceCorrectionRequest:
    record = repo.get_attendance_record(db, attendance_record_id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Attendance record not found")
    req = AttendanceCorrectionRequest(
        attendance_record_id=attendance_record_id,
        requested_status=requested_status,
        reason=reason,
        requested_by_id=requested_by_id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def review_correction(db: Session, request: AttendanceCorrectionRequest, approve: bool, reviewed_by_id: uuid.UUID) -> AttendanceCorrectionRequest:
    if request.status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Correction request already reviewed")
    request.status = "approved" if approve else "rejected"
    request.reviewed_by_id = reviewed_by_id
    request.reviewed_at = datetime.now(timezone.utc)
    if approve:
        record = repo.get_attendance_record(db, request.attendance_record_id)
        record.status = request.requested_status
        record.marked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(request)
    notification_service.notify(
        db, [request.requested_by_id], type="attendance.correction_reviewed",
        title=f"Correction request {request.status}",
        body="Your attendance correction request was " + request.status + ".",
        link_url="/attendance",
    )
    return request


def student_attendance_percent(db: Session, student_id: uuid.UUID) -> dict:
    records = repo.list_student_attendance(db, student_id)
    counts = {"present": 0, "absent": 0, "late": 0, "excused": 0}
    for r in records:
        counts[r.status.value] += 1
    total = len(records)
    attended = counts["present"] + counts["late"]
    percent = round((attended / total) * 100, 1) if total else 0.0
    return {"total_sessions": total, "attendance_percent": percent, **counts}
