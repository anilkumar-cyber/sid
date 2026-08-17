from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.security import hash_password
from app.models.student import StudentProfile, TrainerProfile
from app.models.user import BranchAccess, User
from app.repositories.auth import get_user_by_email


def register_student(db: Session, data: dict) -> StudentProfile:
    if get_user_by_email(db, data["email"]):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    from datetime import date

    user = User(
        email=data["email"].lower(),
        full_name=data["full_name"],
        phone=data.get("phone"),
        hashed_password=hash_password(data["password"]),
        role=Role.STUDENT,
        home_branch_id=data["home_branch_id"],
        must_change_password=True,
    )
    db.add(user)
    db.flush()

    profile = StudentProfile(
        user_id=user.id,
        date_of_birth=data.get("date_of_birth"),
        gender=data.get("gender"),
        address=data.get("address"),
        emergency_contact_name=data.get("emergency_contact_name"),
        emergency_contact_phone=data.get("emergency_contact_phone"),
        parent_guardian_name=data.get("parent_guardian_name"),
        parent_guardian_phone=data.get("parent_guardian_phone"),
        dance_experience=data.get("dance_experience"),
        skill_level=data.get("skill_level"),
        status=data.get("status"),
        joining_date=date.today(),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_student(db: Session, profile: StudentProfile, updates: dict) -> StudentProfile:
    user_fields = {"full_name", "phone", "home_branch_id"}
    for key, value in updates.items():
        if value is None:
            continue
        if key in user_fields:
            setattr(profile.user, key, value)
        else:
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


def student_to_out(profile: StudentProfile) -> dict:
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "full_name": profile.user.full_name,
        "email": profile.user.email,
        "phone": profile.user.phone,
        "date_of_birth": profile.date_of_birth,
        "gender": profile.gender,
        "status": profile.status,
        "skill_level": profile.skill_level,
        "home_branch_id": profile.user.home_branch_id,
        "joining_date": profile.joining_date,
    }


def register_trainer(db: Session, data: dict) -> TrainerProfile:
    if get_user_by_email(db, data["email"]):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    branch_ids = data.pop("branch_ids", [])
    user = User(
        email=data["email"].lower(),
        full_name=data["full_name"],
        phone=data.get("phone"),
        hashed_password=hash_password(data["password"]),
        role=Role.TRAINER,
        home_branch_id=data["home_branch_id"],
        must_change_password=True,
    )
    db.add(user)
    db.flush()

    for i, bid in enumerate([data["home_branch_id"], *branch_ids]):
        db.add(BranchAccess(user_id=user.id, branch_id=bid, is_primary=(i == 0)))

    profile = TrainerProfile(
        user_id=user.id,
        specialization=data.get("specialization"),
        experience_years=data.get("experience_years"),
        availability=data.get("availability"),
        bio=data.get("bio"),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def trainer_to_out(profile: TrainerProfile) -> dict:
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "full_name": profile.user.full_name,
        "email": profile.user.email,
        "phone": profile.user.phone,
        "specialization": profile.specialization,
        "experience_years": profile.experience_years,
        "availability": profile.availability,
    }
