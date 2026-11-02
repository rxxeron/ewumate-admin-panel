// ============================================================
// EWUmate Admin Panel — Centralized Type Definitions
// ============================================================

// --- User / Profile ---
export interface Profile {
  id: string;
  full_name: string | null;
  nickname: string | null;
  student_id: string | null;
  program_code: string | null;
  program_name: string | null;
  department_name: string | null;
  track: string | null;
  cgpa: number | null;
  total_credits_earned: number | null;
  total_courses_completed: number | null;
  credits_completed: number | null;
  enrolled_sections: string[] | null;
  enrolled_sections_next: string[] | null;
  enrolled_credits: number | null;
  enrolled_credits_next: number | null;
  onboarding_status: string | null;
  last_active_at: string | null;
  app_open_count: number | null;
  reminder_settings?: Record<string, number[]> | null;
  created_at: string;
  updated_at: string | null;
}

export interface LocalNotificationState {
  id: string;
  user_id: string;
  device_id: string;
  platform: string;
  semester_code: string | null;
  checksum: string | null;
  scheduled_count: number;
  active_keys: string[];
  last_scheduled_at: string;
  status: string;
  metadata?: {
    next_alert_time?: string;
    device_time?: string;
    app_version?: string;
    os_version?: string;
  };
  updated_at: string;
  profiles?: {
    full_name: string | null;
    student_id: string | null;
    department_name: string | null;
  };
}

export interface LocalNotificationLog {
  id: string;
  user_id: string;
  device_id: string;
  platform: string;
  alert_key: string;
  title: string | null;
  body: string | null;
  trigger_at: string | null;
  status: 'scheduled' | 'delivered' | 'failed';
  error_message: string | null;
  dispatched_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    student_id: string | null;
  };
}

export interface Faculty {
  id: string;
  short_name: string;
  full_name: string | null;
  designation_name: string | null;
  email: string | null;
  photo_url: string | null;
  phone: string | null;
  office_room?: string | null;
  department_name?: string | null;
  created_at: string;
  updated_at: string;
}

// --- Course / Section ---
export interface CourseSection {
  id: string;
  course_code: string;
  course_name: string | null;
  section_number: number | null;
  faculty_initials: string | null;
  credit_val: number | null;
  schedule_data?: ScheduleSession[] | null;
}

export interface ScheduleSession {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  type: string;
  faculty: string;
}

// --- Enrollment ---
export interface Enrollment {
  id: string;
  user_id: string;
  course_code: string;
  section_id: string | null;
  semester_code: string;
  status: string;
  _sectionDetails?: {
    id: string;
    section_number: number | null;
    course_name: string | null;
  };
}

// --- Completed Course ---
export interface CompletedCourse {
  id: string;
  user_id: string;
  course_code: string;
  semester_code: string;
  grade: string;
  credits: number | null;
}

// --- Task ---
export interface Task {
  id: string;
  user_id: string;
  title: string;
  course_code: string | null;
  type: string | null;
  due_date: string;
  is_completed: boolean;
  is_missed: boolean;
}

// --- Semester Course Marks ---
export interface CourseMark {
  id: string;
  user_id: string;
  course_code: string;
  semester_code: string;
  mid_marks: number | null;
  final_marks: number | null;
  dist_mid: number | null;
  dist_final: number | null;
}

// --- Notification ---
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  trigger_at: string;
  is_dispatched: boolean;
  payload: Record<string, unknown> | null;
  alert_key: string | null;
  created_at?: string;
}

// --- Feedback ---
export interface FeedbackComment {
  id: string;
  feedback_id: string;
  comment: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  user_id: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'ignored';
  created_at: string;
  updated_at?: string;
  admin_note?: string;
  comments?: FeedbackComment[];
  profiles?: {
    full_name: string | null;
    student_id: string | null;
    program_code: string | null;
  };
}

// --- Calendar Event ---
export interface CalendarEvent {
  id: string;
  event_date: string;
  title: string;
  type: string;
  target_track: string;
}

// --- App Config ---
export interface AppConfig {
  key: string;
  value: string;
}

// --- Semester ---
export interface Semester {
  id?: string;
  code: string;
  title: string | null;
  is_active: boolean;
  created_at?: string;
}

// --- Active Semester ---
export interface ActiveSemester {
  track: string;
  current_semester_code: string | null;
  next_semester_code: string | null;
  classes_start_date: string | null;
  classes_end_date: string | null;
  advising_start_date: string | null;
  advising_end_date: string | null;
  final_exam_start: string | null;
  final_exam_end: string | null;
  grade_submission_start: string | null;
  is_advising_open: boolean;
  is_next_semester_open: boolean;
}

// --- Parsing Log ---
export interface ParsingLog {
  id: string;
  file_name: string;
  file_type: string;
  status: string;
  metrics: {
    upserted?: number;
    deleted?: number;
    count?: number;
    error?: string;
  } | null;
  created_at: string;
}

// --- Course Metadata ---
export interface CourseMetadata {
  code: string;
  name: string;
  credit_val: number | null;
  equivalent_code: string | null;
}

// --- Grade Scale ---
export interface GradeScale {
  grade: string;
  point: number;
  min_score: number | null;
  description: string | null;
  policy: string | null;
}

// --- Scholarship Policy ---
export interface ScholarshipPolicy {
  id?: string;
  department_code: string;
  min_yearly_credits: number | null;
  merit_cgpa_min: number | null;
  deans_cgpa_min: number | null;
  medha_cgpa_min: number | null;
}

// --- Dashboard Stats ---
export interface DashboardStats {
  users: number;
  activeUsers24h: number;
  programs: number;
  courses: number;
  notifications: number;
  pendingFeedbacks: number;
  inProgressFeedbacks: number;
  resolvedFeedbacks: number;
  ignoredFeedbacks: number;
}

export interface SemesterTrackStats {
  current: string | null;
  next: string | null;
  current_courses: number;
  current_sections: number;
  next_courses: number;
  next_sections: number;
  is_advising_open: boolean;
  is_next_semester_open: boolean;
}

// --- Storage File ---
export interface StorageFile {
  name: string;
  id: string | null;
  metadata: { size: number; mimetype: string } | null;
  created_at: string | null;
}

// --- Notification Template (localStorage) ---
export interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  url: string;
  targetDepartment: string;
  createdAt: string;
}

// --- Schedule Cache ---
export interface WeeklyGridCache {
  [day: string]: Array<{
    courseCode: string;
    courseName: string;
    startTime: string;
    endTime: string;
    room: string;
    type: string;
    faculty: string;
  }>;
}

export interface UserSemesterState {
  user_id: string;
  semester_code: string;
  weekly_grid_cache: WeeklyGridCache | null;
  updated_at: string;
}

export interface StudyMaterial {
  id: string;
  uploader_id: string | null;
  faculty_initial: string | null;
  course_code: string | null;
  semester: string | null;
  file_type: string | null;
  drive_account_id: string | null;
  drive_file_id: string;
  file_name: string;
  file_size_bytes: number;
  created_at: string;
  updated_at: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'removal_requested';
  profiles?: {
    full_name: string | null;
    student_id: string | null;
  };
}

// --- Storage / Google Drive Account ---
export interface DriveAccount {
  id: string;
  email: string;
  total_capacity_bytes: number;
  used_bytes: number;
  is_active: boolean;
  folder_id: string;
  created_at: string;
  purpose?: string; // Add the purpose field ('study_vault' | 'office_hours')
}

// --- Faculty Office Hour Submissions ---
export interface FacultyOfficeHour {
  id: string;
  faculty_initials: string;
  day: string;
  start_time: string;
  end_time: string;
  drive_account_id: string | null;
  drive_file_id: string;
  file_name: string;
  submitted_by: string | null;
  status: 'pending' | 'approved' | 'rejected';
  semester_code: string;
  office_room: string | null;
  created_at: string;
  updated_at: string | null;
  profiles?: {
    full_name: string | null;
    student_id: string | null;
  };
}

// --- Faculty Reviews ---
export interface FacultyReview {
  id: string;
  faculty_initials: string;
  faculty_name: string | null;
  user_id: string;
  course_code: string;
  semester: string;
  semester_code?: string | null;
  grade_received?: string | null;
  delivery_type: string;
  clarity_rating: number;
  grading_fairness: number;
  exam_alignment: number;
  office_hours_accessibility: number;
  attendance_strictness: number;
  workload_level: string;
  slide_reliance: string;
  quiz_frequency: string;
  textbook_need: string;
  would_take_again: boolean;
  traits: string[];
  exam_prep_tips?: string | null;
  review_note?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_rejection_note?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    student_id: string | null;
    department_name: string | null;
  };
}


