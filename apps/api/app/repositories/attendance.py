import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import EnrollmentStatus
from app.models.attendance import AttendanceCorrectionRequest, AttendanceRecord
from app.models.enrollment import Enrollment
from app.models.student import StudentProfile
from app.models.user import User


def get_roster(db: Session, batch_id: uuid.UUID) -> list[StudentProfile]:
    query = (
        select(StudentProfile)
        .join(Enrollment, Enrollment.student_id == StudentProfile.id)
        .where(Enrollment.batch_id == batch_id, Enrollment.status == EnrollmentStatus.ACTIVE)
    )
    return db.execute(query).scalars().all()


def get_existing_records(db: Session, class_session_id: uuid.UUID) -> dict[uuid.UUID, AttendanceRecord]:
    rows = db.execute(select(AttendanceRecord).where(AttendanceRecord.class_session_id == class_session_id)).scalars().all()
    return {r.student_id: r for r in rows}


def get_attendance_record(db: Session, record_id: uuid.UUID) -> AttendanceRecord | None:
    return db.get(AttendanceRecord, record_id)


def list_student_attendance(db: Session, student_id: uuid.UUID, batch_id: uuid.UUID | None = None):
    query = select(AttendanceRecord).where(AttendanceRecord.student_id == student_id)
    return db.execute(query.order_by(AttendanceRecord.marked_at.desc())).scalars().all()


def list_correction_requests(db: Session, status_filter: str | None = None):
    query = select(AttendanceCorrectionRequest)
    if status_filter:
        query = query.where(AttendanceCorrectionRequest.status == status_filter)
    return db.execute(query.order_by(AttendanceCorrectionRequest.created_at.desc())).scalars().all()


def get_correction_request(db: Session, request_id: uuid.UUID) -> AttendanceCorrectionRequest | None:
    return db.get(AttendanceCorrectionRequest, request_id)
