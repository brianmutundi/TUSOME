-- TUSOME analytics: Zeraki-parity roles, permissions, accounts & section heads
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- * settings/usr-roles routes & guards:
--     chunk-DTRKVYAB.js  path:"usr-roles" (permission:"view-user-roles"),
--                        path:"section-heads" (permission:"view-user-roles")
--     chunk-MSO4SBB7.js  add-user-role (permission:"edit-user-roles"),
--                        role/:roleId/user/:userId (permission:"can-manage-user-permissions"),
--                        role/:roleId (permission:"view-user-roles")
-- * UserRoleService endpoints & state:
--     chunk-YXB57XCL.js  GET/POST/PUT/DELETE /roles, PUT /roles/:id/permissions,
--                        GET /permissions, GET /roles/users/:id,
--                        GET /user-permissions/users/:id,
--                        POST /user-permissions/grant, POST /user-permissions/deny,
--                        DELETE /user-permissions,
--                        POST /user-permissions/users/:id/revoke-all,
--                        POST /user-permissions/users/:id/restore
-- * Role & permission UI:
--     chunk-XOUYY76Z.js  staffTypes Fe = TEACHER | OFFICIAL | WORKER,
--                        scope GLOBAL vs CUSTOM (isCustomRole: scope !== "GLOBAL"),
--                        UserPermissionsTab = granted | eligible | restricted,
--                        noAccessBadge / revokeAllAccess / restoreAccess
-- * Permission catalogue & role checks:
--     chunk-4ELYURC5.js  62 permission codes across dashboard, exams, printouts,
--                        classes/subjects, students, teachers/staff, settings
-- * Section heads:
--     chunk-POC2O2ZL.js  GET/POST/PUT/DELETE /section-heads,
--                        form levels Te (PRE_SCHOOL .. MYP)

-- ---------------------------------------------------------------------------
-- 1. Extend profiles with email, staff_type and access_revoked
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_type text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_staff_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_staff_type_check
  CHECK (staff_type IS NULL OR staff_type IN ('TEACHER', 'OFFICIAL', 'WORKER'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_revoked boolean NOT NULL DEFAULT false;

-- Allow authenticated/service_role to join auth.users(id, email) and provision
-- invited accounts inside tenant-guarded RPCs without SECURITY DEFINER.
GRANT SELECT, INSERT, UPDATE ON auth.users TO authenticated, service_role;

-- Backfill email from auth.users and default staff_type from role where missing.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR btrim(p.email) = '')
  AND u.email IS NOT NULL;

UPDATE public.profiles p
SET staff_type = CASE
  WHEN lower(btrim(coalesce(p.role, ''))) = 'teacher' THEN 'TEACHER'
  WHEN lower(btrim(coalesce(p.role, ''))) IN ('worker', 'messenger', 'librarian') THEN 'WORKER'
  ELSE 'OFFICIAL'
END
WHERE p.staff_type IS NULL
  AND p.role IS NOT NULL
  AND btrim(p.role) <> '';

-- ---------------------------------------------------------------------------
-- 2. Permission catalogue, roles, role_permissions, user_permissions, section_heads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
  code text PRIMARY KEY,
  category_code text NOT NULL,
  category_name text NOT NULL,
  display_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  "key" text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  staff_type text NOT NULL DEFAULT 'OFFICIAL'
    CHECK (staff_type IN ('TEACHER', 'OFFICIAL', 'WORKER')),
  scope text NOT NULL DEFAULT 'CUSTOM'
    CHECK (scope IN ('GLOBAL', 'CUSTOM')),
  permissions_customized boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, "key")
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.permissions (code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.permissions (code) ON DELETE CASCADE,
  effect text NOT NULL CHECK (effect IN ('GRANT', 'DENY')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_code)
);

CREATE TABLE IF NOT EXISTS public.section_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  form_level text NOT NULL
    CHECK (form_level IN (
      'PRE_SCHOOL', 'KINDERGARTEN', 'LOWER_PRIMARY', 'UPPER_PRIMARY',
      'PRIMARY', 'JUNIOR_SCHOOL', 'SENIOR_SCHOOL', 'SECONDARY',
      'LOWER_SECONDARY', 'UPPER_SECONDARY', 'O_LEVEL', 'A_LEVEL',
      'COLLEGE', 'DP', 'MYP'
    )),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, form_level)
);

-- Seed the Zeraki permission catalogue (chunk-4ELYURC5.js).
INSERT INTO public.permissions (code, category_code, category_name, display_name, sort_order) VALUES
  -- Dashboard
  ('view-admin-dashboard',            'dashboard',        'Dashboard',              'View admin dashboard',              10),
  ('view-teacher-dashboard',          'dashboard',        'Dashboard',              'View teacher dashboard',            11),
  ('view-secretary-dashboard',        'dashboard',        'Dashboard',              'View secretary dashboard',          12),
  ('view-student-dashboard',          'dashboard',        'Dashboard',              'View student dashboard',            13),
  -- Exams & Grading
  ('access-exams',                    'exams',            'Exams & Grading',        'Access exams module',               20),
  ('view-my-classes',                 'exams',            'Exams & Grading',        'View my classes exams',             21),
  ('manage-exams',                    'exams',            'Exams & Grading',        'Manage exams',                      22),
  ('create-edit-exam',                'exams',            'Exams & Grading',        'Create and edit exams',             23),
  ('delete-exam',                     'exams',            'Exams & Grading',        'Delete exams',                      24),
  ('view-edit-grading-system',        'exams',            'Exams & Grading',        'Configure grading system',          25),
  ('view-edit-paper-ratios',          'exams',            'Exams & Grading',        'Configure paper ratios',            26),
  ('view-edit-coefficient-system',    'exams',            'Exams & Grading',        'Configure coefficient system',      27),
  ('delete-stream-results',           'exams',            'Exams & Grading',        'Delete stream exam results',        28),
  -- Printouts & Reports
  ('access-printouts',                'printouts',        'Printouts & Reports',    'Access printouts module',           30),
  ('view-merit-list',                 'printouts',        'Printouts & Reports',    'View and download merit lists',     31),
  ('view-evaluation-report',          'printouts',        'Printouts & Reports',    'View analysis & evaluation report', 32),
  ('view-report-forms',               'printouts',        'Printouts & Reports',    'View student report forms',         33),
  ('view-class-list',                 'printouts',        'Printouts & Reports',    'View and print mark sheets',        34),
  ('view-printout-filters',           'printouts',        'Printouts & Reports',    'Filter printouts by class/stream',  35),
  ('view-transcripts',                'printouts',        'Printouts & Reports',    'View student transcripts',          36),
  ('view-assessments',                'printouts',        'Printouts & Reports',    'View assessment printouts',         37),
  -- Classes & Subjects
  ('access-classes',                  'classes_subjects', 'Classes & Subjects',     'Access classes module',             40),
  ('add-classes',                     'classes_subjects', 'Classes & Subjects',     'Add classes and streams',           41),
  ('manage-classes',                  'classes_subjects', 'Classes & Subjects',     'Manage classes and streams',        42),
  ('edit-classes',                    'classes_subjects', 'Classes & Subjects',     'Edit classes and streams',          43),
  ('delete-classes',                  'classes_subjects', 'Classes & Subjects',     'Delete classes and streams',        44),
  ('assign-subject-teachers',         'classes_subjects', 'Classes & Subjects',     'Assign subject teachers',           45),
  ('assign-class-teachers',           'classes_subjects', 'Classes & Subjects',     'Assign class teachers',             46),
  ('assign-class-supervisors',        'classes_subjects', 'Classes & Subjects',     'Assign class supervisors',          47),
  ('access-subjects',                 'classes_subjects', 'Classes & Subjects',     'Access subjects module',            48),
  ('view-edit-compulsory-subjects',   'classes_subjects', 'Classes & Subjects',     'Configure compulsory subjects',     49),
  -- Students
  ('access-students',                 'students',         'Students',               'Access students module',            50),
  ('add-students',                    'students',         'Students',               'Add new students',                  51),
  ('search-student',                  'students',         'Students',               'Search student directory',          52),
  ('view-student-profile',            'students',         'Students',               'View student profile',              53),
  ('view-student-analysis',           'students',         'Students',               'View student exam analytics',       54),
  ('edit-student-profile',            'students',         'Students',               'Edit student profile',              55),
  ('delete-students',                 'students',         'Students',               'Delete student records',            56),
  ('move-students',                   'students',         'Students',               'Move students between streams',     57),
  -- Teachers & Staff
  ('access-teachers',                 'staff',            'Teachers & Staff',       'Access teachers module',            60),
  ('add-teachers',                    'staff',            'Teachers & Staff',       'Add teachers',                      61),
  ('edit-teacher-profile',            'staff',            'Teachers & Staff',       'Edit teacher profiles',             62),
  ('view-teacher-profile',            'staff',            'Teachers & Staff',       'View teacher profiles',             63),
  ('delete-teachers',                 'staff',            'Teachers & Staff',       'Remove teachers',                   64),
  ('view-teacher-list',               'staff',            'Teachers & Staff',       'View teacher directory',            65),
  ('access-staff-bom-pa',             'staff',            'Teachers & Staff',       'Access non-teaching staff & BOM',   66),
  ('add-staff-bom-pa',                'staff',            'Teachers & Staff',       'Add non-teaching staff & officials',67),
  ('edit-staff-bom-pa',               'staff',            'Teachers & Staff',       'Edit non-teaching staff',           68),
  ('delete-staff-bom-pa',             'staff',            'Teachers & Staff',       'Remove non-teaching staff',         69),
  ('view-staff-bom-pa-list',          'staff',            'Teachers & Staff',       'View non-teaching staff list',      70),
  -- Settings & User Roles
  ('access-settings',                 'settings',         'Settings & User Roles',  'Access school settings',            80),
  ('view-school-profile',             'settings',         'Settings & User Roles',  'View school profile',               81),
  ('edit-school-profile',             'settings',         'Settings & User Roles',  'Edit school profile',               82),
  ('view-school-options',             'settings',         'Settings & User Roles',  'View school options',               83),
  ('edit-school-options',             'settings',         'Settings & User Roles',  'Edit school options',               84),
  ('view-user-roles',                 'settings',         'Settings & User Roles',  'View user roles & accounts',        85),
  ('edit-user-roles',                 'settings',         'Settings & User Roles',  'Create, edit and delete user roles',86),
  ('can-manage-user-permissions',     'settings',         'Settings & User Roles',  'Manage per-user permissions',       87),
  ('edit-printout-settings',          'settings',         'Settings & User Roles',  'Edit printout settings',            88),
  ('view-term-dates',                 'settings',         'Settings & User Roles',  'View term dates',                   89),
  ('edit-term-dates',                 'settings',         'Settings & User Roles',  'Edit term dates',                   90)
ON CONFLICT (code) DO UPDATE SET
  category_code = EXCLUDED.category_code,
  category_name = EXCLUDED.category_name,
  display_name  = EXCLUDED.display_name,
  sort_order    = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- 3. Row-level security and admin write policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_heads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS profiles_admin_insert ON public.profiles;
CREATE POLICY profiles_admin_insert ON public.profiles
  FOR INSERT WITH CHECK (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  );

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE
  USING (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  )
  WITH CHECK (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  );

DROP POLICY IF EXISTS profiles_admin_delete ON public.profiles;
CREATE POLICY profiles_admin_delete ON public.profiles
  FOR DELETE USING (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  );

DROP POLICY IF EXISTS roles_tenant_select ON public.roles;
CREATE POLICY roles_tenant_select ON public.roles
  FOR SELECT USING (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS roles_tenant_write ON public.roles;
CREATE POLICY roles_tenant_write ON public.roles
  FOR ALL
  USING (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  )
  WITH CHECK (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  );

DROP POLICY IF EXISTS role_permissions_tenant_select ON public.role_permissions;
CREATE POLICY role_permissions_tenant_select ON public.role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id = public.my_tenant_id()
    )
  );

DROP POLICY IF EXISTS role_permissions_tenant_write ON public.role_permissions;
CREATE POLICY role_permissions_tenant_write ON public.role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id = public.my_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id = public.my_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  );

DROP POLICY IF EXISTS user_permissions_tenant_select ON public.user_permissions;
CREATE POLICY user_permissions_tenant_select ON public.user_permissions
  FOR SELECT USING (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS user_permissions_tenant_write ON public.user_permissions;
CREATE POLICY user_permissions_tenant_write ON public.user_permissions
  FOR ALL
  USING (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  )
  WITH CHECK (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  );

DROP POLICY IF EXISTS section_heads_tenant_select ON public.section_heads;
CREATE POLICY section_heads_tenant_select ON public.section_heads
  FOR SELECT USING (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS section_heads_tenant_write ON public.section_heads;
CREATE POLICY section_heads_tenant_write ON public.section_heads
  FOR ALL
  USING (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  )
  WITH CHECK (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND lower(btrim(coalesce(me.role, ''))) IN (
          'admin', 'administrator', 'superadmin', 'super_admin',
          'super admin', 'owner', 'principal', 'director'
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;
GRANT SELECT ON public.permissions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.section_heads TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Pure helper: built-in Zeraki GLOBAL role definitions & default permissions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_role_key(p_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_role IS NULL OR btrim(p_role) = '' THEN 'unassigned'
    WHEN regexp_replace(lower(btrim(p_role)), '[_-]+', ' ', 'g') IN ('super admin', 'superadmin') THEN 'super admin'
    WHEN regexp_replace(lower(btrim(p_role)), '[_-]+', ' ', 'g') IN ('admin', 'administrator') THEN 'admin'
    ELSE regexp_replace(regexp_replace(lower(btrim(p_role)), '[_-]+', ' ', 'g'), '\s+', ' ', 'g')
  END
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
          'access-settings', 'view-school-profile', 'view-school-options', 'view-user-roles', 'view-term-dates'
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
          'access-students', 'search-student', 'view-student-profile', 'view-student-analysis'
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
  ) AS v(role_key, display_name, description, staff_type, default_permissions)
$function$;

-- ---------------------------------------------------------------------------
-- 5. get_account_directory: full tenant account directory
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_account_directory();

CREATE OR REPLACE FUNCTION public.get_account_directory()
RETURNS TABLE(
  account_id uuid,
  full_name text,
  email text,
  "role" text,
  staff_type text,
  is_active boolean,
  access_revoked boolean,
  granted_overrides integer,
  denied_overrides integer,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS account_id,
    p.full_name,
    coalesce(nullif(btrim(p.email), ''), u.email) AS email,
    p.role,
    coalesce(
      p.staff_type,
      r.staff_type,
      CASE
        WHEN public.normalize_role_key(p.role) = 'teacher' THEN 'TEACHER'
        WHEN public.normalize_role_key(p.role) IN ('worker', 'secretary', 'messenger', 'librarian') THEN 'WORKER'
        ELSE 'OFFICIAL'
      END
    ) AS staff_type,
    p.is_active,
    p.access_revoked,
    coalesce(ovr.granted_count, 0)::integer AS granted_overrides,
    coalesce(ovr.denied_count, 0)::integer AS denied_overrides,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.roles r
    ON r.tenant_id = p.tenant_id
   AND r."key" = public.normalize_role_key(p.role)
  LEFT JOIN (
    SELECT
      up.user_id,
      count(*) FILTER (WHERE up.effect = 'GRANT') AS granted_count,
      count(*) FILTER (WHERE up.effect = 'DENY')  AS denied_count
    FROM public.user_permissions up
    GROUP BY up.user_id
  ) ovr ON ovr.user_id = p.id
  WHERE v_role = 'service_role'
     OR p.tenant_id = v_caller_tenant
  ORDER BY lower(coalesce(p.full_name, '')), p.id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. get_permission_catalogue: Zeraki permission categories & items
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_permission_catalogue()
RETURNS TABLE(
  code text,
  category_code text,
  category_name text,
  display_name text,
  sort_order integer
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p.code,
    p.category_code,
    p.category_name,
    p.display_name,
    p.sort_order
  FROM public.permissions p
  ORDER BY p.sort_order, p.code;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. get_roles_with_permissions: global + custom roles with counts & permissions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_roles_with_permissions()
RETURNS TABLE(
  role_id uuid,
  role_key text,
  display_name text,
  description text,
  staff_type text,
  scope text,
  member_count integer,
  active_count integer,
  inactive_count integer,
  permission_codes text[]
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;
  END IF;

  RETURN QUERY
  WITH tenant_profiles AS (
    SELECT
      p.id,
      public.normalize_role_key(p.role) AS rkey,
      p.is_active
    FROM public.profiles p
    WHERE (v_role = 'service_role' AND v_caller_tenant IS NULL)
       OR p.tenant_id = v_caller_tenant
  ),
  profile_counts AS (
    SELECT
      tp.rkey,
      count(*)::integer AS total_members,
      count(*) FILTER (WHERE tp.is_active)::integer AS active_members,
      count(*) FILTER (WHERE NOT tp.is_active)::integer AS inactive_members
    FROM tenant_profiles tp
    GROUP BY tp.rkey
  ),
  stored_roles AS (
    SELECT
      r.id,
      r."key" AS rkey,
      r.display_name,
      r.description,
      r.staff_type,
      r.scope,
      r.permissions_customized,
      ARRAY(
        SELECT rp.permission_code
        FROM public.role_permissions rp
        JOIN public.permissions pm ON pm.code = rp.permission_code
        WHERE rp.role_id = r.id
        ORDER BY pm.sort_order, pm.code
      ) AS stored_perms
    FROM public.roles r
    WHERE (v_role = 'service_role' AND v_caller_tenant IS NULL)
       OR r.tenant_id = v_caller_tenant
  ),
  builtin AS (
    SELECT * FROM public.default_role_catalog()
  ),
  all_keys AS (
    SELECT b.role_key AS rkey FROM builtin b
    UNION
    SELECT sr.rkey FROM stored_roles sr
    UNION
    SELECT pc.rkey FROM profile_counts pc WHERE pc.rkey <> 'unassigned'
  )
  SELECT
    sr.id AS role_id,
    ak.rkey AS role_key,
    coalesce(
      sr.display_name,
      b.display_name,
      initcap(ak.rkey)
    ) AS display_name,
    coalesce(
      sr.description,
      b.description,
      'Custom school role.'
    ) AS description,
    coalesce(
      sr.staff_type,
      b.staff_type,
      CASE
        WHEN ak.rkey = 'teacher' THEN 'TEACHER'
        WHEN ak.rkey IN ('worker', 'secretary', 'messenger', 'librarian') THEN 'WORKER'
        ELSE 'OFFICIAL'
      END
    ) AS staff_type,
    coalesce(
      sr.scope,
      b.scope,
      'CUSTOM'
    ) AS scope,
    coalesce(pc.total_members, 0)::integer AS member_count,
    coalesce(pc.active_members, 0)::integer AS active_count,
    coalesce(pc.inactive_members, 0)::integer AS inactive_count,
    CASE
      WHEN sr.id IS NOT NULL AND (sr.permissions_customized OR b.role_key IS NULL) THEN sr.stored_perms
      WHEN b.role_key IS NOT NULL THEN b.default_permissions
      ELSE COALESCE(sr.stored_perms, ARRAY[]::text[])
    END AS permission_codes
  FROM all_keys ak
  LEFT JOIN stored_roles sr ON sr.rkey = ak.rkey
  LEFT JOIN builtin b ON b.role_key = ak.rkey
  LEFT JOIN profile_counts pc ON pc.rkey = ak.rkey
  ORDER BY
    CASE WHEN coalesce(sr.scope, b.scope, 'CUSTOM') = 'GLOBAL' THEN 0 ELSE 1 END,
    coalesce(pc.total_members, 0) DESC,
    coalesce(sr.display_name, b.display_name, initcap(ak.rkey));
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. upsert_custom_role: create a custom role or update role & permissions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_custom_role(
  p_role_key text,
  p_display_name text,
  p_description text DEFAULT '',
  p_staff_type text DEFAULT 'OFFICIAL',
  p_permission_codes text[] DEFAULT ARRAY[]::text[]
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_key TEXT;
  v_scope TEXT;
  v_role_id UUID;
  v_code TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  IF p_display_name IS NULL OR btrim(p_display_name) = '' THEN
    RAISE EXCEPTION 'Role name is required';
  END IF;

  IF p_staff_type IS NULL OR p_staff_type NOT IN ('TEACHER', 'OFFICIAL', 'WORKER') THEN
    RAISE EXCEPTION 'Invalid staff type: must be TEACHER, OFFICIAL or WORKER';
  END IF;

  v_key := public.normalize_role_key(coalesce(nullif(btrim(p_role_key), ''), p_display_name));
  IF v_key = 'unassigned' THEN
    RAISE EXCEPTION 'Role name is required';
  END IF;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.default_role_catalog() b WHERE b.role_key = v_key
  ) THEN 'GLOBAL' ELSE 'CUSTOM' END INTO v_scope;

  INSERT INTO public.roles (
    tenant_id, "key", display_name, description, staff_type, scope, permissions_customized
  )
  VALUES (
    v_caller_tenant,
    v_key,
    btrim(p_display_name),
    coalesce(btrim(p_description), ''),
    p_staff_type,
    v_scope,
    true
  )
  ON CONFLICT (tenant_id, "key") DO UPDATE SET
    display_name           = EXCLUDED.display_name,
    description            = EXCLUDED.description,
    staff_type             = EXCLUDED.staff_type,
    permissions_customized = true
  RETURNING id INTO v_role_id;

  DELETE FROM public.role_permissions WHERE role_id = v_role_id;

  IF p_permission_codes IS NOT NULL THEN
    FOREACH v_code IN ARRAY p_permission_codes LOOP
      IF EXISTS (SELECT 1 FROM public.permissions pm WHERE pm.code = v_code) THEN
        INSERT INTO public.role_permissions (role_id, permission_code)
        VALUES (v_role_id, v_code)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_role_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. delete_custom_role: delete a custom role when no accounts hold it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_custom_role(p_role_key text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_key TEXT;
  v_role_row RECORD;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  v_key := public.normalize_role_key(p_role_key);

  IF EXISTS (SELECT 1 FROM public.default_role_catalog() b WHERE b.role_key = v_key) THEN
    RAISE EXCEPTION 'Global roles cannot be deleted';
  END IF;

  SELECT * INTO v_role_row
  FROM public.roles r
  WHERE r.tenant_id = v_caller_tenant AND r."key" = v_key;

  IF v_role_row.id IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  IF v_role_row.scope = 'GLOBAL' THEN
    RAISE EXCEPTION 'Global roles cannot be deleted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.tenant_id = v_caller_tenant
      AND public.normalize_role_key(p.role) = v_key
  ) THEN
    RAISE EXCEPTION 'Cannot delete a role while accounts are assigned to it';
  END IF;

  DELETE FROM public.roles WHERE id = v_role_row.id;
  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. get_user_permission_profile: role permissions + per-user GRANT/DENY
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_permission_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_target RECORD;
  v_role_key TEXT;
  v_role_perms TEXT[];
  v_granted TEXT[];
  v_denied TEXT[];
  v_effective TEXT[];
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;
  END IF;

  SELECT
    p.id,
    p.tenant_id,
    p.full_name,
    coalesce(nullif(btrim(p.email), ''), u.email) AS email,
    p.role,
    coalesce(
      p.staff_type,
      CASE
        WHEN public.normalize_role_key(p.role) = 'teacher' THEN 'TEACHER'
        WHEN public.normalize_role_key(p.role) IN ('worker', 'secretary', 'messenger', 'librarian') THEN 'WORKER'
        ELSE 'OFFICIAL'
      END
    ) AS staff_type,
    p.is_active,
    p.access_revoked
  INTO v_target
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_user_id;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_target.tenant_id <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to account from different tenant';
  END IF;

  v_role_key := public.normalize_role_key(v_target.role);

  -- Resolve role permissions: customized tenant role first, else built-in catalog.
  SELECT
    CASE
      WHEN r.id IS NOT NULL AND (r.permissions_customized OR b.role_key IS NULL) THEN
        ARRAY(
          SELECT rp.permission_code
          FROM public.role_permissions rp
          JOIN public.permissions pm ON pm.code = rp.permission_code
          WHERE rp.role_id = r.id
          ORDER BY pm.sort_order, pm.code
        )
      WHEN b.role_key IS NOT NULL THEN b.default_permissions
      ELSE ARRAY[]::text[]
    END
  INTO v_role_perms
  FROM (SELECT v_role_key AS rk) k
  LEFT JOIN public.roles r
    ON r.tenant_id = v_target.tenant_id AND r."key" = k.rk
  LEFT JOIN public.default_role_catalog() b
    ON b.role_key = k.rk;

  v_role_perms := coalesce(v_role_perms, ARRAY[]::text[]);

  SELECT
    coalesce(array_agg(up.permission_code ORDER BY up.permission_code) FILTER (WHERE up.effect = 'GRANT'), ARRAY[]::text[]),
    coalesce(array_agg(up.permission_code ORDER BY up.permission_code) FILTER (WHERE up.effect = 'DENY'),  ARRAY[]::text[])
  INTO v_granted, v_denied
  FROM public.user_permissions up
  WHERE up.user_id = v_target.id
    AND up.tenant_id = v_target.tenant_id;

  IF v_target.access_revoked OR NOT v_target.is_active THEN
    v_effective := ARRAY[]::text[];
  ELSE
    SELECT coalesce(array_agg(pm.code ORDER BY pm.sort_order, pm.code), ARRAY[]::text[])
    INTO v_effective
    FROM public.permissions pm
    WHERE (pm.code = ANY(v_role_perms) OR pm.code = ANY(v_granted))
      AND NOT (pm.code = ANY(v_denied));
  END IF;

  RETURN jsonb_build_object(
    'account_id',            v_target.id,
    'full_name',             v_target.full_name,
    'email',                 v_target.email,
    'role',                  v_target.role,
    'staff_type',            v_target.staff_type,
    'is_active',             v_target.is_active,
    'access_revoked',        v_target.access_revoked,
    'role_permissions',      to_jsonb(v_role_perms),
    'granted_overrides',     to_jsonb(v_granted),
    'denied_overrides',      to_jsonb(v_denied),
    'effective_permissions', to_jsonb(v_effective)
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 11. save_user_permission_overrides: per-user GRANT / DENY / clear overrides
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_user_permission_overrides(
  p_user_id uuid,
  p_grant_codes text[] DEFAULT ARRAY[]::text[],
  p_deny_codes text[] DEFAULT ARRAY[]::text[],
  p_clear_codes text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_target_tenant UUID;
  v_code TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  SELECT p.tenant_id INTO v_target_tenant
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_target_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to account from different tenant';
  END IF;

  IF p_clear_codes IS NOT NULL AND array_length(p_clear_codes, 1) > 0 THEN
    DELETE FROM public.user_permissions
    WHERE user_id = p_user_id
      AND tenant_id = v_target_tenant
      AND permission_code = ANY(p_clear_codes);
  END IF;

  IF p_grant_codes IS NOT NULL THEN
    FOREACH v_code IN ARRAY p_grant_codes LOOP
      IF EXISTS (SELECT 1 FROM public.permissions pm WHERE pm.code = v_code) THEN
        INSERT INTO public.user_permissions (user_id, tenant_id, permission_code, effect, updated_at)
        VALUES (p_user_id, v_target_tenant, v_code, 'GRANT', now())
        ON CONFLICT (user_id, permission_code) DO UPDATE SET
          effect     = 'GRANT',
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  IF p_deny_codes IS NOT NULL THEN
    FOREACH v_code IN ARRAY p_deny_codes LOOP
      IF EXISTS (SELECT 1 FROM public.permissions pm WHERE pm.code = v_code) THEN
        INSERT INTO public.user_permissions (user_id, tenant_id, permission_code, effect, updated_at)
        VALUES (p_user_id, v_target_tenant, v_code, 'DENY', now())
        ON CONFLICT (user_id, permission_code) DO UPDATE SET
          effect     = 'DENY',
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  RETURN public.get_user_permission_profile(p_user_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 12. set_user_access_revoked: Zeraki revokeAllAccess / restoreAccess
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_access_revoked(
  p_user_id uuid,
  p_revoked boolean
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_target_tenant UUID;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;

    IF p_revoked AND p_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Cannot revoke your own access';
    END IF;
  END IF;

  SELECT p.tenant_id INTO v_target_tenant
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_target_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to account from different tenant';
  END IF;

  UPDATE public.profiles
  SET access_revoked = coalesce(p_revoked, false)
  WHERE id = p_user_id
    AND tenant_id = v_target_tenant;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 13. invite_or_create_account & update_account_profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_or_create_account(
  p_full_name text,
  p_email text,
  p_role text,
  p_staff_type text DEFAULT 'TEACHER'
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_role TEXT;
  v_new_id UUID;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  v_clean_name := btrim(coalesce(p_full_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  v_clean_email := lower(btrim(coalesce(p_email, '')));
  IF v_clean_email = '' OR position('@' IN v_clean_email) = 0 THEN
    RAISE EXCEPTION 'Valid email address is required';
  END IF;

  v_clean_role := btrim(coalesce(p_role, ''));
  IF v_clean_role = '' THEN
    RAISE EXCEPTION 'Role is required';
  END IF;

  IF p_staff_type IS NULL OR p_staff_type NOT IN ('TEACHER', 'OFFICIAL', 'WORKER') THEN
    RAISE EXCEPTION 'Invalid staff type: must be TEACHER, OFFICIAL or WORKER';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.tenant_id = v_caller_tenant
      AND lower(coalesce(nullif(btrim(p.email), ''), u.email, '')) = v_clean_email
  ) THEN
    RAISE EXCEPTION 'An account with this email already exists';
  END IF;

  v_new_id := gen_random_uuid();

  INSERT INTO auth.users (id, email)
  VALUES (v_new_id, v_clean_email);

  INSERT INTO public.profiles (
    id, tenant_id, full_name, email, role, staff_type, is_active, access_revoked
  )
  VALUES (
    v_new_id,
    v_caller_tenant,
    v_clean_name,
    v_clean_email,
    v_clean_role,
    p_staff_type,
    true,
    false
  );

  RETURN v_new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_account_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_role text,
  p_staff_type text,
  p_is_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_target_tenant UUID;
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_role TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;

    IF p_user_id = auth.uid() AND NOT coalesce(p_is_active, true) THEN
      RAISE EXCEPTION 'Cannot deactivate your own account';
    END IF;
  END IF;

  SELECT p.tenant_id INTO v_target_tenant
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_target_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to account from different tenant';
  END IF;

  v_clean_name := btrim(coalesce(p_full_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  v_clean_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  IF v_clean_email IS NOT NULL AND position('@' IN v_clean_email) = 0 THEN
    RAISE EXCEPTION 'Valid email address is required';
  END IF;

  v_clean_role := btrim(coalesce(p_role, ''));
  IF v_clean_role = '' THEN
    RAISE EXCEPTION 'Role is required';
  END IF;

  IF p_staff_type IS NULL OR p_staff_type NOT IN ('TEACHER', 'OFFICIAL', 'WORKER') THEN
    RAISE EXCEPTION 'Invalid staff type: must be TEACHER, OFFICIAL or WORKER';
  END IF;

  UPDATE public.profiles
  SET
    full_name  = v_clean_name,
    email      = COALESCE(v_clean_email, email),
    role       = v_clean_role,
    staff_type = p_staff_type,
    is_active  = coalesce(p_is_active, true)
  WHERE id = p_user_id
    AND tenant_id = v_target_tenant;

  IF v_clean_email IS NOT NULL THEN
    UPDATE auth.users SET email = v_clean_email WHERE id = p_user_id;
  END IF;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 14. Section heads (chunk-POC2O2ZL.js: get / upsert / delete)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_section_heads()
RETURNS TABLE(
  section_head_id uuid,
  form_level text,
  user_id uuid,
  user_full_name text,
  user_email text,
  user_role text,
  staff_type text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    sh.id AS section_head_id,
    sh.form_level,
    sh.user_id,
    p.full_name AS user_full_name,
    coalesce(nullif(btrim(p.email), ''), u.email) AS user_email,
    p.role AS user_role,
    coalesce(p.staff_type, 'TEACHER') AS staff_type,
    sh.created_at
  FROM public.section_heads sh
  JOIN public.profiles p ON p.id = sh.user_id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE v_role = 'service_role'
     OR sh.tenant_id = v_caller_tenant
  ORDER BY sh.form_level, sh.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_section_head(
  p_form_level text,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_target_tenant UUID;
  v_id UUID;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  IF p_form_level IS NULL OR p_form_level NOT IN (
    'PRE_SCHOOL', 'KINDERGARTEN', 'LOWER_PRIMARY', 'UPPER_PRIMARY',
    'PRIMARY', 'JUNIOR_SCHOOL', 'SENIOR_SCHOOL', 'SECONDARY',
    'LOWER_SECONDARY', 'UPPER_SECONDARY', 'O_LEVEL', 'A_LEVEL',
    'COLLEGE', 'DP', 'MYP'
  ) THEN
    RAISE EXCEPTION 'Invalid form level';
  END IF;

  SELECT p.tenant_id INTO v_target_tenant
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_target_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to account from different tenant';
  END IF;

  INSERT INTO public.section_heads (tenant_id, form_level, user_id)
  VALUES (v_caller_tenant, p_form_level, p_user_id)
  ON CONFLICT (tenant_id, form_level) DO UPDATE SET
    user_id = EXCLUDED.user_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_section_head(p_section_head_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_target_tenant UUID;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  SELECT sh.tenant_id INTO v_target_tenant
  FROM public.section_heads sh
  WHERE sh.id = p_section_head_id;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Section head not found';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_target_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to section head from different tenant';
  END IF;

  DELETE FROM public.section_heads WHERE id = p_section_head_id;
  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 15. Explicit REVOKE / GRANT on all new functions (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.normalize_role_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_role_key(text) FROM anon;
REVOKE ALL ON FUNCTION public.default_role_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.default_role_catalog() FROM anon;
REVOKE ALL ON FUNCTION public.get_account_directory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_account_directory() FROM anon;
REVOKE ALL ON FUNCTION public.get_permission_catalogue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_permission_catalogue() FROM anon;
REVOKE ALL ON FUNCTION public.get_roles_with_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_roles_with_permissions() FROM anon;
REVOKE ALL ON FUNCTION public.upsert_custom_role(text, text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_custom_role(text, text, text, text, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.delete_custom_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_custom_role(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_permission_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_permission_profile(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.save_user_permission_overrides(uuid, text[], text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_user_permission_overrides(uuid, text[], text[], text[]) FROM anon;
REVOKE ALL ON FUNCTION public.set_user_access_revoked(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_access_revoked(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.invite_or_create_account(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invite_or_create_account(text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_account_profile(uuid, text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_account_profile(uuid, text, text, text, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.get_section_heads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_section_heads() FROM anon;
REVOKE ALL ON FUNCTION public.upsert_section_head(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_section_head(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_section_head(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_section_head(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.normalize_role_key(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.default_role_catalog() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_account_directory() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_permission_catalogue() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_roles_with_permissions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_custom_role(text, text, text, text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_custom_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_permission_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_user_permission_overrides(uuid, text[], text[], text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_access_revoked(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.invite_or_create_account(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_account_profile(uuid, text, text, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_section_heads() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_section_head(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_section_head(uuid) TO authenticated, service_role;
