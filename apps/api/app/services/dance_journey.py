import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.learning import Certificate
from app.repositories import dance_journey as repo
from app.repositories import student_360 as repo_360
from app.services.attendance import student_attendance_percent

CLASS_MILESTONES = [1, 10, 25, 50, 100]


def build_achievements(db: Session, student) -> list[dict]:
    stats = student_attendance_percent(db, student.id)
    present_count = stats["present"] + stats["late"]
    total_sessions = stats["total_sessions"]

    performances = repo_360.performances(db, student.id)
    certificates = db.execute(select(Certificate).where(Certificate.student_id == student.id)).scalars().all()

    achievements: list[dict] = []

    for milestone in CLASS_MILESTONES:
        earned = present_count >= milestone
        achievements.append({
            "id": f"classes_{milestone}",
            "title": "First Class" if milestone == 1 else f"{milestone} Classes",
            "description": f"Attend {milestone} class{'es' if milestone > 1 else ''}",
            "earned": earned,
            "earned_date": None,
        })

    perfect_attendance = total_sessions >= 5 and stats["absent"] == 0
    achievements.append({
        "id": "perfect_attendance",
        "title": "Perfect Attendance",
        "description": "Complete at least 5 tracked sessions with zero absences",
        "earned": perfect_attendance,
        "earned_date": None,
    })

    first_performance = len(performances) > 0
    achievements.append({
        "id": "first_performance",
        "title": "First Performance",
        "description": "Participate in an event performance",
        "earned": first_performance,
        "earned_date": performances[-1][2].event_date if first_performance else None,
    })

    course_completed = any(c.achievement_type == "course_completion" for c in certificates)
    completion_cert = next((c for c in certificates if c.achievement_type == "course_completion"), None)
    achievements.append({
        "id": "course_completed",
        "title": "Course Completed",
        "description": "Earn a course completion certificate",
        "earned": course_completed,
        "earned_date": completion_cert.issued_date if completion_cert else None,
    })

    competition_cert = next((c for c in certificates if c.achievement_type == "competition"), None)
    achievements.append({
        "id": "competition_participant",
        "title": "Competition Participant",
        "description": "Take part in a dance competition",
        "earned": competition_cert is not None,
        "earned_date": competition_cert.issued_date if competition_cert else None,
    })

    return achievements


def build_journey(db: Session, student) -> dict:
    stats = student_attendance_percent(db, student.id)
    performances = repo_360.performances(db, student.id)
    batches = repo_360.current_batches(db, student.id)

    current_course = None
    if batches:
        from app.models.academy import Batch

        batch = db.get(Batch, batches[0][0])
        if batch and batch.course_level and batch.course_level.course:
            current_course = f"{batch.course_level.course.name} — {batch.course_level.name}"

    streak = repo.compute_streak(repo.practiced_dates(db, student.id))

    return {
        "joining_date": student.joining_date,
        "skill_level": student.skill_level,
        "current_course": current_course,
        "classes_attended": stats["present"] + stats["late"],
        "events_participated": len({p[2].id for p in performances}),
        "achievements": build_achievements(db, student),
        "practice_streak": streak,
    }
