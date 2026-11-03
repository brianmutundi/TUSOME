-- TUSOME analytics: Zeraki-parity Teacher Accounts, Staff Groups, Class/Subject
-- Allocations & Teacher Subject Performance
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- 1. Teacher profile & spreadsheet attributes (chunk-3OHUCHC2.js, chunk-AR3VAYA2.js,
--    chunk-PWMULRVE.js, chunk-NQUWMUMC.js):
--      * initials (INITIALS), tscNumber / regNumber (TSC_NO), phone (PHONE),
--        nationalId (NATIONAL_ID_NO), employeeNumber (EMPLOYEE_NUMBER),
--        gender (GENDER), title (TITLE), group (GROUP).
-- 2. Teacher & staff groups (chunk-AR3VAYA2.js, chunk-3OHUCHC2.js):
--      * GET/POST/PUT/DELETE /staff/groups?staffType=TEACHER|OFFICIAL|WORKER
-- 3. Teacher sub-roles & class/subject allocations (chunk-4ELYURC5.js,
--    chunk-4HAJFXCS.js, chunk-7QNAQC7E.js):
--      * isSubjectTeacher   (permission: "assign-subject-teachers")
--      * isClassTeacher     (permission: "assign-class-teachers")
--      * isClassSupervisor  (permission: "assign-class-supervisors")
-- 4. Teacher Dashboard subject/class performance (chunk-GIPDWUAY.js):
--      * dashboard.welcome.teacherDashboard.subjectClassPerformance

-- ---------------------------------------------------------------------------
-- 1. Extend profiles with Zeraki teacher/staff attributes
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS initials text,
  ADD COLUMN IF NOT EXISTS tsc_number text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS employee_number text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS title text;

-- ---------------------------------------------------------------------------
-- 2. Staff groups & teacher allocation tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  staff_type text NOT NULL DEFAULT 'TEACHER'
    CHECK (staff_type IN ('TEACHER', 'OFFICIAL', 'WORKER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, staff_type, name)
);

CREATE TABLE IF NOT EXISTS public.staff_group_members (
  group_id uuid NOT NULL REFERENCES public.staff_groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.subject_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  stream_id uuid REFERENCES public.streams (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  academic_year integer NOT NULL DEFAULT 2026
    CHECK (academic_year BETWEEN 2000 AND 2100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, class_id, stream_id, subject_id, academic_year)
);

CREATE TABLE IF NOT EXISTS public.class_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  stream_id uuid REFERENCES public.streams (id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  academic_year integer NOT NULL DEFAULT 2026
    CHECK (academic_year BETWEEN 2000 AND 2100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, class_id, stream_id, academic_year)
);

CREATE TABLE IF NOT EXISTS public.class_supervisor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  academic_year integer NOT NULL DEFAULT 2026
    CHECK (academic_year BETWEEN 2000 AND 2100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, class_id, academic_year)
);

ALTER TABLE public.staff_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_supervisor_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_groups_tenant_select ON public.staff_groups;
CREATE POLICY staff_groups_tenant_select ON public.staff_groups
  FOR SELECT USING (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS staff_groups_tenant_write ON public.staff_groups;
CREATE POLICY staff_groups_tenant_write ON public.staff_groups
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS staff_group_members_tenant_select ON public.staff_group_members;
CREATE POLICY staff_group_members_tenant_select ON public.staff_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_groups sg
      WHERE sg.id = staff_group_members.group_id
        AND sg.tenant_id = public.my_tenant_id()
    )
  );

DROP POLICY IF EXISTS staff_group_members_tenant_write ON public.staff_group_members;
CREATE POLICY staff_group_members_tenant_write ON public.staff_group_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_groups sg
      WHERE sg.id = staff_group_members.group_id
        AND sg.tenant_id = public.my_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_groups sg
      WHERE sg.id = staff_group_members.group_id
        AND sg.tenant_id = public.my_tenant_id()
    )
  );

DROP POLICY IF EXISTS subject_teacher_assignments_tenant ON public.subject_teacher_assignments;
CREATE POLICY subject_teacher_assignments_tenant ON public.subject_teacher_assignments
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS class_teacher_assignments_tenant ON public.class_teacher_assignments;
CREATE POLICY class_teacher_assignments_tenant ON public.class_teacher_assignments
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS class_supervisor_assignments_tenant ON public.class_supervisor_assignments;
CREATE POLICY class_supervisor_assignments_tenant ON public.class_supervisor_assignments
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.staff_groups,
  public.staff_group_members,
  public.subject_teacher_assignments,
  public.class_teacher_assignments,
  public.class_supervisor_assignments
TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Effective permission helper: checks admin role OR effective permission
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id uuid,
  p_tenant_id uuid,
  p_permission_code text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_me RECORD;
  v_prof JSONB;
BEGIN
  IF p_user_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.id, p.role, p.is_active, p.access_revoked
  INTO v_me
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND p.tenant_id = p_tenant_id;

  IF v_me.id IS NULL OR NOT v_me.is_active OR v_me.access_revoked THEN
    RETURN false;
  END IF;

  IF public.normalize_role_key(v_me.role) IN (
    'admin', 'super admin', 'owner', 'principal', 'director'
  ) THEN
    RETURN true;
  END IF;

  v_prof := public.get_user_permission_profile(p_user_id);
  RETURN COALESCE((v_prof -> 'effective_permissions') ? p_permission_code, false);
END;
$function$;

-- Upgrade create_exam and set_exam_lifecycle_status so teachers granted
-- 'create-edit-exam' or 'manage-exams' overrides can also execute them.
CREATE OR REPLACE FUNCTION public.create_exam(
  p_name text,
  p_term text,
  p_academic_year integer,
  p_assessment_component text DEFAULT 'end_term',
  p_class_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_clean_name TEXT;
  v_clean_term TEXT;
  v_exam_id UUID;
  v_cid UUID;
  v_valid_classes INT := 0;
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
    IF NOT (
      public.user_has_permission(auth.uid(), v_caller_tenant, 'create-edit-exam')
      OR public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-exams')
    ) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  v_clean_name := btrim(coalesce(p_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Exam name is required';
  END IF;

  v_clean_term := COALESCE(nullif(btrim(p_term), ''), 'Term 1');

  IF p_academic_year IS NULL OR p_academic_year < 2000 OR p_academic_year > 2100 THEN
    RAISE EXCEPTION 'Academic year must be between 2000 and 2100';
  END IF;

  IF p_assessment_component IS NOT NULL
     AND p_assessment_component NOT IN ('test_exam', 'mid_term', 'end_term', 'annual') THEN
    RAISE EXCEPTION 'Invalid assessment component';
  END IF;

  IF p_class_ids IS NULL OR COALESCE(array_length(p_class_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one class sitting for the exam';
  END IF;

  INSERT INTO public.exams (
    tenant_id, name, term, academic_year, assessment_component, status
  )
  VALUES (
    v_caller_tenant,
    v_clean_name,
    v_clean_term,
    p_academic_year,
    COALESCE(p_assessment_component, 'end_term'),
    'draft'
  )
  RETURNING id INTO v_exam_id;

  FOREACH v_cid IN ARRAY p_class_ids LOOP
    IF EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = v_cid AND c.tenant_id = v_caller_tenant
    ) THEN
      INSERT INTO public.exam_classes (exam_id, class_id)
      VALUES (v_exam_id, v_cid)
      ON CONFLICT DO NOTHING;
      v_valid_classes := v_valid_classes + 1;
    END IF;
  END LOOP;

  IF v_valid_classes = 0 THEN
    RAISE EXCEPTION 'None of the selected classes belong to your school';
  END IF;

  RETURN v_exam_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_exam_lifecycle_status(
  p_exam_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  SELECT e.tenant_id INTO v_exam_tenant
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

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

    IF v_exam_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to exam from different tenant';
    END IF;

    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-exams') THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('draft', 'review', 'published', 'reopened') THEN
    RAISE EXCEPTION 'Invalid exam status';
  END IF;

  IF p_status = 'published' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.grading_configurations gc
      WHERE gc.tenant_id = v_exam_tenant AND gc.active = true
    ) THEN
      RAISE EXCEPTION 'Cannot publish exam: no active grading configuration';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.exam_id = p_exam_id AND m.tenant_id = v_exam_tenant
    ) THEN
      RAISE EXCEPTION 'Cannot publish exam: no marks have been entered';
    END IF;
  END IF;

  UPDATE public.exams
  SET status = p_status
  WHERE id = p_exam_id
    AND tenant_id = v_exam_tenant;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. get_teacher_directory & upsert_teacher_profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_teacher_directory()
RETURNS TABLE(
  account_id uuid,
  full_name text,
  email text,
  phone text,
  initials text,
  tsc_number text,
  national_id text,
  employee_number text,
  gender text,
  "role" text,
  staff_type text,
  is_active boolean,
  access_revoked boolean,
  group_names text[],
  subject_assignments_count integer,
  class_teacher_labels text[],
  supervisor_labels text[],
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
    p.phone,
    p.initials,
    p.tsc_number,
    p.national_id,
    p.employee_number,
    p.gender,
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
    p.access_revoked,
    COALESCE(
      ARRAY(
        SELECT sg.name
        FROM public.staff_group_members sgm
        JOIN public.staff_groups sg ON sg.id = sgm.group_id
        WHERE sgm.user_id = p.id
        ORDER BY sg.name
      ),
      ARRAY[]::text[]
    ) AS group_names,
    (
      SELECT count(*)::integer
      FROM public.subject_teacher_assignments sta
      WHERE sta.teacher_id = p.id
    ) AS subject_assignments_count,
    COALESCE(
      ARRAY(
        SELECT c.name || COALESCE(' ' || st.name, '')
        FROM public.class_teacher_assignments cta
        JOIN public.classes c ON c.id = cta.class_id
        LEFT JOIN public.streams st ON st.id = cta.stream_id
        WHERE cta.teacher_id = p.id
        ORDER BY c.name, st.name
      ),
      ARRAY[]::text[]
    ) AS class_teacher_labels,
    COALESCE(
      ARRAY(
        SELECT c.name
        FROM public.class_supervisor_assignments csa
        JOIN public.classes c ON c.id = csa.class_id
        WHERE csa.teacher_id = p.id
        ORDER BY c.name
      ),
      ARRAY[]::text[]
    ) AS supervisor_labels,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE (v_role = 'service_role' OR p.tenant_id = v_caller_tenant)
    AND coalesce(
      p.staff_type,
      CASE
        WHEN public.normalize_role_key(p.role) = 'teacher' THEN 'TEACHER'
        WHEN public.normalize_role_key(p.role) IN ('worker', 'secretary', 'messenger', 'librarian') THEN 'WORKER'
        ELSE 'OFFICIAL'
      END
    ) IN ('TEACHER', 'OFFICIAL')
  ORDER BY lower(coalesce(p.full_name, '')), p.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_teacher_profile(
  p_user_id uuid DEFAULT NULL,
  p_full_name text DEFAULT '',
  p_email text DEFAULT '',
  p_phone text DEFAULT NULL,
  p_initials text DEFAULT NULL,
  p_tsc_number text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_employee_number text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_role text DEFAULT 'teacher',
  p_group_names text[] DEFAULT ARRAY[]::text[],
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_target_id UUID;
  v_target_tenant UUID;
  v_clean_name TEXT;
  v_clean_email TEXT;
  v_clean_initials TEXT;
  v_gname TEXT;
  v_gid UUID;
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
    IF NOT (
      public.user_has_permission(auth.uid(), v_caller_tenant, 'add-teachers')
      OR public.user_has_permission(auth.uid(), v_caller_tenant, 'edit-teacher-profile')
    ) THEN
      RAISE EXCEPTION 'Access denied: administrator or teacher-manager permission required';
    END IF;
  END IF;

  v_clean_name := btrim(coalesce(p_full_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Teacher full name is required';
  END IF;

  v_clean_email := lower(btrim(coalesce(p_email, '')));
  IF v_clean_email = '' OR position('@' IN v_clean_email) = 0 THEN
    RAISE EXCEPTION 'Valid email address is required';
  END IF;

  v_clean_initials := nullif(upper(btrim(coalesce(p_initials, ''))), '');
  IF v_clean_initials IS NOT NULL AND char_length(v_clean_initials) > 12 THEN
    RAISE EXCEPTION 'Teacher initials cannot exceed 12 characters';
  END IF;

  IF p_user_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      WHERE p.tenant_id = v_caller_tenant
        AND lower(coalesce(nullif(btrim(p.email), ''), u.email, '')) = v_clean_email
    ) THEN
      RAISE EXCEPTION 'An account with this email already exists';
    END IF;

    v_target_id := gen_random_uuid();
    v_target_tenant := v_caller_tenant;

    INSERT INTO auth.users (id, email)
    VALUES (v_target_id, v_clean_email);

    INSERT INTO public.profiles (
      id, tenant_id, full_name, email, phone, initials, tsc_number,
      national_id, employee_number, gender, role, staff_type, is_active, access_revoked
    )
    VALUES (
      v_target_id,
      v_caller_tenant,
      v_clean_name,
      v_clean_email,
      nullif(btrim(coalesce(p_phone, '')), ''),
      v_clean_initials,
      nullif(btrim(coalesce(p_tsc_number, '')), ''),
      nullif(btrim(coalesce(p_national_id, '')), ''),
      nullif(btrim(coalesce(p_employee_number, '')), ''),
      nullif(btrim(coalesce(p_gender, '')), ''),
      COALESCE(nullif(btrim(coalesce(p_role, '')), ''), 'teacher'),
      'TEACHER',
      coalesce(p_is_active, true),
      false
    );
  ELSE
    SELECT p.tenant_id INTO v_target_tenant
    FROM public.profiles p
    WHERE p.id = p_user_id;

    IF v_target_tenant IS NULL THEN
      RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_role IS DISTINCT FROM 'service_role' AND v_target_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to account from different tenant';
    END IF;

    v_target_id := p_user_id;

    UPDATE public.profiles
    SET
      full_name       = v_clean_name,
      email           = v_clean_email,
      phone           = nullif(btrim(coalesce(p_phone, '')), ''),
      initials        = v_clean_initials,
      tsc_number      = nullif(btrim(coalesce(p_tsc_number, '')), ''),
      national_id     = nullif(btrim(coalesce(p_national_id, '')), ''),
      employee_number = nullif(btrim(coalesce(p_employee_number, '')), ''),
      gender          = nullif(btrim(coalesce(p_gender, '')), ''),
      role            = COALESCE(nullif(btrim(coalesce(p_role, '')), ''), role),
      is_active       = coalesce(p_is_active, is_active)
    WHERE id = v_target_id
      AND tenant_id = v_target_tenant;

    UPDATE auth.users SET email = v_clean_email WHERE id = v_target_id;
  END IF;

  -- Sync group memberships when p_group_names is provided.
  DELETE FROM public.staff_group_members WHERE user_id = v_target_id;

  IF p_group_names IS NOT NULL THEN
    FOREACH v_gname IN ARRAY p_group_names LOOP
      IF btrim(coalesce(v_gname, '')) <> '' THEN
        INSERT INTO public.staff_groups (tenant_id, name, staff_type)
        VALUES (v_target_tenant, btrim(v_gname), 'TEACHER')
        ON CONFLICT (tenant_id, staff_type, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_gid;

        INSERT INTO public.staff_group_members (group_id, user_id)
        VALUES (v_gid, v_target_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_target_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Staff groups RPCs (get / upsert / delete)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_groups()
RETURNS TABLE(
  group_id uuid,
  name text,
  staff_type text,
  member_count integer,
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
    sg.id AS group_id,
    sg.name,
    sg.staff_type,
    count(sgm.user_id)::integer AS member_count,
    sg.created_at
  FROM public.staff_groups sg
  LEFT JOIN public.staff_group_members sgm ON sgm.group_id = sg.id
  WHERE v_role = 'service_role' OR sg.tenant_id = v_caller_tenant
  GROUP BY sg.id, sg.name, sg.staff_type, sg.created_at
  ORDER BY sg.staff_type, sg.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_staff_group(
  p_name text,
  p_staff_type text DEFAULT 'TEACHER'
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_clean_name TEXT;
  v_gid UUID;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'add-teachers') THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  v_clean_name := btrim(coalesce(p_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  IF p_staff_type IS NULL OR p_staff_type NOT IN ('TEACHER', 'OFFICIAL', 'WORKER') THEN
    RAISE EXCEPTION 'Invalid staff type';
  END IF;

  INSERT INTO public.staff_groups (tenant_id, name, staff_type)
  VALUES (v_caller_tenant, v_clean_name, p_staff_type)
  ON CONFLICT (tenant_id, staff_type, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_gid;

  RETURN v_gid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_staff_group(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
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

    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'add-teachers') THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  SELECT sg.tenant_id INTO v_target_tenant
  FROM public.staff_groups sg
  WHERE sg.id = p_group_id;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Staff group not found';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_target_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to staff group from different tenant';
  END IF;

  DELETE FROM public.staff_groups WHERE id = p_group_id;
  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Teacher Allocations: Subject Teachers, Class Teachers, Class Supervisors
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_teacher_allocations(
  p_academic_year integer DEFAULT NULL
)
RETURNS TABLE(
  allocation_id uuid,
  allocation_type text,
  academic_year integer,
  class_id uuid,
  class_name text,
  stream_id uuid,
  stream_name text,
  subject_id uuid,
  subject_name text,
  subject_code text,
  teacher_id uuid,
  teacher_name text,
  teacher_initials text,
  teacher_tsc_number text
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
  SELECT * FROM (
    SELECT
      sta.id AS allocation_id,
      'SUBJECT_TEACHER'::text AS allocation_type,
      sta.academic_year,
      sta.class_id,
      c.name AS class_name,
      sta.stream_id,
      st.name AS stream_name,
      sta.subject_id,
      sub.name AS subject_name,
      COALESCE(sub.code, '') AS subject_code,
      sta.teacher_id,
      p.full_name AS teacher_name,
      p.initials AS teacher_initials,
      p.tsc_number AS teacher_tsc_number
    FROM public.subject_teacher_assignments sta
    JOIN public.classes c ON c.id = sta.class_id
    LEFT JOIN public.streams st ON st.id = sta.stream_id
    JOIN public.subjects sub ON sub.id = sta.subject_id
    JOIN public.profiles p ON p.id = sta.teacher_id
    WHERE (v_role = 'service_role' OR sta.tenant_id = v_caller_tenant)
      AND (p_academic_year IS NULL OR sta.academic_year = p_academic_year)

    UNION ALL

    SELECT
      cta.id AS allocation_id,
      'CLASS_TEACHER'::text AS allocation_type,
      cta.academic_year,
      cta.class_id,
      c.name AS class_name,
      cta.stream_id,
      st.name AS stream_name,
      NULL::uuid AS subject_id,
      NULL::text AS subject_name,
      NULL::text AS subject_code,
      cta.teacher_id,
      p.full_name AS teacher_name,
      p.initials AS teacher_initials,
      p.tsc_number AS teacher_tsc_number
    FROM public.class_teacher_assignments cta
    JOIN public.classes c ON c.id = cta.class_id
    LEFT JOIN public.streams st ON st.id = cta.stream_id
    JOIN public.profiles p ON p.id = cta.teacher_id
    WHERE (v_role = 'service_role' OR cta.tenant_id = v_caller_tenant)
      AND (p_academic_year IS NULL OR cta.academic_year = p_academic_year)

    UNION ALL

    SELECT
      csa.id AS allocation_id,
      'CLASS_SUPERVISOR'::text AS allocation_type,
      csa.academic_year,
      csa.class_id,
      c.name AS class_name,
      NULL::uuid AS stream_id,
      NULL::text AS stream_name,
      NULL::uuid AS subject_id,
      NULL::text AS subject_name,
      NULL::text AS subject_code,
      csa.teacher_id,
      p.full_name AS teacher_name,
      p.initials AS teacher_initials,
      p.tsc_number AS teacher_tsc_number
    FROM public.class_supervisor_assignments csa
    JOIN public.classes c ON c.id = csa.class_id
    JOIN public.profiles p ON p.id = csa.teacher_id
    WHERE (v_role = 'service_role' OR csa.tenant_id = v_caller_tenant)
      AND (p_academic_year IS NULL OR csa.academic_year = p_academic_year)
  ) all_allocs
  ORDER BY
    all_allocs.academic_year DESC,
    all_allocs.class_name,
    COALESCE(all_allocs.stream_name, ''),
    all_allocs.allocation_type,
    COALESCE(all_allocs.subject_name, '');
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_teacher_allocation(
  p_allocation_type text,
  p_class_id uuid,
  p_stream_id uuid DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_teacher_id uuid DEFAULT NULL,
  p_academic_year integer DEFAULT 2026
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_perm_needed TEXT;
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

  IF p_allocation_type IS NULL
     OR p_allocation_type NOT IN ('SUBJECT_TEACHER', 'CLASS_TEACHER', 'CLASS_SUPERVISOR') THEN
    RAISE EXCEPTION 'Invalid allocation type';
  END IF;

  v_perm_needed := CASE p_allocation_type
    WHEN 'SUBJECT_TEACHER'  THEN 'assign-subject-teachers'
    WHEN 'CLASS_TEACHER'    THEN 'assign-class-teachers'
    WHEN 'CLASS_SUPERVISOR' THEN 'assign-class-supervisors'
  END;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, v_perm_needed) THEN
      RAISE EXCEPTION 'Access denied: missing permission %', v_perm_needed;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = p_class_id AND c.tenant_id = v_caller_tenant
  ) THEN
    RAISE EXCEPTION 'Class not found in your school';
  END IF;

  IF p_stream_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.streams s
    WHERE s.id = p_stream_id AND s.class_id = p_class_id AND s.tenant_id = v_caller_tenant
  ) THEN
    RAISE EXCEPTION 'Stream not found in the selected class';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_teacher_id AND p.tenant_id = v_caller_tenant
  ) THEN
    RAISE EXCEPTION 'Teacher account not found in your school';
  END IF;

  IF p_allocation_type = 'SUBJECT_TEACHER' THEN
    IF p_subject_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.subjects sub WHERE sub.id = p_subject_id AND sub.tenant_id = v_caller_tenant
    ) THEN
      RAISE EXCEPTION 'Subject is required for subject teacher assignment';
    END IF;

    INSERT INTO public.subject_teacher_assignments (
      tenant_id, class_id, stream_id, subject_id, teacher_id, academic_year
    )
    VALUES (
      v_caller_tenant, p_class_id, p_stream_id, p_subject_id, p_teacher_id, COALESCE(p_academic_year, 2026)
    )
    ON CONFLICT (tenant_id, class_id, stream_id, subject_id, academic_year) DO UPDATE SET
      teacher_id = EXCLUDED.teacher_id
    RETURNING id INTO v_id;

  ELSIF p_allocation_type = 'CLASS_TEACHER' THEN
    INSERT INTO public.class_teacher_assignments (
      tenant_id, class_id, stream_id, teacher_id, academic_year
    )
    VALUES (
      v_caller_tenant, p_class_id, p_stream_id, p_teacher_id, COALESCE(p_academic_year, 2026)
    )
    ON CONFLICT (tenant_id, class_id, stream_id, academic_year) DO UPDATE SET
      teacher_id = EXCLUDED.teacher_id
    RETURNING id INTO v_id;

  ELSE
    INSERT INTO public.class_supervisor_assignments (
      tenant_id, class_id, teacher_id, academic_year
    )
    VALUES (
      v_caller_tenant, p_class_id, p_teacher_id, COALESCE(p_academic_year, 2026)
    )
    ON CONFLICT (tenant_id, class_id, academic_year) DO UPDATE SET
      teacher_id = EXCLUDED.teacher_id
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_teacher_allocation(
  p_allocation_type text,
  p_allocation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_perm_needed TEXT;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF p_allocation_type IS NULL
     OR p_allocation_type NOT IN ('SUBJECT_TEACHER', 'CLASS_TEACHER', 'CLASS_SUPERVISOR') THEN
    RAISE EXCEPTION 'Invalid allocation type';
  END IF;

  v_perm_needed := CASE p_allocation_type
    WHEN 'SUBJECT_TEACHER'  THEN 'assign-subject-teachers'
    WHEN 'CLASS_TEACHER'    THEN 'assign-class-teachers'
    WHEN 'CLASS_SUPERVISOR' THEN 'assign-class-supervisors'
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

    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, v_perm_needed) THEN
      RAISE EXCEPTION 'Access denied: missing permission %', v_perm_needed;
    END IF;
  END IF;

  IF p_allocation_type = 'SUBJECT_TEACHER' THEN
    DELETE FROM public.subject_teacher_assignments
    WHERE id = p_allocation_id
      AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);
  ELSIF p_allocation_type = 'CLASS_TEACHER' THEN
    DELETE FROM public.class_teacher_assignments
    WHERE id = p_allocation_id
      AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);
  ELSE
    DELETE FROM public.class_supervisor_assignments
    WHERE id = p_allocation_id
      AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);
  END IF;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. get_teacher_subject_class_performance (Zeraki Teacher Dashboard parity)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_teacher_subject_class_performance(
  p_exam_id uuid,
  p_teacher_id uuid DEFAULT NULL
)
RETURNS TABLE(
  allocation_id uuid,
  teacher_id uuid,
  teacher_name text,
  teacher_initials text,
  class_id uuid,
  class_name text,
  stream_id uuid,
  stream_name text,
  subject_id uuid,
  subject_name text,
  subject_code text,
  students_count integer,
  mean_score numeric,
  mean_grade text,
  mean_points integer,
  pass_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_exam_status TEXT;
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  SELECT e.tenant_id, e.status INTO v_exam_tenant, v_exam_status
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  IF v_exam_status <> 'published' THEN
    RAISE EXCEPTION 'Exam is not published';
  END IF;

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

    IF v_exam_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to exam from different tenant';
    END IF;
  END IF;

  RETURN QUERY
  WITH latest_enrollment AS (
    SELECT DISTINCT ON (se.student_id)
      se.student_id,
      se.class_id,
      se.stream_id
    FROM public.student_enrollments se
    WHERE se.tenant_id = v_exam_tenant
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  scoped_marks AS (
    SELECT
      m.student_id,
      m.subject_id,
      m.score,
      COALESCE(le.class_id, s.class_id) AS eff_class_id,
      COALESCE(le.stream_id, s.stream_id) AS eff_stream_id
    FROM public.marks m
    JOIN public.students s ON s.id = m.student_id
    LEFT JOIN latest_enrollment le ON le.student_id = s.id
    WHERE m.exam_id = p_exam_id
      AND m.tenant_id = v_exam_tenant
  ),
  alloc_stats AS (
    SELECT
      sta.id AS alloc_id,
      sta.teacher_id AS tid,
      p.full_name AS tname,
      p.initials AS tinit,
      sta.class_id AS cid,
      c.name AS cname,
      sta.stream_id AS stid,
      st.name AS stname,
      sta.subject_id AS subid,
      sub.name AS subname,
      COALESCE(sub.code, '') AS subcode,
      count(sm.student_id)::integer AS scount,
      ROUND(AVG(sm.score), 2) AS mscore,
      CASE
        WHEN count(sm.student_id) > 0 THEN
          ROUND((count(*) FILTER (WHERE sm.score >= 40)::numeric / count(sm.student_id)::numeric) * 100, 2)
        ELSE 0::numeric
      END AS prate
    FROM public.subject_teacher_assignments sta
    JOIN public.profiles p ON p.id = sta.teacher_id
    JOIN public.classes c ON c.id = sta.class_id
    LEFT JOIN public.streams st ON st.id = sta.stream_id
    JOIN public.subjects sub ON sub.id = sta.subject_id
    LEFT JOIN scoped_marks sm
      ON sm.subject_id = sta.subject_id
     AND sm.eff_class_id = sta.class_id
     AND (sta.stream_id IS NULL OR sm.eff_stream_id = sta.stream_id)
    WHERE sta.tenant_id = v_exam_tenant
      AND (p_teacher_id IS NULL OR sta.teacher_id = p_teacher_id)
    GROUP BY
      sta.id, sta.teacher_id, p.full_name, p.initials,
      sta.class_id, c.name, sta.stream_id, st.name,
      sta.subject_id, sub.name, sub.code
  )
  SELECT
    a.alloc_id AS allocation_id,
    a.tid AS teacher_id,
    a.tname AS teacher_name,
    a.tinit AS teacher_initials,
    a.cid AS class_id,
    a.cname AS class_name,
    a.stid AS stream_id,
    a.stname AS stream_name,
    a.subid AS subject_id,
    a.subname AS subject_name,
    a.subcode AS subject_code,
    a.scount AS students_count,
    COALESCE(a.mscore, 0)::numeric AS mean_score,
    g.code AS mean_grade,
    g.points AS mean_points,
    a.prate AS pass_rate
  FROM alloc_stats a
  LEFT JOIN LATERAL public.get_grade_for_score(v_exam_tenant, a.mscore, 'default', NULL) g
    ON a.mscore IS NOT NULL
  ORDER BY a.cname, COALESCE(a.stname, ''), a.subname;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Explicit REVOKE / GRANT (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.user_has_permission(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_teacher_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_teacher_profile(uuid, text, text, text, text, text, text, text, text, text, text[], boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_staff_groups() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_staff_group(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_staff_group(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_teacher_allocations(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_teacher_allocation(text, uuid, uuid, uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_teacher_allocation(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_teacher_subject_class_performance(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_teacher_directory() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_teacher_profile(uuid, text, text, text, text, text, text, text, text, text, text[], boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_staff_groups() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_staff_group(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_staff_group(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_teacher_allocations(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_teacher_allocation(text, uuid, uuid, uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_teacher_allocation(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_teacher_subject_class_performance(uuid, uuid) TO authenticated, service_role;
