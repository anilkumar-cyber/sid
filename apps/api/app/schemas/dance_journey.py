from datetime import date

from pydantic import BaseModel


class Achievement(BaseModel):
    id: str
    title: str
    description: str
    earned: bool
    earned_date: date | None = None


class PracticeStreak(BaseModel):
    current_streak_days: int
    longest_streak_days: int
    total_days_logged: int
    last_practiced_on: date | None
    practiced_today: bool


class DanceJourney(BaseModel):
    joining_date: date
    skill_level: str | None
    current_course: str | None
    classes_attended: int
    events_participated: int
    achievements: list[Achievement]
    practice_streak: PracticeStreak
