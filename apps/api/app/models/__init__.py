"""Import every model so SQLAlchemy's mapper registry can resolve string relationships."""

from app.models.academy import Batch, BatchSchedule, ClassSession, Course, CourseLevel
from app.models.attendance import AttendanceCorrectionRequest, AttendanceRecord
from app.models.audit import AuditLog
from app.models.branch import Branch, Studio
from app.models.enrollment import Enrollment, EnrollmentHistory
from app.models.event import Event, EventActivity, EventParticipant, EventPhotographer, TicketType
from app.models.feed import Post, PostComment, PostLike, PostMedia, PostReport, PostSave
from app.models.learning import Certificate, LearningContent, LearningFavorite, StudentAssessment
from app.models.media import Album, MediaAsset, MediaTag
from app.models.membership import Membership, MembershipBranch, MembershipPlan
from app.models.notification import Notification
from app.models.payment import Invoice, Payment
from app.models.student import StudentProfile, TrainerProfile
from app.models.ticket import Ticket
from app.models.user import BranchAccess, RefreshToken, User

__all__ = [
    "Batch",
    "BatchSchedule",
    "ClassSession",
    "Course",
    "CourseLevel",
    "AttendanceCorrectionRequest",
    "AttendanceRecord",
    "AuditLog",
    "Branch",
    "Studio",
    "Enrollment",
    "EnrollmentHistory",
    "Event",
    "EventActivity",
    "EventParticipant",
    "EventPhotographer",
    "TicketType",
    "Post",
    "PostComment",
    "PostLike",
    "PostMedia",
    "PostReport",
    "PostSave",
    "Certificate",
    "LearningContent",
    "LearningFavorite",
    "StudentAssessment",
    "Album",
    "MediaAsset",
    "MediaTag",
    "Membership",
    "MembershipBranch",
    "MembershipPlan",
    "Notification",
    "Invoice",
    "Payment",
    "StudentProfile",
    "TrainerProfile",
    "Ticket",
    "BranchAccess",
    "RefreshToken",
    "User",
]
