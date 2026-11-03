-- TUSOME analytics: Zeraki-parity Student Directory, Profile & Enrollment
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- 1. Student top nav & search (chunk-A6H443AV.js, chunk-4GMC4GP6.js):
--      * /main/students/search  (permission: "search-student")
--      * /main/students/new     (permission: "add-students")
--      * /main/students/prof/:id  (profile, notes, diary, inbox, pathways,
--        analytics, linked-accounts, record-card)
-- 2. New student form (chunk-EUKYYCR2.js, chunk-3OHUCHC2.js):
--      * Key-in mode: name, admission number, gender, class/stream, guardian,
--        phone, KCPE, UPI, DOB, nationality, previous school, boarding status
--      * Upload mode: bulk Excel with 30+ columns

-- ---------------------------------------------------------------------------
-- 1. RLS write policies on students and student_enrollments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS students_admin_write ON public.students;
CREATE POLICY students_admin_write ON public.students
  FOR ALL
  USING (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director', 'teacher'
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
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director', 'teacher'
        )
    )
  );

DROP POLICY IF EXISTS student_enrollments_admin_write ON public.student_enrollments;
CREATE POLICY student_enrollments_admin_write ON public.student_enrollments
  FOR ALL
  USING (
    tenant_id = public.my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director', 'teacher'
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
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director', 'teacher'
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students, public.student_enrollments
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. get_student_directory: search students by name or admission number
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_directory(
  p_search text DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  student_id uuid,
  admission_no text,
  full_name text,
  gender text,
  class_id uuid,
  class_name text,
  stream_id uuid,
  stream_name text,
  academic_year integer,
  pathway_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_search TEXT;
  v_limit INT;
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

  v_search := nullif(btrim(coalesce(p_search, '')), '');
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);

  RETURN QUERY
  WITH latest_enrollment AS (
    SELECT DISTINCT ON (se.student_id)
      se.student_id,
      se.class_id,
      se.stream_id,
      se.academic_year
    FROM public.student_enrollments se
    WHERE v_role = 'service_role' OR se.tenant_id = v_caller_tenant
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  student_pathway AS (
    SELECT
      sp.student_id,
      pw.name AS pathway_name
    FROM public.student_pathways sp
    JOIN public.pathways pw ON pw.id = sp.pathway_id
  )
  SELECT
    s.id AS student_id,
    s.admission_no,
    s.full_name,
    s.gender,
    COALESCE(le.class_id, s.class_id) AS class_id,
    c.name AS class_name,
    COALESCE(le.stream_id, s.stream_id) AS stream_id,
    st.name AS stream_name,
    le.academic_year,
    sp.pathway_name,
    s.created_at
  FROM public.students s
  LEFT JOIN latest_enrollment le ON le.student_id = s.id
  LEFT JOIN public.classes c ON c.id = COALESCE(le.class_id, s.class_id)
  LEFT JOIN public.streams st ON st.id = COALESCE(le.stream_id, s.stream_id)
  LEFT JOIN student_pathway sp ON sp.student_id = s.id
  WHERE (v_role = 'service_role' OR s.tenant_id = v_caller_tenant)
    AND (
      v_search IS NULL
      OR s.full_name ILIKE '%' || v_search || '%'
      OR s.admission_no ILIKE '%' || v_search || '%'
    )
    AND (p_class_id IS NULL OR COALESCE(le.class_id, s.class_id) = p_class_id)
    AND (p_stream_id IS NULL OR COALESCE(le.stream_id, s.stream_id) = p_stream_id)
  ORDER BY s.full_name, s.admission_no
  LIMIT v_limit;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. get_student_profile: basic info + enrollment history for one student
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_profile(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_student_tenant UUID;
  v_student RECORD;
  v_enrollments JSONB;
  v_pathway TEXT;
  v_reports JSONB;
BEGIN
  SELECT s.tenant_id INTO v_student_tenant
  FROM public.students s
  WHERE s.id = p_student_id;

  IF v_student_tenant IS NULL THEN
    RAISE EXCEPTION 'Student not found';
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

    IF v_student_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to student from different tenant';
    END IF;
  END IF;

  SELECT
    s.id,
    s.admission_no,
    s.full_name,
    s.gender,
    s.class_id,
    s.stream_id,
    s.created_at
  INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'academic_year', se.academic_year,
      'class_id', se.class_id,
      'class_name', c.name,
      'stream_id', se.stream_id,
      'stream_name', st.name,
      'created_at', se.created_at
    ) ORDER BY se.academic_year DESC, se.created_at DESC
  ), '[]'::jsonb)
  INTO v_enrollments
  FROM public.student_enrollments se
  LEFT JOIN public.classes c ON c.id = se.class_id
  LEFT JOIN public.streams st ON st.id = se.stream_id
  WHERE se.student_id = p_student_id;

  SELECT pw.name INTO v_pathway
  FROM public.student_pathways sp
  JOIN public.pathways pw ON pw.id = sp.pathway_id
  WHERE sp.student_id = p_student_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'exam_id', e.id,
      'exam_name', e.name,
      'term', e.term,
      'academic_year', e.academic_year,
      'status', e.status
    ) ORDER BY e.created_at DESC
  ), '[]'::jsonb)
  INTO v_reports
  FROM public.exams e
  WHERE e.tenant_id = v_student_tenant
    AND e.status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.exam_id = e.id AND m.student_id = p_student_id
    );

  RETURN jsonb_build_object(
    'student_id', v_student.id,
    'admission_no', v_student.admission_no,
    'full_name', v_student.full_name,
    'gender', v_student.gender,
    'class_id', v_student.class_id,
    'stream_id', v_student.stream_id,
    'pathway', v_pathway,
    'created_at', v_student.created_at,
    'enrollments', v_enrollments,
    'published_exams_with_marks', v_reports
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. create_student: add a new student to the tenant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_student(
  p_admission_no text,
  p_full_name text,
  p_gender text DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL,
  p_academic_year integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_clean_admno TEXT;
  v_clean_name TEXT;
  v_student_id UUID;
  v_year INT;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'add-students') THEN
      RAISE EXCEPTION 'Access denied: add-students permission required';
    END IF;
  END IF;

  v_clean_admno := btrim(coalesce(p_admission_no, ''));
  IF v_clean_admno = '' THEN
    RAISE EXCEPTION 'Admission number is required';
  END IF;

  v_clean_name := btrim(coalesce(p_full_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Student full name is required';
  END IF;

  IF p_class_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = p_class_id AND c.tenant_id = v_caller_tenant
  ) THEN
    RAISE EXCEPTION 'Class not found in your school';
  END IF;

  IF p_stream_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.streams s WHERE s.id = p_stream_id AND s.tenant_id = v_caller_tenant
  ) THEN
    RAISE EXCEPTION 'Stream not found in your school';
  END IF;

  INSERT INTO public.students (tenant_id, admission_no, full_name, gender, class_id, stream_id)
  VALUES (v_caller_tenant, v_clean_admno, v_clean_name, nullif(btrim(coalesce(p_gender, '')), ''), p_class_id, p_stream_id)
  RETURNING id INTO v_student_id;

  v_year := COALESCE(p_academic_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);

  IF p_class_id IS NOT NULL THEN
    INSERT INTO public.student_enrollments (tenant_id, student_id, academic_year, class_id, stream_id)
    VALUES (v_caller_tenant, v_student_id, v_year, p_class_id, p_stream_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_student_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. update_student_profile: update basic student info
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_student_profile(
  p_student_id uuid,
  p_admission_no text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_student_tenant UUID;
BEGIN
  SELECT s.tenant_id INTO v_student_tenant
  FROM public.students s
  WHERE s.id = p_student_id;

  IF v_student_tenant IS NULL THEN
    RAISE EXCEPTION 'Student not found';
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

    IF v_student_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to student from different tenant';
    END IF;

    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'edit-student-profile') THEN
      RAISE EXCEPTION 'Access denied: edit-student-profile permission required';
    END IF;
  END IF;

  UPDATE public.students
  SET
    admission_no = COALESCE(nullif(btrim(coalesce(p_admission_no, '')), ''), admission_no),
    full_name    = COALESCE(nullif(btrim(coalesce(p_full_name, '')), ''), full_name),
    gender       = COALESCE(nullif(btrim(coalesce(p_gender, '')), ''), gender),
    class_id     = COALESCE(p_class_id, class_id),
    stream_id    = COALESCE(p_stream_id, stream_id)
  WHERE id = p_student_id
    AND tenant_id = v_student_tenant;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Explicit REVOKE / GRANT (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_student_directory(text, uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_student(text, text, text, uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_student_profile(uuid, text, text, text, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_student_directory(text, uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_student(text, text, text, uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_student_profile(uuid, text, text, text, uuid, uuid) TO authenticated, service_role;
