import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.constants import Role
from app.core.deps import get_user_branch_ids
from app.models.user import User
from app.repositories import dashboard as repo


def resolve_branch_scope(db: Session, user: User, branch_id: uuid.UUID | None) -> set[uuid.UUID] | None:
    """None => platform-wide (super admin only). Otherwise the set of branch IDs to restrict to."""
    if user.role == Role.SUPER_ADMIN:
        return {branch_id} if branch_id else None
    allowed = get_user_branch_ids(db, user)
    if branch_id is not None:
        if branch_id not in allowed:
            raise PermissionError("You do not have access to this branch")
        return {branch_id}
    return allowed


def build_action_center(db: Session, user: User, branch_id: uuid.UUID | None) -> list[dict]:
    branch_ids = resolve_branch_scope(db, user, branch_id)
    items: list[dict] = []

    pay_count, pay_total = repo.pending_payments(db, branch_ids)
    if pay_count:
        items.append({
            "id": "payments-pending", "category": "payments", "priority": "high",
            "title": f"{pay_count} Pending Payment{'s' if pay_count != 1 else ''}",
            "count": pay_count, "link": "/payments?status=pending",
            "detail": f"₹{pay_total:,.0f} awaiting collection",
        })

    expired = repo.expired_memberships_count(db, branch_ids)
    if expired:
        items.append({
            "id": "memberships-expired", "category": "memberships", "priority": "critical",
            "title": f"{expired} Expired Membership{'s' if expired != 1 else ''}",
            "count": expired, "link": "/memberships?status=expired",
            "detail": "Students may be attending without a valid membership",
        })

    expiring = repo.expiring_memberships_count(db, branch_ids)
    if expiring:
        items.append({
            "id": "memberships-expiring", "category": "memberships", "priority": "high",
            "title": f"{expiring} Membership{'s' if expiring != 1 else ''} Expiring Soon",
            "count": expiring, "link": "/memberships?status=expiring",
            "detail": "Within the next 14 days",
        })

    unsubmitted = repo.unsubmitted_sessions_count(db, branch_ids)
    if unsubmitted:
        items.append({
            "id": "attendance-unsubmitted", "category": "attendance", "priority": "critical",
            "title": f"{unsubmitted} Class{'es' if unsubmitted != 1 else ''} Missing Attendance",
            "count": unsubmitted, "link": "/classes?unsubmitted=true",
            "detail": "Sessions that have passed without attendance submitted",
        })

    corrections = repo.pending_corrections_count(db, branch_ids)
    if corrections:
        items.append({
            "id": "attendance-corrections", "category": "attendance", "priority": "medium",
            "title": f"{corrections} Attendance Correction Request{'s' if corrections != 1 else ''}",
            "count": corrections, "link": "/attendance",
            "detail": "Awaiting review",
        })

    conflicts = repo.schedule_conflicts(db, branch_ids)
    trainer_conflicts = sum(1 for c in conflicts if c["type"] == "trainer")
    studio_conflicts = sum(1 for c in conflicts if c["type"] == "studio")
    if trainer_conflicts:
        items.append({
            "id": "conflicts-trainer", "category": "conflicts", "priority": "critical",
            "title": f"{trainer_conflicts} Trainer Conflict{'s' if trainer_conflicts != 1 else ''}",
            "count": trainer_conflicts, "link": "/batches?health=trainer_conflict",
            "detail": "Same trainer double-booked across overlapping batches",
        })
    if studio_conflicts:
        items.append({
            "id": "conflicts-studio", "category": "conflicts", "priority": "critical",
            "title": f"{studio_conflicts} Studio Conflict{'s' if studio_conflicts != 1 else ''}",
            "count": studio_conflicts, "link": "/batches?health=studio_conflict",
            "detail": "Same studio double-booked across overlapping batches",
        })

    waitlist = repo.waitlisted_count(db, branch_ids)
    if waitlist:
        items.append({
            "id": "waitlist", "category": "waitlist", "priority": "medium" if waitlist >= 5 else "informational",
            "title": f"{waitlist} Student{'s' if waitlist != 1 else ''} on Waitlist",
            "count": waitlist, "link": "/batches?health=high_demand",
            "detail": "Consider opening additional batches for high-demand courses",
        })

    media = repo.pending_media_count(db, branch_ids)
    if media:
        items.append({
            "id": "media-pending", "category": "media", "priority": "medium",
            "title": f"{media} Media Approval{'s' if media != 1 else ''}",
            "count": media, "link": "/media",
            "detail": "Photos/videos awaiting admin review",
        })

    trials = repo.new_trial_students_count(db, branch_ids)
    if trials:
        items.append({
            "id": "trials-new", "category": "trials", "priority": "medium",
            "title": f"{trials} New Trial Student{'s' if trials != 1 else ''}",
            "count": trials, "link": "/students?status=trial",
            "detail": "Joined in the last 7 days — follow up on conversion",
        })

    draft_events = repo.draft_events_needing_publish_count(db, branch_ids)
    if draft_events:
        items.append({
            "id": "events-draft", "category": "events", "priority": "high",
            "title": f"{draft_events} Event{'s' if draft_events != 1 else ''} Still in Draft",
            "count": draft_events, "link": "/events?status=draft",
            "detail": "Event date is within 14 days but the event hasn't been published",
        })

    priority_rank = {"critical": 0, "high": 1, "medium": 2, "informational": 3}
    items.sort(key=lambda i: priority_rank.get(i["priority"], 9))
    return items


def action_center_payload(db: Session, user: User, branch_id: uuid.UUID | None) -> dict:
    return {"items": build_action_center(db, user, branch_id), "generated_at": datetime.now(timezone.utc)}
