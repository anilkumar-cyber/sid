import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.learning import PracticeLog


def log_practice(db: Session, student_id: uuid.UUID, on_date: date) -> bool:
    """Returns True if a new log row was created, False if already logged for that day."""
    existing = db.execute(
        select(PracticeLog).where(PracticeLog.student_id == student_id, PracticeLog.practiced_on == on_date)
    ).scalar_one_or_none()
    if existing:
        return False
    db.add(PracticeLog(student_id=student_id, practiced_on=on_date))
    db.commit()
    return True


def practiced_dates(db: Session, student_id: uuid.UUID) -> list[date]:
    rows = db.execute(
        select(PracticeLog.practiced_on).where(PracticeLog.student_id == student_id).order_by(PracticeLog.practiced_on.desc())
    ).scalars().all()
    return list(rows)


def compute_streak(dates: list[date]) -> dict:
    if not dates:
        return {"current_streak_days": 0, "longest_streak_days": 0, "total_days_logged": 0, "last_practiced_on": None, "practiced_today": False}

    date_set = set(dates)
    today = date.today()
    practiced_today = today in date_set

    # Current streak: walk backward from today (or yesterday if not practiced today) while consecutive days exist.
    current = 0
    cursor = today if practiced_today else today - timedelta(days=1)
    while cursor in date_set:
        current += 1
        cursor -= timedelta(days=1)

    # Longest streak across all logged history.
    sorted_dates = sorted(date_set)
    longest = 1
    run = 1
    for i in range(1, len(sorted_dates)):
        if sorted_dates[i] == sorted_dates[i - 1] + timedelta(days=1):
            run += 1
            longest = max(longest, run)
        else:
            run = 1

    return {
        "current_streak_days": current,
        "longest_streak_days": max(longest, current),
        "total_days_logged": len(date_set),
        "last_practiced_on": max(date_set),
        "practiced_today": practiced_today,
    }
