from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.learning import Certificate
from app.models.payment import Payment
from app.repositories import student_360 as repo
from app.schemas.finance import MembershipOut
from app.services.attendance import student_attendance_percent


def build_overview(db: Session, student) -> dict:
    membership = repo.current_membership(db, student.id)
    batches = repo.current_batches(db, student.id)
    batch_ids = [b[0] for b in batches]
    next_session = repo.next_class(db, batch_ids)
    stats = student_attendance_percent(db, student.id)

    return {
        "current_membership": MembershipOut.model_validate(membership) if membership else None,
        "current_batches": [{"batch_id": b[0], "batch_name": b[1]} for b in batches],
        "next_class": (
            {
                "class_session_id": next_session.id,
                "batch_name": next_session.batch.name,
                "session_date": next_session.session_date,
                "start_time": next_session.start_time.strftime("%H:%M"),
            }
            if next_session
            else None
        ),
        "attendance_percent": stats["attendance_percent"] if stats["total_sessions"] else None,
        "outstanding_payment_amount": repo.outstanding_payment_amount(db, student.id),
        "upcoming_events_count": repo.upcoming_events_count(db, student.id, student.user_id),
        "recent_certificate_title": repo.recent_certificate_title(db, student.id),
    }


def build_timeline(db: Session, student) -> list[dict]:
    entries: list[dict] = []

    for history, batch_name in repo.enrollment_history_for_timeline(db, student.id):
        label = {
            "enrolled": f"Enrolled in {batch_name}" if batch_name else "Enrolled",
            "waitlisted": f"Waitlisted for {batch_name}" if batch_name else "Waitlisted",
            "transferred": f"Transferred to {batch_name}" if batch_name else "Transferred",
            "cancelled": "Enrollment cancelled",
            "completed": "Completed batch",
        }.get(history.action, history.action)
        entries.append({"date": history.created_at, "type": "enrollment", "title": label, "description": history.notes, "link": "/classes"})

    payments = db.execute(select(Payment).where(Payment.student_id == student.id)).scalars().all()
    for payment in payments:
        entries.append({
            "date": payment.created_at, "type": "payment",
            "title": f"Payment of ₹{payment.amount:,.0f} ({payment.status.value})",
            "description": payment.reference, "link": "/payments",
        })

    certificates = db.execute(select(Certificate).where(Certificate.student_id == student.id)).scalars().all()
    for cert in certificates:
        entries.append({
            "date": cert.created_at, "type": "certificate",
            "title": f"Certificate issued: {cert.title}", "link": f"/students/{student.id}",
        })

    for participant, activity, event in repo.performances(db, student.id):
        entries.append({
            "date": participant.created_at, "type": "event",
            "title": f"Performed in {activity.title} — {event.name}",
            "description": str(event.event_date), "link": f"/events/{event.id}",
        })

    entries.sort(key=lambda e: e["date"], reverse=True)
    return entries
