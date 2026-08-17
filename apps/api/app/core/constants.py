import enum


class Role(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    RECEPTIONIST = "receptionist"
    TRAINER = "trainer"
    STUDENT = "student"
    PHOTOGRAPHER = "photographer"


# Roles that can act on any branch without explicit BranchAccess rows.
GLOBAL_ROLES = {Role.SUPER_ADMIN}

# Roles managed operationally at branch level.
STAFF_ROLES = {Role.ADMIN, Role.RECEPTIONIST, Role.TRAINER, Role.PHOTOGRAPHER}


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class StudentStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    FORMER = "former"


class MembershipScope(str, enum.Enum):
    SINGLE_BRANCH = "single_branch"
    MULTI_BRANCH = "multi_branch"
    ALL_BRANCHES = "all_branches"


class MembershipStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRING = "expiring"
    EXPIRED = "expired"
    FROZEN = "frozen"
    CANCELLED = "cancelled"


class PaymentMethod(str, enum.Enum):
    ONLINE = "online"
    CASH = "cash"
    UPI = "upi"
    CARD = "card"
    OTHER = "other"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"


class EnrollmentStatus(str, enum.Enum):
    ACTIVE = "active"
    WAITLISTED = "waitlisted"
    TRANSFERRED = "transferred"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class EventScope(str, enum.Enum):
    BRANCH = "branch"
    MULTI_BRANCH = "multi_branch"
    ACADEMY_WIDE = "academy_wide"


class EventStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TicketStatus(str, enum.Enum):
    VALID = "valid"
    CHECKED_IN = "checked_in"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class MediaStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    PUBLISHED = "published"
    REJECTED = "rejected"


class MediaType(str, enum.Enum):
    PHOTO = "photo"
    VIDEO = "video"


class PostVisibility(str, enum.Enum):
    ACADEMY = "academy"
    BRANCH = "branch"
    BATCH = "batch"
    EVENT = "event"
    PRIVATE = "private"


class ReportReason(str, enum.Enum):
    INAPPROPRIATE = "inappropriate"
    HARASSMENT = "harassment"
    SPAM = "spam"
    COPYRIGHT = "copyright"
    OTHER = "other"


class ClassSessionStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    RESCHEDULED = "rescheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
