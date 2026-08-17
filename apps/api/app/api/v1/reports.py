import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import AttendanceStatus, PaymentStatus, Role, StudentStatus, TicketStatus
from app.core.database import get_db
from app.core.deps import require_roles
from app.models.academy import Batch
from app.models.attendance import AttendanceRecord
from app.models.audit import AuditLog
from app.models.enrollment import Enrollment
from app.models.event import Event
from app.models.payment import Payment
from app.models.student import StudentProfile
from app.models.ticket import Ticket
from app.repositories import academy as academy_repo
from app.schemas.report import AttendanceReport, AuditLogOut, BatchOccupancyRow, EventReportRow, StudentReport

router = APIRouter(tags=["reports"])

REPORTS_ACCESS = require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)


@router.get("/reports/students", response_model=StudentReport)
def student_report(branch_id: uuid.UUID | None = None, db: Session = Depends(get_db), current_user=Depends(REPORTS_ACCESS)) -> StudentReport:
    from app.models.user import User

    query = select(StudentProfile.status, func.count()).join(User, User.id == StudentProfile.user_id).where(StudentProfile.deleted_at.is_(None))
    if branch_id:
        query = query.where(User.home_branch_id == branch_id)
    query = query.group_by(StudentProfile.status)
    counts = {row[0]: row[1] for row in db.execute(query).all()}

    month_start = date.today().replace(day=1)
    new_query = select(func.count()).select_from(StudentProfile).where(StudentProfile.joining_date >= month_start)
    new_count = db.execute(new_query).scalar_one()

    return StudentReport(
        active=counts.get(StudentStatus.ACTIVE, 0),
        inactive=counts.get(StudentStatus.INACTIVE, 0),
        trial=counts.get(StudentStatus.TRIAL, 0),
        suspended=counts.get(StudentStatus.SUSPENDED, 0),
        former=counts.get(StudentStatus.FORMER, 0),
        new_this_month=new_count,
    )


@router.get("/reports/attendance", response_model=AttendanceReport)
def attendance_report(
    branch_id: uuid.UUID | None = None,
    batch_id: uuid.UUID | None = None,
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(REPORTS_ACCESS),
) -> AttendanceReport:
    from app.models.academy import ClassSession

    query = select(AttendanceRecord.status, func.count()).join(ClassSession, ClassSession.id == AttendanceRecord.class_session_id)
    if branch_id:
        query = query.where(ClassSession.branch_id == branch_id)
    if batch_id:
        query = query.where(ClassSession.batch_id == batch_id)
    if start:
        query = query.where(ClassSession.session_date >= start)
    if end:
        query = query.where(ClassSession.session_date <= end)
    query = query.group_by(AttendanceRecord.status)
    counts = {row[0]: row[1] for row in db.execute(query).all()}

    total_records = sum(counts.values())
    attended = counts.get(AttendanceStatus.PRESENT, 0) + counts.get(AttendanceStatus.LATE, 0)
    rate = round((attended / total_records) * 100, 1) if total_records else 0.0

    sessions_query = select(func.count(func.distinct(AttendanceRecord.class_session_id))).join(
        ClassSession, ClassSession.id == AttendanceRecord.class_session_id
    )
    if branch_id:
        sessions_query = sessions_query.where(ClassSession.branch_id == branch_id)
    total_sessions = db.execute(sessions_query).scalar_one()

    return AttendanceReport(
        total_sessions=total_sessions,
        total_records=total_records,
        present=counts.get(AttendanceStatus.PRESENT, 0),
        absent=counts.get(AttendanceStatus.ABSENT, 0),
        late=counts.get(AttendanceStatus.LATE, 0),
        excused=counts.get(AttendanceStatus.EXCUSED, 0),
        attendance_rate_percent=rate,
    )


@router.get("/reports/occupancy", response_model=list[BatchOccupancyRow])
def occupancy_report(branch_id: uuid.UUID | None = None, db: Session = Depends(get_db), current_user=Depends(REPORTS_ACCESS)) -> list[BatchOccupancyRow]:
    batches = academy_repo.list_batches(db, branch_id, None, None)
    rows = []
    for b in batches:
        enrolled = academy_repo.enrolled_count(db, b.id)
        rows.append(
            BatchOccupancyRow(
                batch_id=b.id,
                batch_name=b.name,
                capacity=b.capacity,
                enrolled=enrolled,
                occupancy_percent=round((enrolled / b.capacity) * 100, 1) if b.capacity else 0.0,
            )
        )
    return rows


@router.get("/reports/events", response_model=list[EventReportRow])
def events_report(db: Session = Depends(get_db), current_user=Depends(REPORTS_ACCESS)) -> list[EventReportRow]:
    events = db.execute(select(Event).where(Event.deleted_at.is_(None)).order_by(Event.event_date.desc())).scalars().all()
    rows = []
    for e in events:
        sold = db.execute(select(func.count()).select_from(Ticket).where(Ticket.event_id == e.id)).scalar_one()
        revenue = db.execute(select(func.coalesce(func.sum(Ticket.amount_paid), 0)).where(Ticket.event_id == e.id)).scalar_one()
        checked_in = db.execute(
            select(func.count()).select_from(Ticket).where(Ticket.event_id == e.id, Ticket.status == TicketStatus.CHECKED_IN)
        ).scalar_one()
        rows.append(EventReportRow(event_id=e.id, event_name=e.name, tickets_sold=sold, revenue=float(revenue), checked_in=checked_in))
    return rows


@router.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    entity_type: str | None = None,
    user_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
) -> list[AuditLogOut]:
    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    return [AuditLogOut.model_validate(a) for a in db.execute(query).scalars().all()]
