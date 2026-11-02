-- ============================================================
-- EWUmate Admin Panel — Full RLS Access Policies
-- Run this in: Supabase Dashboard → SQL Editor
--
-- What this does:
--   • Creates/replaces the is_admin() helper function
--   • Enables RLS on every table (safe to run if already enabled)
--   • Adds a single "admin_full_access" policy per table
--     that gives logged-in admin users full SELECT/INSERT/UPDATE/DELETE
--   • Does NOT expose service role key anywhere
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 0. HELPER FUNCTION — is_admin()
--    Returns true if the current logged-in user is in admin_users
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;


-- ──────────────────────────────────────────────────────────────
-- HELPER MACRO — used for each table below:
--   1. Enable RLS
--   2. Drop old admin policy if exists (clean re-run)
--   3. Create fresh admin_full_access policy
-- ──────────────────────────────────────────────────────────────


-- ── active_semester ──────────────────────────────────────────
ALTER TABLE public.active_semester ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.active_semester;
CREATE POLICY "admin_full_access" ON public.active_semester
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── admin_users ───────────────────────────────────────────────
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.admin_users;
CREATE POLICY "admin_full_access" ON public.admin_users
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── app_config ────────────────────────────────────────────────
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.app_config;
CREATE POLICY "admin_full_access" ON public.app_config
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── calendar_spring2026 ───────────────────────────────────────
ALTER TABLE public.calendar_spring2026 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.calendar_spring2026;
CREATE POLICY "admin_full_access" ON public.calendar_spring2026
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── calendar_spring2026_phrm_llb ─────────────────────────────
ALTER TABLE public.calendar_spring2026_phrm_llb ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.calendar_spring2026_phrm_llb;
CREATE POLICY "admin_full_access" ON public.calendar_spring2026_phrm_llb
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── calendar_summer2026 ───────────────────────────────────────
ALTER TABLE public.calendar_summer2026 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.calendar_summer2026;
CREATE POLICY "admin_full_access" ON public.calendar_summer2026
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── completed_courses ─────────────────────────────────────────
ALTER TABLE public.completed_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.completed_courses;
CREATE POLICY "admin_full_access" ON public.completed_courses
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── course_metadata ───────────────────────────────────────────
ALTER TABLE public.course_metadata ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.course_metadata;
CREATE POLICY "admin_full_access" ON public.course_metadata
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── courses_fall2025 ──────────────────────────────────────────
ALTER TABLE public.courses_fall2025 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.courses_fall2025;
CREATE POLICY "admin_full_access" ON public.courses_fall2025
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── courses_spring2025 ────────────────────────────────────────
ALTER TABLE public.courses_spring2025 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.courses_spring2025;
CREATE POLICY "admin_full_access" ON public.courses_spring2025
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── courses_spring2026 ────────────────────────────────────────
ALTER TABLE public.courses_spring2026 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.courses_spring2026;
CREATE POLICY "admin_full_access" ON public.courses_spring2026
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── courses_summer2025 ────────────────────────────────────────
ALTER TABLE public.courses_summer2025 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.courses_summer2025;
CREATE POLICY "admin_full_access" ON public.courses_summer2025
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── courses_summer2026 ────────────────────────────────────────
ALTER TABLE public.courses_summer2026 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.courses_summer2026;
CREATE POLICY "admin_full_access" ON public.courses_summer2026
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── enrollments ───────────────────────────────────────────────
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.enrollments;
CREATE POLICY "admin_full_access" ON public.enrollments
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── fcm_tokens ────────────────────────────────────────────────
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.fcm_tokens;
CREATE POLICY "admin_full_access" ON public.fcm_tokens
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── feedback_comments ─────────────────────────────────────────
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.feedback_comments;
CREATE POLICY "admin_full_access" ON public.feedback_comments
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── feedbacks ─────────────────────────────────────────────────
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.feedbacks;
CREATE POLICY "admin_full_access" ON public.feedbacks
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── grade_scale ───────────────────────────────────────────────
ALTER TABLE public.grade_scale ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.grade_scale;
CREATE POLICY "admin_full_access" ON public.grade_scale
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── notifications ─────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.notifications;
CREATE POLICY "admin_full_access" ON public.notifications
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── parsing_logs ──────────────────────────────────────────────
ALTER TABLE public.parsing_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.parsing_logs;
CREATE POLICY "admin_full_access" ON public.parsing_logs
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── profiles ──────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.profiles;
CREATE POLICY "admin_full_access" ON public.profiles
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── programs ──────────────────────────────────────────────────
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.programs;
CREATE POLICY "admin_full_access" ON public.programs
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── schedule_exceptions ───────────────────────────────────────
ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.schedule_exceptions;
CREATE POLICY "admin_full_access" ON public.schedule_exceptions
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── schedule_generations ──────────────────────────────────────
ALTER TABLE public.schedule_generations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.schedule_generations;
CREATE POLICY "admin_full_access" ON public.schedule_generations
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── scholarship_policies ──────────────────────────────────────
ALTER TABLE public.scholarship_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.scholarship_policies;
CREATE POLICY "admin_full_access" ON public.scholarship_policies
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── scraper_config ────────────────────────────────────────────
ALTER TABLE public.scraper_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.scraper_config;
CREATE POLICY "admin_full_access" ON public.scraper_config
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── scraper_logs ──────────────────────────────────────────────
ALTER TABLE public.scraper_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.scraper_logs;
CREATE POLICY "admin_full_access" ON public.scraper_logs
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── semester_analytics ────────────────────────────────────────
ALTER TABLE public.semester_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.semester_analytics;
CREATE POLICY "admin_full_access" ON public.semester_analytics
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── semester_course_marks ─────────────────────────────────────
ALTER TABLE public.semester_course_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.semester_course_marks;
CREATE POLICY "admin_full_access" ON public.semester_course_marks
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── semester_course_stats ─────────────────────────────────────
ALTER TABLE public.semester_course_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.semester_course_stats;
CREATE POLICY "admin_full_access" ON public.semester_course_stats
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── semester_summaries ────────────────────────────────────────
ALTER TABLE public.semester_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.semester_summaries;
CREATE POLICY "admin_full_access" ON public.semester_summaries
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── semesters ─────────────────────────────────────────────────
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.semesters;
CREATE POLICY "admin_full_access" ON public.semesters
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── tasks ─────────────────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.tasks;
CREATE POLICY "admin_full_access" ON public.tasks
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── user_drafts ───────────────────────────────────────────────
ALTER TABLE public.user_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.user_drafts;
CREATE POLICY "admin_full_access" ON public.user_drafts
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── user_semester_states ──────────────────────────────────────
ALTER TABLE public.user_semester_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.user_semester_states;
CREATE POLICY "admin_full_access" ON public.user_semester_states
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ──────────────────────────────────────────────────────────────
-- TABLES THAT ALSO NEED STUDENT-FACING READ/WRITE POLICIES
-- (Keep existing student policies intact — admin policy just adds on top)
-- ──────────────────────────────────────────────────────────────

-- profiles: students can read/update their own profile
DROP POLICY IF EXISTS "users_own_profile" ON public.profiles;
CREATE POLICY "users_own_profile" ON public.profiles
FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- enrollments: students manage their own enrollments
DROP POLICY IF EXISTS "users_own_enrollments" ON public.enrollments;
CREATE POLICY "users_own_enrollments" ON public.enrollments
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- completed_courses: students read their own history
DROP POLICY IF EXISTS "users_own_completed" ON public.completed_courses;
CREATE POLICY "users_own_completed" ON public.completed_courses
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- tasks: students manage their own tasks
DROP POLICY IF EXISTS "users_own_tasks" ON public.tasks;
CREATE POLICY "users_own_tasks" ON public.tasks
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- notifications: students read their own notifications
DROP POLICY IF EXISTS "users_own_notifications" ON public.notifications;
CREATE POLICY "users_own_notifications" ON public.notifications
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- fcm_tokens: students manage their own FCM token
DROP POLICY IF EXISTS "users_own_fcm_token" ON public.fcm_tokens;
CREATE POLICY "users_own_fcm_token" ON public.fcm_tokens
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- feedbacks: students submit their own feedbacks
DROP POLICY IF EXISTS "users_own_feedbacks" ON public.feedbacks;
CREATE POLICY "users_own_feedbacks" ON public.feedbacks
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Public read-only tables (all authenticated students can read)
DROP POLICY IF EXISTS "authenticated_read" ON public.active_semester;
CREATE POLICY "authenticated_read" ON public.active_semester
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.programs;
CREATE POLICY "authenticated_read" ON public.programs
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.course_metadata;
CREATE POLICY "authenticated_read" ON public.course_metadata
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.grade_scale;
CREATE POLICY "authenticated_read" ON public.grade_scale
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.scholarship_policies;
CREATE POLICY "authenticated_read" ON public.scholarship_policies
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.courses_spring2026;
CREATE POLICY "authenticated_read" ON public.courses_spring2026
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.courses_summer2026;
CREATE POLICY "authenticated_read" ON public.courses_summer2026
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.courses_fall2025;
CREATE POLICY "authenticated_read" ON public.courses_fall2025
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.courses_spring2025;
CREATE POLICY "authenticated_read" ON public.courses_spring2025
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.courses_summer2025;
CREATE POLICY "authenticated_read" ON public.courses_summer2025
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.app_config;
CREATE POLICY "authenticated_read" ON public.app_config
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.calendar_spring2026;
CREATE POLICY "authenticated_read" ON public.calendar_spring2026
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.calendar_spring2026_phrm_llb;
CREATE POLICY "authenticated_read" ON public.calendar_spring2026_phrm_llb
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.calendar_summer2026;
CREATE POLICY "authenticated_read" ON public.calendar_summer2026
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON public.semesters;
CREATE POLICY "authenticated_read" ON public.semesters
FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────
-- DONE ✅
-- Admin users now have full SELECT/INSERT/UPDATE/DELETE on ALL tables
-- Students retain access to their own data + public read-only tables
-- No service role key needed in the browser
-- ──────────────────────────────────────────────────────────────
