export type Role = "super_admin" | "admin" | "receptionist" | "trainer" | "student" | "photographer";

export interface Me {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: string;
  home_branch_id: string | null;
  avatar_url: string | null;
  accessible_branch_ids: string[];
}

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  status: string;
  home_branch_id: string | null;
  avatar_url: string | null;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager_id: string | null;
  opening_hours: string | null;
  is_active: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Student {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  status: string;
  skill_level: string | null;
  home_branch_id: string | null;
  joining_date: string;
}

export interface Trainer {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  specialization: string | null;
  experience_years: number | null;
  availability: string | null;
}

export interface Course {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface CourseLevel {
  id: string;
  course_id: string;
  name: string;
  duration_weeks: number | null;
}

export interface Batch {
  id: string;
  name: string;
  course_level_id: string;
  branch_id: string;
  studio_id: string | null;
  trainer_id: string | null;
  capacity: number;
  is_active: boolean;
  enrolled_count: number;
  waitlist_count: number;
}

export interface ClassSession {
  id: string;
  batch_id: string;
  batch_name: string | null;
  branch_id: string;
  studio_id: string | null;
  trainer_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  student_count: number;
}

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  duration_days: number | null;
  class_credits: number | null;
  price: number;
  scope: string;
  is_active: boolean;
}

export interface Membership {
  id: string;
  student_id: string;
  plan_id: string;
  start_date: string;
  end_date: string | null;
  remaining_credits: number | null;
  status: string;
}

export interface Payment {
  id: string;
  student_id: string;
  branch_id: string;
  membership_id: string | null;
  amount: number;
  method: string;
  status: string;
  payment_date: string;
  reference: string | null;
  invoice_number: string | null;
}

export interface RevenueSummary {
  today_revenue: number;
  month_revenue: number;
  pending_payments_count: number;
  pending_payments_amount: number;
  expiring_memberships_count: number;
}

export interface RosterStudent {
  student_id: string;
  full_name: string;
  existing_status: string | null;
}

export interface ClassRoster {
  class_session_id: string;
  batch_name: string;
  session_date: string;
  start_time: string;
  already_submitted: boolean;
  students: RosterStudent[];
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export interface StudentAttendanceStat {
  student_id: string;
  full_name: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total_sessions: number;
  attendance_percent: number;
}

export interface SidEvent {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  branch_id: string | null;
  scope: string;
  status: string;
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  price: number;
  quantity_total: number;
  quantity_sold: number;
  complimentary_quota: number;
  available: number;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  ticket_type_id: string;
  event_id: string;
  holder_name: string;
  is_complimentary: boolean;
  amount_paid: number;
  qr_secret: string;
  status: string;
  checked_in_at: string | null;
}

export interface EventAttendanceSummary {
  tickets_sold: number;
  checked_in: number;
  no_show: number;
  complimentary: number;
}

export interface PostMedia {
  id: string;
  url: string;
  thumbnail_url: string | null;
  media_type: string;
}

export interface FeedPost {
  id: string;
  author_id: string;
  author_name: string;
  caption: string | null;
  visibility: string;
  is_official: boolean;
  comments_disabled: boolean;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  media: PostMedia[];
  created_at: string;
}

export interface Assessment {
  id: string;
  student_id: string;
  trainer_id: string;
  rhythm: number;
  timing: number;
  technique: number;
  expression: number;
  coordination: number;
  performance: number;
  comments: string | null;
  created_at: string;
}

export interface Certificate {
  id: string;
  student_id: string;
  certificate_number: string;
  achievement_type: string;
  title: string;
  issued_date: string;
  verification_code: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface PostReport {
  id: string;
  post_id: string;
  reported_by_id: string;
  reason: string;
  details: string | null;
  status: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}
