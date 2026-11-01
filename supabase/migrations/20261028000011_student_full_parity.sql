-- TUSOME analytics: Full Zeraki-parity Student/Learner Features
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Implements all previously blocked student features:
--   1. Extended student profile (KCPE, UPI, national ID, guardian, contact,
--      demographics, boarding, house, NHIF, Zeraki Pay Code, in-school status)
--   2. Student notes
--   3. Student groups
--   4. Student residences
--   5. Move students (promote, demote, graduate, expel, transfer streams)
--   6. Student photo upload support

-- ===========================================================================
-- 1. EXTEND students TABLE WITH ALL ZERAKI FIELDS
-- ===========================================================================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS upi text,
  ADD COLUMN IF NOT EXISTS index_number text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS sha text,
  ADD COLUMN IF NOT EXISTS kcpe_score numeric,
  ADD COLUMN IF NOT EXISTS kcpe_grade text,
  ADD COLUMN IF NOT EXISTS kcpe_year integer,
  ADD COLUMN IF NOT EXISTS kcpe_index text,
  ADD COLUMN IF NOT EXISTS kcpe_entry_position integer,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS place_of_birth text,
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_relation text,
  ADD COLUMN IF NOT EXISTS primary_phone text,
  ADD COLUMN IF NOT EXISTS primary_phone_2 text,
  ADD COLUMN IF NOT EXISTS secondary_phone text,
  ADD COLUMN IF NOT EXISTS secondary_phone_2 text,
  ADD COLUMN IF NOT EXISTS previous_school text,
  ADD COLUMN IF NOT EXISTS admission_date date,
  ADD COLUMN IF NOT EXISTS boarding_status text CHECK (boarding_status IS NULL OR boarding_status IN ('Day', 'Boarding')),
  ADD COLUMN IF NOT EXISTS house text,
  ADD COLUMN IF NOT EXISTS nhif text,
  ADD COLUMN IF NOT EXISTS zeraki_pay_code text,
  ADD COLUMN IF NOT EXISTS in_school_status text DEFAULT 'Active' CHECK (in_school_status IS NULL OR in_school_status IN ('Active', 'Graduated', 'Expelled', 'Transferred', 'Demoted')),
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS regime integer,
  ADD COLUMN IF NOT EXISTS internal_status integer,
  ADD COLUMN IF NOT EXISTS assigned_status integer,
  ADD COLUMN IF NOT EXISTS general_comments text,
  ADD COLUMN IF NOT EXISTS birth_cert_number text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS current_pathway text,
  ADD COLUMN IF NOT EXISTS current_track text;

-- ===========================================================================
-- 2. STUDENT NOTES
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  note_type text NOT NULL DEFAULT 'general' CHECK (note_type IN ('general', 'academic', 'behavioural', 'medical', 'disciplinary')),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_notes_tenant ON public.student_notes;
CREATE POLICY student_notes_tenant ON public.student_notes
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_notes TO authenticated, service_role;

-- ===========================================================================
-- 3. STUDENT GROUPS
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.student_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.student_group_members (
  group_id uuid NOT NULL REFERENCES public.student_groups (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, student_id)
);

ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_groups_tenant ON public.student_groups;
CREATE POLICY student_groups_tenant ON public.student_groups
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS student_group_members_tenant ON public.student_group_members;
CREATE POLICY student_group_members_tenant ON public.student_group_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.student_groups sg
      WHERE sg.id = student_group_members.group_id
        AND sg.tenant_id = public.my_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.student_groups sg
      WHERE sg.id = student_group_members.group_id
        AND sg.tenant_id = public.my_tenant_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_groups, public.student_group_members TO authenticated, service_role;

-- ===========================================================================
-- 4. STUDENT RESIDENCES
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.student_residences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'Dormitory' CHECK (type IN ('Dormitory', 'Day Scholar', 'Hostel', 'Other')),
  capacity integer,
  supervisor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.student_residence_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  residence_id uuid NOT NULL REFERENCES public.student_residences (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

ALTER TABLE public.student_residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_residence_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_residences_tenant ON public.student_residences;
CREATE POLICY student_residences_tenant ON public.student_residences
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS student_residence_assignments_tenant ON public.student_residence_assignments;
CREATE POLICY student_residence_assignments_tenant ON public.student_residence_assignments
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_residences, public.student_residence_assignments TO authenticated, service_role;

-- ===========================================================================
-- 5. RPC: get_student_directory (extended with all new fields)
-- ===========================================================================
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
  in_school_status text,
  boarding_status text,
  house text,
  primary_phone text,
  guardian_name text,
  kcpe_score numeric,
  kcpe_grade text,
  upi text,
  photo_url text,
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
    s.in_school_status,
    s.boarding_status,
    s.house,
    s.primary_phone,
    s.guardian_name,
    s.kcpe_score,
    s.kcpe_grade,
    s.upi,
    s.photo_url,
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
      OR s.upi ILIKE '%' || v_search || '%'
      OR s.national_id ILIKE '%' || v_search || '%'
    )
    AND (p_class_id IS NULL OR COALESCE(le.class_id, s.class_id) = p_class_id)
    AND (p_stream_id IS NULL OR COALESCE(le.stream_id, s.stream_id) = p_stream_id)
  ORDER BY s.full_name, s.admission_no
  LIMIT v_limit;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_student_profile (extended with all new fields)
-- ---------------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_profile' LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
  v_notes JSONB;
  v_groups JSONB;
  v_residence TEXT;
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
    s.id, s.admission_no, s.full_name, s.gender, s.class_id, s.stream_id,
    s.upi, s.index_number, s.national_id, s.sha, s.kcpe_score, s.kcpe_grade,
    s.kcpe_year, s.kcpe_index, s.kcpe_entry_position, s.date_of_birth,
    s.nationality, s.place_of_birth, s.guardian_name, s.guardian_relation,
    s.primary_phone, s.primary_phone_2, s.secondary_phone, s.secondary_phone_2,
    s.previous_school, s.admission_date, s.boarding_status, s.house,
    s.nhif, s.zeraki_pay_code, s.in_school_status, s.marital_status,
    s.regime, s.internal_status, s.assigned_status, s.general_comments,
    s.birth_cert_number, s.photo_url, s.current_pathway, s.current_track,
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

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'note_id', sn.id,
      'note_type', sn.note_type,
      'title', sn.title,
      'content', sn.content,
      'created_by_name', p.full_name,
      'created_at', sn.created_at
    ) ORDER BY sn.created_at DESC
  ), '[]'::jsonb)
  INTO v_notes
  FROM public.student_notes sn
  LEFT JOIN public.profiles p ON p.id = sn.created_by
  WHERE sn.student_id = p_student_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'group_id', sg.id,
      'group_name', sg.name
    ) ORDER BY sg.name
  ), '[]'::jsonb)
  INTO v_groups
  FROM public.student_group_members sgm
  JOIN public.student_groups sg ON sg.id = sgm.group_id
  WHERE sgm.student_id = p_student_id;

  SELECT sr.name INTO v_residence
  FROM public.student_residence_assignments sra
  JOIN public.student_residences sr ON sr.id = sra.residence_id
  WHERE sra.student_id = p_student_id;

  RETURN jsonb_build_object(
    'student_id', v_student.id,
    'admission_no', v_student.admission_no,
    'full_name', v_student.full_name,
    'gender', v_student.gender,
    'class_id', v_student.class_id,
    'stream_id', v_student.stream_id,
    'upi', v_student.upi,
    'index_number', v_student.index_number,
    'national_id', v_student.national_id,
    'sha', v_student.sha,
    'kcpe_score', v_student.kcpe_score,
    'kcpe_grade', v_student.kcpe_grade,
    'kcpe_year', v_student.kcpe_year,
    'kcpe_index', v_student.kcpe_index,
    'kcpe_entry_position', v_student.kcpe_entry_position,
    'date_of_birth', v_student.date_of_birth,
    'nationality', v_student.nationality,
    'place_of_birth', v_student.place_of_birth,
    'guardian_name', v_student.guardian_name,
    'guardian_relation', v_student.guardian_relation,
    'primary_phone', v_student.primary_phone,
    'primary_phone_2', v_student.primary_phone_2,
    'secondary_phone', v_student.secondary_phone,
    'secondary_phone_2', v_student.secondary_phone_2,
    'previous_school', v_student.previous_school,
    'admission_date', v_student.admission_date,
    'boarding_status', v_student.boarding_status,
    'house', v_student.house,
    'nhif', v_student.nhif,
    'zeraki_pay_code', v_student.zeraki_pay_code,
    'in_school_status', v_student.in_school_status,
    'marital_status', v_student.marital_status,
    'regime', v_student.regime,
    'internal_status', v_student.internal_status,
    'assigned_status', v_student.assigned_status,
    'general_comments', v_student.general_comments,
    'birth_cert_number', v_student.birth_cert_number,
    'photo_url', v_student.photo_url,
    'current_pathway', v_student.current_pathway,
    'current_track', v_student.current_track,
    'pathway', v_pathway,
    'residence', v_residence,
    'created_at', v_student.created_at,
    'enrollments', v_enrollments,
    'published_exams_with_marks', v_reports,
    'notes', v_notes,
    'groups', v_groups
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. create_student (extended with all new fields)
-- ---------------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'create_student' LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.create_student(
  p_admission_no text,
  p_full_name text,
  p_gender text DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL,
  p_academic_year integer DEFAULT NULL,
  p_upi text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_kcpe_score numeric DEFAULT NULL,
  p_kcpe_grade text DEFAULT NULL,
  p_kcpe_year integer DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_nationality text DEFAULT NULL,
  p_guardian_name text DEFAULT NULL,
  p_guardian_relation text DEFAULT NULL,
  p_primary_phone text DEFAULT NULL,
  p_boarding_status text DEFAULT NULL,
  p_house text DEFAULT NULL,
  p_previous_school text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
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

  INSERT INTO public.students (
    tenant_id, admission_no, full_name, gender, class_id, stream_id,
    upi, national_id, kcpe_score, kcpe_grade, kcpe_year, date_of_birth,
    nationality, guardian_name, guardian_relation, primary_phone,
    boarding_status, house, previous_school, photo_url
  )
  VALUES (
    v_caller_tenant, v_clean_admno, v_clean_name,
    nullif(btrim(coalesce(p_gender, '')), ''),
    p_class_id, p_stream_id,
    nullif(btrim(coalesce(p_upi, '')), ''),
    nullif(btrim(coalesce(p_national_id, '')), ''),
    p_kcpe_score,
    nullif(btrim(coalesce(p_kcpe_grade, '')), ''),
    p_kcpe_year,
    p_date_of_birth,
    nullif(btrim(coalesce(p_nationality, '')), ''),
    nullif(btrim(coalesce(p_guardian_name, '')), ''),
    nullif(btrim(coalesce(p_guardian_relation, '')), ''),
    nullif(btrim(coalesce(p_primary_phone, '')), ''),
    p_boarding_status,
    nullif(btrim(coalesce(p_house, '')), ''),
    nullif(btrim(coalesce(p_previous_school, '')), ''),
    nullif(btrim(coalesce(p_photo_url, '')), '')
  )
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
-- 8. update_student_profile (extended with all new fields)
-- ---------------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.update_student_profile(
  p_student_id uuid,
  p_admission_no text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL,
  p_upi text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_kcpe_score numeric DEFAULT NULL,
  p_kcpe_grade text DEFAULT NULL,
  p_kcpe_year integer DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_nationality text DEFAULT NULL,
  p_guardian_name text DEFAULT NULL,
  p_guardian_relation text DEFAULT NULL,
  p_primary_phone text DEFAULT NULL,
  p_boarding_status text DEFAULT NULL,
  p_house text DEFAULT NULL,
  p_previous_school text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_in_school_status text DEFAULT NULL,
  p_current_pathway text DEFAULT NULL,
  p_current_track text DEFAULT NULL
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
    admission_no       = COALESCE(nullif(btrim(coalesce(p_admission_no, '')), ''), admission_no),
    full_name          = COALESCE(nullif(btrim(coalesce(p_full_name, '')), ''), full_name),
    gender             = COALESCE(nullif(btrim(coalesce(p_gender, '')), ''), gender),
    class_id           = COALESCE(p_class_id, class_id),
    stream_id          = COALESCE(p_stream_id, stream_id),
    upi                = COALESCE(nullif(btrim(coalesce(p_upi, '')), ''), upi),
    national_id        = COALESCE(nullif(btrim(coalesce(p_national_id, '')), ''), national_id),
    kcpe_score         = COALESCE(p_kcpe_score, kcpe_score),
    kcpe_grade         = COALESCE(nullif(btrim(coalesce(p_kcpe_grade, '')), ''), kcpe_grade),
    kcpe_year          = COALESCE(p_kcpe_year, kcpe_year),
    date_of_birth      = COALESCE(p_date_of_birth, date_of_birth),
    nationality        = COALESCE(nullif(btrim(coalesce(p_nationality, '')), ''), nationality),
    guardian_name      = COALESCE(nullif(btrim(coalesce(p_guardian_name, '')), ''), guardian_name),
    guardian_relation  = COALESCE(nullif(btrim(coalesce(p_guardian_relation, '')), ''), guardian_relation),
    primary_phone      = COALESCE(nullif(btrim(coalesce(p_primary_phone, '')), ''), primary_phone),
    boarding_status    = COALESCE(p_boarding_status, boarding_status),
    house              = COALESCE(nullif(btrim(coalesce(p_house, '')), ''), house),
    previous_school    = COALESCE(nullif(btrim(coalesce(p_previous_school, '')), ''), previous_school),
    photo_url          = COALESCE(nullif(btrim(coalesce(p_photo_url, '')), ''), photo_url),
    in_school_status   = COALESCE(nullif(btrim(coalesce(p_in_school_status, '')), ''), in_school_status),
    current_pathway    = COALESCE(nullif(btrim(coalesce(p_current_pathway, '')), ''), current_pathway),
    current_track      = COALESCE(nullif(btrim(coalesce(p_current_track, '')), ''), current_track)
  WHERE id = p_student_id
    AND tenant_id = v_student_tenant;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. add_student_note / delete_student_note
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_student_note(
  p_student_id uuid,
  p_note_type text,
  p_title text,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_student_tenant UUID;
  v_note_id UUID;
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

  IF p_note_type NOT IN ('general', 'academic', 'behavioural', 'medical', 'disciplinary') THEN
    RAISE EXCEPTION 'Invalid note type';
  END IF;

  IF btrim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Note title is required';
  END IF;

  INSERT INTO public.student_notes (tenant_id, student_id, note_type, title, content, created_by)
  VALUES (
    v_student_tenant, p_student_id, p_note_type, btrim(p_title), coalesce(p_content, ''),
    CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END
  )
  RETURNING id INTO v_note_id;

  RETURN v_note_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_student_note(p_note_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_note_tenant UUID;
BEGIN
  SELECT sn.tenant_id INTO v_note_tenant
  FROM public.student_notes sn
  WHERE sn.id = p_note_id;

  IF v_note_tenant IS NULL THEN
    RAISE EXCEPTION 'Note not found';
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

    IF v_note_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to note from different tenant';
    END IF;
  END IF;

  DELETE FROM public.student_notes WHERE id = p_note_id;
  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Student groups RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_groups()
RETURNS TABLE(
  group_id uuid,
  name text,
  description text,
  member_count integer
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
    sg.description,
    count(sgm.student_id)::integer AS member_count
  FROM public.student_groups sg
  LEFT JOIN public.student_group_members sgm ON sgm.group_id = sg.id
  WHERE v_role = 'service_role' OR sg.tenant_id = v_caller_tenant
  GROUP BY sg.id, sg.name, sg.description
  ORDER BY sg.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_student_group(
  p_name text,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'edit-student-groups') THEN
      RAISE EXCEPTION 'Access denied: permission required';
    END IF;
  END IF;

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  INSERT INTO public.student_groups (tenant_id, name, description)
  VALUES (v_caller_tenant, btrim(p_name), coalesce(btrim(p_description), ''))
  ON CONFLICT (tenant_id, name) DO UPDATE SET
    description = EXCLUDED.description
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_student_to_group(
  p_student_id uuid,
  p_group_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_student_tenant UUID;
  v_group_tenant UUID;
BEGIN
  SELECT s.tenant_id INTO v_student_tenant
  FROM public.students s
  WHERE s.id = p_student_id;

  SELECT sg.tenant_id INTO v_group_tenant
  FROM public.student_groups sg
  WHERE sg.id = p_group_id;

  IF v_student_tenant IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF v_group_tenant IS NULL THEN
    RAISE EXCEPTION 'Group not found';
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

    IF v_student_tenant <> v_caller_tenant OR v_group_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied: cross-tenant assignment';
    END IF;
  END IF;

  INSERT INTO public.student_group_members (group_id, student_id)
  VALUES (p_group_id, p_student_id)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 11. Student residences RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_residences()
RETURNS TABLE(
  residence_id uuid,
  name text,
  type text,
  capacity integer,
  supervisor_name text,
  student_count integer
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
    sr.id AS residence_id,
    sr.name,
    sr.type,
    sr.capacity,
    p.full_name AS supervisor_name,
    count(sra.id)::integer AS student_count
  FROM public.student_residences sr
  LEFT JOIN public.profiles p ON p.id = sr.supervisor_id
  LEFT JOIN public.student_residence_assignments sra ON sra.residence_id = sr.id
  WHERE v_role = 'service_role' OR sr.tenant_id = v_caller_tenant
  GROUP BY sr.id, sr.name, sr.type, sr.capacity, p.full_name
  ORDER BY sr.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_student_residence(
  p_name text,
  p_type text DEFAULT 'Dormitory',
  p_capacity integer DEFAULT NULL,
  p_supervisor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'add-edit-student-residences') THEN
      RAISE EXCEPTION 'Access denied: permission required';
    END IF;
  END IF;

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Residence name is required';
  END IF;

  IF p_type NOT IN ('Dormitory', 'Day Scholar', 'Hostel', 'Other') THEN
    RAISE EXCEPTION 'Invalid residence type';
  END IF;

  INSERT INTO public.student_residences (tenant_id, name, type, capacity, supervisor_id)
  VALUES (v_caller_tenant, btrim(p_name), p_type, p_capacity, p_supervisor_id)
  ON CONFLICT (tenant_id, name) DO UPDATE SET
    type = EXCLUDED.type,
    capacity = EXCLUDED.capacity,
    supervisor_id = EXCLUDED.supervisor_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_student_residence(
  p_student_id uuid,
  p_residence_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_student_tenant UUID;
  v_residence_tenant UUID;
BEGIN
  SELECT s.tenant_id INTO v_student_tenant
  FROM public.students s
  WHERE s.id = p_student_id;

  SELECT sr.tenant_id INTO v_residence_tenant
  FROM public.student_residences sr
  WHERE sr.id = p_residence_id;

  IF v_student_tenant IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF v_residence_tenant IS NULL THEN
    RAISE EXCEPTION 'Residence not found';
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

    IF v_student_tenant <> v_caller_tenant OR v_residence_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied: cross-tenant assignment';
    END IF;
  END IF;

  INSERT INTO public.student_residence_assignments (tenant_id, student_id, residence_id)
  VALUES (v_caller_tenant, p_student_id, p_residence_id)
  ON CONFLICT (student_id) DO UPDATE SET
    residence_id = EXCLUDED.residence_id,
    assigned_at = now();

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 12. Move students (promote, demote, graduate, expel, transfer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.move_student(
  p_student_id uuid,
  p_action text,
  p_destination_class_id uuid DEFAULT NULL,
  p_destination_stream_id uuid DEFAULT NULL,
  p_academic_year integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_student_tenant UUID;
  v_year INT;
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

    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'move-students') THEN
      RAISE EXCEPTION 'Access denied: move-students permission required';
    END IF;
  END IF;

  v_year := COALESCE(p_academic_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);

  IF p_action = 'graduate' THEN
    UPDATE public.students
    SET in_school_status = 'Graduated'
    WHERE id = p_student_id AND tenant_id = v_student_tenant;

  ELSIF p_action = 'expel' THEN
    UPDATE public.students
    SET in_school_status = 'Expelled'
    WHERE id = p_student_id AND tenant_id = v_student_tenant;

  ELSIF p_action = 'demote' THEN
    UPDATE public.students
    SET in_school_status = 'Demoted'
    WHERE id = p_student_id AND tenant_id = v_student_tenant;

  ELSIF p_action = 'transfer' THEN
    IF p_destination_class_id IS NOT NULL THEN
      UPDATE public.students
      SET class_id = p_destination_class_id,
          stream_id = p_destination_stream_id,
          in_school_status = 'Transferred'
      WHERE id = p_student_id AND tenant_id = v_student_tenant;

      INSERT INTO public.student_enrollments (tenant_id, student_id, academic_year, class_id, stream_id)
      VALUES (v_student_tenant, p_student_id, v_year, p_destination_class_id, p_destination_stream_id)
      ON CONFLICT DO NOTHING;
    END IF;

  ELSIF p_action = 'promote' THEN
    IF p_destination_class_id IS NOT NULL THEN
      UPDATE public.students
      SET class_id = p_destination_class_id,
          stream_id = p_destination_stream_id
      WHERE id = p_student_id AND tenant_id = v_student_tenant;

      INSERT INTO public.student_enrollments (tenant_id, student_id, academic_year, class_id, stream_id)
      VALUES (v_student_tenant, p_student_id, v_year, p_destination_class_id, p_destination_stream_id)
      ON CONFLICT DO NOTHING;
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid move action: %', p_action;
  END IF;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 13. Explicit REVOKE / GRANT (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_student_directory(text, uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_student(text, text, text, uuid, uuid, integer, text, text, numeric, text, integer, date, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_student_profile(uuid, text, text, text, uuid, uuid, text, text, numeric, text, integer, date, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_student_note(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_student_note(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_groups() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_student_group(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_student_to_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_residences() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_student_residence(text, text, integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_student_residence(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.move_student(uuid, text, uuid, uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_student_directory(text, uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_student(text, text, text, uuid, uuid, integer, text, text, numeric, text, integer, date, text, text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_student_profile(uuid, text, text, text, uuid, uuid, text, text, numeric, text, integer, date, text, text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_student_note(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_student_note(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_groups() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_student_group(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_student_to_group(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_residences() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_student_residence(text, text, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_student_residence(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.move_student(uuid, text, uuid, uuid, integer) TO authenticated, service_role;
