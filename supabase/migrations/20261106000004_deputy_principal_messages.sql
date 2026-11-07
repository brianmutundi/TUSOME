-- Slice 7, item 5: deputy principals see and answer every parent message, like the principal.
--
-- Decision (owner): deputy principals should see parent messages. Rule used: a deputy
-- principal (primary role or a user_roles junction role) is treated as admin-level for
-- parent messaging only: every thread in their school, whatever the audience. Nothing else
-- about their access changes: parent_msg_is_admin_level is used only by the messaging
-- functions in 20261105000010.
--
-- Two changes, both needed:
--   1. parent_msg_is_admin_level also accepts 'deputy principal' (visibility).
--   2. The built-in 'deputy principal' role gains reply-parent-messages in
--      default_role_catalog() (the staff guard requires it, and the /analytics route is gated
--      on it). Tenants whose roles are customised (roles.permissions_customized) keep their own
--      list and must tick "Parent messages" for the deputy role themselves.
-- default_role_catalog() below is 20261105000010's, unchanged except for that one token.

create or replace function public.parent_msg_is_admin_level(p_tenant uuid)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce((
    select public.normalize_role_key(p.role) in ('admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director')
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.tenant_id = p_tenant
          and public.normalize_role_key(ur.role_key) in ('admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director')
      )
    from public.profiles p
    where p.id = auth.uid() and p.tenant_id = p_tenant
  ), false)
$function$;

CREATE OR REPLACE FUNCTION public.default_role_catalog()
RETURNS TABLE(
  role_key text,
  display_name text,
  description text,
  staff_type text,
  scope text,
  default_permissions text[]
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    v.role_key,
    v.display_name,
    v.description,
    v.staff_type,
    'GLOBAL'::text AS scope,
    v.default_permissions
  FROM (
    VALUES
      (
        'admin',
        'Administrator',
        'Full school administration, exam publishing, role & permission management.',
        'OFFICIAL',
        ARRAY(SELECT p.code FROM public.permissions p ORDER BY p.sort_order, p.code)
      ),
      (
        'principal',
        'Principal',
        'Head of school with full visibility across exams, reports, staff and settings.',
        'OFFICIAL',
        ARRAY(SELECT p.code FROM public.permissions p ORDER BY p.sort_order, p.code)
      ),
      (
        'deputy principal',
        'Deputy principal',
        'Academic and administrative deputy head overseeing exams, classes and staff.',
        'OFFICIAL',
        ARRAY[
          'view-admin-dashboard', 'view-teacher-dashboard',
          'access-exams', 'view-my-classes', 'manage-exams', 'create-edit-exam', 'view-edit-grading-system',
          'access-printouts', 'view-merit-list', 'view-evaluation-report', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-classes', 'manage-classes', 'edit-classes', 'assign-subject-teachers', 'assign-class-teachers', 'assign-class-supervisors', 'access-subjects',
          'access-students', 'add-students', 'search-student', 'view-student-profile', 'view-student-analysis', 'edit-student-profile', 'move-students',
          'access-teachers', 'view-teacher-profile', 'view-teacher-list', 'access-staff-bom-pa', 'view-staff-bom-pa-list',
          'access-settings', 'view-school-profile', 'view-school-options', 'view-user-roles', 'view-term-dates',
          'reply-parent-messages'
        ]
      ),
      (
        'director',
        'Director',
        'School director with oversight of dashboards, printouts, staff and settings.',
        'OFFICIAL',
        ARRAY[
          'view-admin-dashboard',
          'access-exams', 'view-my-classes',
          'access-printouts', 'view-merit-list', 'view-evaluation-report', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-students', 'search-student', 'view-student-profile', 'view-student-analysis',
          'access-teachers', 'view-teacher-profile', 'view-teacher-list', 'access-staff-bom-pa', 'view-staff-bom-pa-list',
          'access-settings', 'view-school-profile', 'view-school-options', 'view-user-roles', 'edit-user-roles', 'can-manage-user-permissions', 'view-term-dates'
        ]
      ),
      (
        'secretary',
        'Secretary',
        'Front-office and records management for students, class lists and printouts.',
        'WORKER',
        ARRAY[
          'view-secretary-dashboard',
          'access-printouts', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-classes', 'access-students', 'add-students', 'search-student', 'view-student-profile', 'edit-student-profile',
          'access-teachers', 'view-teacher-list', 'access-staff-bom-pa', 'view-staff-bom-pa-list',
          'access-settings', 'view-school-profile', 'view-term-dates'
        ]
      ),
      (
        'teacher',
        'Teacher',
        'Subject and class teacher access to exams, mark sheets, student analytics and reports.',
        'TEACHER',
        ARRAY[
          'view-teacher-dashboard',
          'access-exams', 'view-my-classes',
          'access-printouts', 'view-merit-list', 'view-evaluation-report', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-classes', 'access-subjects',
          'access-students', 'search-student', 'view-student-profile', 'view-student-analysis',
          'manage-homework', 'reply-parent-messages'
        ]
      ),
      (
        'worker',
        'Non-teaching staff',
        'Support and operational school staff.',
        'WORKER',
        ARRAY[
          'view-secretary-dashboard',
          'access-students', 'search-student'
        ]
      )
      ,
      (
        'bursar',
        'Bursar',
        'Finance and fee management: balances, payments, invoices, receipts and collections.',
        'OFFICIAL',
        ARRAY['view-fees', 'manage-fees', 'view-admin-dashboard', 'access-settings', 'view-school-profile', 'view-school-options', 'view-term-dates', 'view-user-roles', 'view-student-profile', 'search-student', 'access-students', 'view-class-list', 'access-classes', 'view-staff-bom-pa-list', 'access-staff-bom-pa', 'view-teacher-list', 'reply-parent-messages']
      )

      ,
      (
        'dos',
        'Director of Studies',
        'Academic director overseeing curriculum, exams, grading and teacher allocations.',
        'OFFICIAL',
        ARRAY[
          'view-admin-dashboard', 'view-teacher-dashboard',
          'access-exams', 'view-my-classes', 'manage-exams', 'create-edit-exam', 'view-edit-grading-system', 'view-edit-coefficient-system', 'view-edit-paper-ratios', 'add-target-grades',
          'access-printouts', 'view-merit-list', 'view-evaluation-report', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-classes', 'manage-classes', 'edit-classes', 'assign-subject-teachers', 'assign-class-teachers', 'assign-class-supervisors', 'access-subjects',
          'access-students', 'add-students', 'search-student', 'view-student-profile', 'view-student-analysis', 'edit-student-profile', 'move-students',
          'access-teachers', 'view-teacher-profile', 'view-teacher-list', 'add-teachers', 'edit-teacher-profile',
          'access-settings', 'view-school-profile', 'view-school-options', 'view-user-roles', 'view-term-dates'
        ]
      ),
      (
        'student',
        'Student',
        'Student self-service access (own results and profile).',
        'TEACHER',
        ARRAY['view-student-dashboard']
      ),
      (
        'parent',
        'Parent / Guardian',
        'Parent / guardian access to linked children data.',
        'WORKER',
        ARRAY['view-student-dashboard']
      )

  ) AS v(role_key, display_name, description, staff_type, default_permissions)
$function$;
