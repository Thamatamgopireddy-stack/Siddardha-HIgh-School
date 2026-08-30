import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    DEVELOPER = "developer"
    SCHOOL_ADMIN = "school_admin"
    PRINCIPAL = "principal"
    TEACHER = "teacher"
    CLASS_TEACHER = "class_teacher"
    ACCOUNTANT = "accountant"
    LIBRARIAN = "librarian"
    TRANSPORT_MANAGER = "transport_manager"
    HOSTEL_WARDEN = "hostel_warden"
    HR_MANAGER = "hr_manager"
    STUDENT = "student"
    PARENT = "parent"


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Category(str, enum.Enum):
    GENERAL = "general"
    OBC = "obc"
    SC = "sc"
    ST = "st"
    EWS = "ews"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"
    HOLIDAY = "holiday"
    ON_LEAVE = "on_leave"


class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AdmissionStatus(str, enum.Enum):
    APPLIED = "applied"
    DOCUMENTS_PENDING = "documents_pending"
    UNDER_REVIEW = "under_review"
    SHORTLISTED = "shortlisted"
    ADMITTED = "admitted"
    REJECTED = "rejected"
    WAITLISTED = "waitlisted"
