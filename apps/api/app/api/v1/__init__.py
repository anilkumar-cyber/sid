from fastapi import APIRouter

from app.api.v1 import (
    attendance,
    auth,
    batches,
    branches,
    classes,
    courses,
    enrollments,
    events,
    feed,
    learning,
    media,
    memberships,
    notifications,
    payments,
    reports,
    students,
    tickets,
    trainers,
    users,
)

router = APIRouter()
router.include_router(auth.router)
router.include_router(users.router)
router.include_router(branches.router)
router.include_router(courses.router)
router.include_router(batches.router)
router.include_router(classes.router)
router.include_router(enrollments.router)
router.include_router(students.router)
router.include_router(trainers.router)
router.include_router(memberships.router)
router.include_router(payments.router)
router.include_router(attendance.router)
router.include_router(events.router)
router.include_router(tickets.router)
router.include_router(media.router)
router.include_router(feed.router)
router.include_router(notifications.router)
router.include_router(learning.router)
router.include_router(reports.router)
