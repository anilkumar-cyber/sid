"""Development-only seed data for Sid Bollywood. Never run against production.

Usage: python -m scripts.seed
"""
import sys
from datetime import date, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.constants import (
    EventScope,
    EventStatus,
    MembershipScope,
    MembershipStatus,
    PaymentMethod,
    PaymentStatus,
    Role,
    StudentStatus,
)
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.academy import Batch, BatchSchedule, Course, CourseLevel
from app.models.branch import Branch, Studio
from app.models.event import Event, EventPhotographer, TicketType
from app.models.feed import Post
from app.models.membership import Membership, MembershipPlan
from app.models.payment import Invoice, Payment
from app.models.student import StudentProfile, TrainerProfile
from app.models.user import BranchAccess, User
from app.services.academy import enroll_student, generate_class_sessions

DEMO_PASSWORD = "Welcome@123"


def main() -> None:
    db = SessionLocal()

    if db.query(User).filter(User.email == "superadmin@sidbollywood.com").first():
        print("Seed data already present. Skipping.")
        return

    print("Seeding Sid Bollywood development data...")

    # ---- Branches & Studios ----
    branch_bh = Branch(name="Banjara Hills", code="BH", address="Road No. 12, Banjara Hills, Hyderabad", phone="+91-9000000001", email="banjarahills@sidbollywood.com", opening_hours="7:00 AM - 9:00 PM")
    branch_jh = Branch(name="Jubilee Hills", code="JH", address="Road No. 36, Jubilee Hills, Hyderabad", phone="+91-9000000002", email="jubileehills@sidbollywood.com", opening_hours="7:00 AM - 9:00 PM")
    db.add_all([branch_bh, branch_jh])
    db.flush()

    studio_bh1 = Studio(branch_id=branch_bh.id, name="Studio A", capacity=30)
    studio_jh1 = Studio(branch_id=branch_jh.id, name="Studio A", capacity=25)
    db.add_all([studio_bh1, studio_jh1])
    db.flush()

    # ---- Users ----
    super_admin = User(
        email="superadmin@sidbollywood.com", full_name="Siddharth Rao", hashed_password=hash_password(DEMO_PASSWORD),
        role=Role.SUPER_ADMIN, home_branch_id=branch_bh.id,
    )
    admin_bh = User(
        email="admin.bh@sidbollywood.com", full_name="Anjali Mehta", hashed_password=hash_password(DEMO_PASSWORD),
        role=Role.ADMIN, home_branch_id=branch_bh.id,
    )
    receptionist_bh = User(
        email="reception.bh@sidbollywood.com", full_name="Kavya Reddy", hashed_password=hash_password(DEMO_PASSWORD),
        role=Role.RECEPTIONIST, home_branch_id=branch_bh.id,
    )
    trainer_user = User(
        email="trainer.arjun@sidbollywood.com", full_name="Arjun Verma", hashed_password=hash_password(DEMO_PASSWORD),
        role=Role.TRAINER, home_branch_id=branch_bh.id,
    )
    photographer_user = User(
        email="photo.rahul@sidbollywood.com", full_name="Rahul Khanna", hashed_password=hash_password(DEMO_PASSWORD),
        role=Role.PHOTOGRAPHER, home_branch_id=branch_bh.id,
    )
    db.add_all([super_admin, admin_bh, receptionist_bh, trainer_user, photographer_user])
    db.flush()

    db.add_all([
        BranchAccess(user_id=admin_bh.id, branch_id=branch_bh.id, is_primary=True),
        BranchAccess(user_id=receptionist_bh.id, branch_id=branch_bh.id, is_primary=True),
        BranchAccess(user_id=trainer_user.id, branch_id=branch_bh.id, is_primary=True),
        BranchAccess(user_id=trainer_user.id, branch_id=branch_jh.id, is_primary=False),
        BranchAccess(user_id=photographer_user.id, branch_id=branch_bh.id, is_primary=True),
    ])
    trainer_profile = TrainerProfile(user_id=trainer_user.id, specialization="Bollywood, Hip Hop", experience_years=8, bio="Lead choreographer.")
    db.add(trainer_profile)
    db.flush()

    # ---- Courses ----
    bollywood = Course(name="Bollywood", description="Classic and contemporary Bollywood dance.")
    hiphop = Course(name="Hip Hop", description="Urban hip hop styles.")
    db.add_all([bollywood, hiphop])
    db.flush()

    bw_beginner = CourseLevel(course_id=bollywood.id, name="Beginner", duration_weeks=12)
    bw_inter = CourseLevel(course_id=bollywood.id, name="Intermediate", duration_weeks=12)
    hh_beginner = CourseLevel(course_id=hiphop.id, name="Beginner", duration_weeks=12)
    db.add_all([bw_beginner, bw_inter, hh_beginner])
    db.flush()

    # ---- Batch ----
    batch = Batch(
        name="Bollywood Beginners - Evening", course_level_id=bw_beginner.id, branch_id=branch_bh.id,
        studio_id=studio_bh1.id, trainer_id=trainer_user.id, capacity=25,
    )
    db.add(batch)
    db.flush()
    db.add_all([
        BatchSchedule(batch_id=batch.id, day_of_week=0, start_time=time(18, 0), end_time=time(19, 0)),
        BatchSchedule(batch_id=batch.id, day_of_week=2, start_time=time(18, 0), end_time=time(19, 0)),
    ])
    db.commit()
    generate_class_sessions(db, batch.id, weeks_ahead=8)

    # ---- Membership Plans ----
    plan_monthly = MembershipPlan(name="Monthly Unlimited", description="Unlimited classes for 30 days.", duration_days=30, price=3500, scope=MembershipScope.SINGLE_BRANCH)
    plan_quarterly = MembershipPlan(name="Quarterly Multi-Branch", description="90 days, valid at all branches.", duration_days=90, price=9000, scope=MembershipScope.ALL_BRANCHES)
    db.add_all([plan_monthly, plan_quarterly])
    db.commit()

    # ---- Students ----
    students = []
    student_names = [("Meher Rani", "meher.student@sidbollywood.com"), ("Rohan Kapoor", "rohan.student@sidbollywood.com"), ("Sneha Iyer", "sneha.student@sidbollywood.com")]
    for name, email in student_names:
        u = User(email=email, full_name=name, hashed_password=hash_password(DEMO_PASSWORD), role=Role.STUDENT, home_branch_id=branch_bh.id)
        db.add(u)
        db.flush()
        profile = StudentProfile(user_id=u.id, status=StudentStatus.ACTIVE, joining_date=date.today() - timedelta(days=30), skill_level="Beginner")
        db.add(profile)
        db.flush()
        students.append(profile)
    db.commit()

    membership = Membership(student_id=students[0].id, plan_id=plan_monthly.id, start_date=date.today(), end_date=date.today() + timedelta(days=30), status=MembershipStatus.ACTIVE)
    db.add(membership)
    db.commit()

    for s in students:
        enroll_student(db, s.id, batch.id, membership.id if s.id == students[0].id else None, False, admin_bh.id)

    payment = Payment(
        student_id=students[0].id, branch_id=branch_bh.id, membership_id=membership.id, amount=3500,
        method=PaymentMethod.CASH, status=PaymentStatus.PAID, payment_date=date.today(), recorded_by_id=receptionist_bh.id,
    )
    db.add(payment)
    db.flush()
    db.add(Invoice(payment_id=payment.id, invoice_number=f"INV-{date.today().strftime('%Y%m')}-DEMO0001", issued_date=date.today()))
    db.commit()

    # ---- Event ----
    event = Event(
        name="Annual Day 2026", description="Sid Bollywood's flagship annual showcase.",
        event_date=date.today() + timedelta(days=45), venue="Banjara Hills Community Hall",
        branch_id=branch_bh.id, scope=EventScope.ACADEMY_WIDE, status=EventStatus.PUBLISHED,
    )
    db.add(event)
    db.flush()
    db.add_all([
        TicketType(event_id=event.id, name="VIP", price=1500, quantity_total=100, complimentary_quota=10),
        TicketType(event_id=event.id, name="General", price=500, quantity_total=500, complimentary_quota=20),
    ])
    db.add(EventPhotographer(event_id=event.id, photographer_id=photographer_user.id))
    db.commit()

    # ---- Feed ----
    db.add(Post(author_id=admin_bh.id, caption="Welcome to the new Sid Bollywood community feed! 🎉", is_official=True))
    db.commit()

    print("\nSeed complete. Demo accounts (password for all: %s):\n" % DEMO_PASSWORD)
    print("  Super Admin    superadmin@sidbollywood.com")
    print("  Admin          admin.bh@sidbollywood.com")
    print("  Receptionist   reception.bh@sidbollywood.com")
    print("  Trainer        trainer.arjun@sidbollywood.com")
    print("  Photographer   photo.rahul@sidbollywood.com")
    print("  Student        meher.student@sidbollywood.com")
    db.close()


if __name__ == "__main__":
    main()
