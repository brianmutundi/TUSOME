-- TUSOME analytics: Full Zeraki-parity Report Features
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Implements the previously blocked report features:
--   1. Term Dates (opening/closing dates on report cards)
--   2. Subject Paper Breakdown (per-paper marks within a subject)
--   3. Pathways & Tracks (student pathway/track assignment)
--   4. Attendance (per-student, per-exam attendance records)
--   5. Behaviour (infraction/merit records)
--   6. CBC / Assessment Records (competencies, strands, performance levels)
--   7. Fee Statements (current term balance, next term fees)
--   8. Report Template Editor (printout settings: watermark, signatures, layout)

-- ===========================================================================
-- 1. TERM DATES
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.term_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  term text NOT NULL CHECK (term IN ('Term 1', 'Term 2', 'Term 3')),
  opening_date date NOT NULL,
  closing_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, academic_year, term)
);

ALTER TABLE public.term_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS term_dates_tenant ON public.term_dates;
CREATE POLICY term_dates_tenant ON public.term_dates
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.term_dates TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_term_dates(
  p_academic_year integer DEFAULT NULL,
  p_term text DEFAULT NULL
)
RETURNS TABLE(
  term_date_id uuid,
  academic_year integer,
  term text,
  opening_date date,
  closing_date date
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
    td.id AS term_date_id,
    td.academic_year,
    td.term,
    td.opening_date,
    td.closing_date
  FROM public.term_dates td
  WHERE (v_role = 'service_role' OR td.tenant_id = v_caller_tenant)
    AND (p_academic_year IS NULL OR td.academic_year = p_academic_year)
    AND (p_term IS NULL OR td.term = p_term)
  ORDER BY td.academic_year DESC, td.term;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_term_date(
  p_academic_year integer,
  p_term text,
  p_opening_date date,
  p_closing_date date
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'edit-term-dates') THEN
      RAISE EXCEPTION 'Access denied: permission required';
    END IF;
  END IF;

  IF p_academic_year < 2000 OR p_academic_year > 2100 THEN
    RAISE EXCEPTION 'Invalid academic year';
  END IF;

  IF p_term NOT IN ('Term 1', 'Term 2', 'Term 3') THEN
    RAISE EXCEPTION 'Invalid term';
  END IF;

  IF p_opening_date IS NULL OR p_closing_date IS NULL OR p_opening_date > p_closing_date THEN
    RAISE EXCEPTION 'Opening date must be on or before closing date';
  END IF;

  INSERT INTO public.term_dates (tenant_id, academic_year, term, opening_date, closing_date)
  VALUES (v_caller_tenant, p_academic_year, p_term, p_opening_date, p_closing_date)
  ON CONFLICT (tenant_id, academic_year, term) DO UPDATE SET
    opening_date = EXCLUDED.opening_date,
    closing_date = EXCLUDED.closing_date
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- ===========================================================================
-- 2. SUBJECT PAPER BREAKDOWN
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.subject_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  max_marks numeric NOT NULL DEFAULT 100,
  weight numeric NOT NULL DEFAULT 1.0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, subject_id, name)
);

ALTER TABLE public.marks
  ADD COLUMN IF NOT EXISTS paper_id uuid REFERENCES public.subject_papers (id) ON DELETE SET NULL;

ALTER TABLE public.subject_papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subject_papers_tenant ON public.subject_papers;
CREATE POLICY subject_papers_tenant ON public.subject_papers
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_papers TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_subject_papers(p_subject_id uuid)
RETURNS TABLE(
  paper_id uuid,
  name text,
  code text,
  max_marks numeric,
  weight numeric,
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
    sp.id AS paper_id,
    sp.name,
    sp.code,
    sp.max_marks,
    sp.weight,
    sp.sort_order
  FROM public.subject_papers sp
  WHERE sp.subject_id = p_subject_id
    AND (v_role = 'service_role' OR sp.tenant_id = v_caller_tenant)
  ORDER BY sp.sort_order, sp.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_subject_paper(
  p_subject_id uuid,
  p_name text,
  p_code text DEFAULT NULL,
  p_max_marks numeric DEFAULT 100,
  p_weight numeric DEFAULT 1.0,
  p_sort_order integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_subj_tenant UUID;
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

  SELECT s.tenant_id INTO v_subj_tenant
  FROM public.subjects s
  WHERE s.id = p_subject_id;

  IF v_subj_tenant IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
  END IF;

  IF v_subj_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to subject from different tenant';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-exams') THEN
      RAISE EXCEPTION 'Access denied: manage-exams permission required';
    END IF;
  END IF;

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Paper name is required';
  END IF;

  IF p_max_marks IS NULL OR p_max_marks <= 0 THEN
    RAISE EXCEPTION 'Max marks must be greater than 0';
  END IF;

  INSERT INTO public.subject_papers (
    tenant_id, subject_id, name, code, max_marks, weight, sort_order
  )
  VALUES (
    v_caller_tenant, p_subject_id, btrim(p_name),
    nullif(btrim(coalesce(p_code, '')), ''),
    p_max_marks, COALESCE(p_weight, 1.0), COALESCE(p_sort_order, 0)
  )
  ON CONFLICT (tenant_id, subject_id, name) DO UPDATE SET
    code       = EXCLUDED.code,
    max_marks  = EXCLUDED.max_marks,
    weight     = EXCLUDED.weight,
    sort_order = EXCLUDED.sort_order
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- ===========================================================================
-- 3. PATHWAYS & TRACKS
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  track text,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.student_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  pathway_id uuid NOT NULL REFERENCES public.pathways (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

ALTER TABLE public.pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_pathways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pathways_tenant ON public.pathways;
CREATE POLICY pathways_tenant ON public.pathways
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

DROP POLICY IF EXISTS student_pathways_tenant ON public.student_pathways;
CREATE POLICY student_pathways_tenant ON public.student_pathways
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pathways, public.student_pathways TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_pathways()
RETURNS TABLE(
  pathway_id uuid,
  name text,
  track text,
  description text,
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
    p.id AS pathway_id,
    p.name,
    p.track,
    p.description,
    count(sp.id)::integer AS student_count
  FROM public.pathways p
  LEFT JOIN public.student_pathways sp ON sp.pathway_id = p.id
  WHERE v_role = 'service_role' OR p.tenant_id = v_caller_tenant
  GROUP BY p.id, p.name, p.track, p.description
  ORDER BY p.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_pathway(
  p_name text,
  p_track text DEFAULT NULL,
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'add-target-grades') THEN
      RAISE EXCEPTION 'Access denied: permission required';
    END IF;
  END IF;

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Pathway name is required';
  END IF;

  INSERT INTO public.pathways (tenant_id, name, track, description)
  VALUES (v_caller_tenant, btrim(p_name), nullif(btrim(coalesce(p_track, '')), ''), coalesce(btrim(p_description), ''))
  ON CONFLICT (tenant_id, name) DO UPDATE SET
    track = EXCLUDED.track,
    description = EXCLUDED.description
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_student_pathway(
  p_student_id uuid,
  p_pathway_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_student_tenant UUID;
  v_pathway_tenant UUID;
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

  SELECT s.tenant_id INTO v_student_tenant
  FROM public.students s
  WHERE s.id = p_student_id;

  IF v_student_tenant IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  SELECT p.tenant_id INTO v_pathway_tenant
  FROM public.pathways p
  WHERE p.id = p_pathway_id;

  IF v_pathway_tenant IS NULL THEN
    RAISE EXCEPTION 'Pathway not found';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF v_student_tenant <> v_caller_tenant OR v_pathway_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied: cross-tenant assignment';
    END IF;
  END IF;

  INSERT INTO public.student_pathways (tenant_id, student_id, pathway_id)
  VALUES (v_caller_tenant, p_student_id, p_pathway_id)
  ON CONFLICT (student_id) DO UPDATE SET
    pathway_id = EXCLUDED.pathway_id,
    assigned_at = now();

  RETURN true;
END;
$function$;

-- ===========================================================================
-- 4. ATTENDANCE
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  exam_id uuid REFERENCES public.exams (id) ON DELETE CASCADE,
  term text,
  academic_year integer,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  remarks text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_tenant ON public.attendance_records;
CREATE POLICY attendance_tenant ON public.attendance_records
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_attendance_for_exam(p_exam_id uuid)
RETURNS TABLE(
  student_id uuid,
  admission_no text,
  student_name text,
  class_name text,
  stream_name text,
  status text,
  remarks text,
  recorded_at timestamptz
)
LANGUAGE plpgsql
STABLE
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
  END IF;

  RETURN QUERY
  SELECT
    s.id AS student_id,
    s.admission_no,
    s.full_name AS student_name,
    c.name AS class_name,
    st.name AS stream_name,
    COALESCE(ar.status, 'present') AS status,
    ar.remarks,
    ar.recorded_at
  FROM public.students s
  LEFT JOIN public.attendance_records ar
    ON ar.student_id = s.id AND ar.exam_id = p_exam_id
  LEFT JOIN public.classes c ON c.id = s.class_id
  LEFT JOIN public.streams st ON st.id = s.stream_id
  WHERE s.tenant_id = v_exam_tenant
  ORDER BY s.admission_no, s.full_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_attendance_for_exam(
  p_exam_id uuid,
  p_entries jsonb
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
  v_item JSONB;
  v_student_id UUID;
  v_status TEXT;
  v_remarks TEXT;
  v_saved INT := 0;
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
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'Entries must be a JSON array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_student_id := (v_item ->> 'student_id')::uuid;
    v_status := coalesce(v_item ->> 'status', 'present');
    v_remarks := nullif(btrim(coalesce(v_item ->> 'remarks', '')), '');

    IF v_status NOT IN ('present', 'absent', 'late', 'excused') THEN
      RAISE EXCEPTION 'Invalid attendance status: %', v_status;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = v_student_id AND s.tenant_id = v_exam_tenant
    ) THEN
      RAISE EXCEPTION 'Student not found in this school';
    END IF;

    INSERT INTO public.attendance_records (
      tenant_id, student_id, exam_id, status, remarks, recorded_by
    )
    VALUES (
      v_exam_tenant, v_student_id, p_exam_id, v_status, v_remarks,
      CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END
    )
    ON CONFLICT DO NOTHING;

    v_saved := v_saved + 1;
  END LOOP;

  RETURN v_saved;
END;
$function$;

-- ===========================================================================
-- 5. BEHAVIOUR (infraction/merit records)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.behaviour_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('merit', 'infraction', 'commendation', 'warning')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  points integer NOT NULL DEFAULT 0,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.behaviour_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS behaviour_tenant ON public.behaviour_records;
CREATE POLICY behaviour_tenant ON public.behaviour_records
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.behaviour_records TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_behaviour_for_student(p_student_id uuid)
RETURNS TABLE(
  record_id uuid,
  type text,
  title text,
  description text,
  points integer,
  recorded_by_name text,
  recorded_at timestamptz
)
LANGUAGE plpgsql
STABLE
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
  END IF;

  RETURN QUERY
  SELECT
    br.id AS record_id,
    br.type,
    br.title,
    br.description,
    br.points,
    p.full_name AS recorded_by_name,
    br.recorded_at
  FROM public.behaviour_records br
  LEFT JOIN public.profiles p ON p.id = br.recorded_by
  WHERE br.student_id = p_student_id
  ORDER BY br.recorded_at DESC;
END;
$function$;

-- ===========================================================================
-- 6. CBC / ASSESSMENT RECORDS
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.cbc_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  exam_id uuid REFERENCES public.exams (id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects (id) ON DELETE CASCADE,
  strand text,
  sub_strand text,
  competency text,
  performance_level text CHECK (performance_level IN ('EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2')),
  score numeric,
  teacher_remarks text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cbc_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cbc_assessments_tenant ON public.cbc_assessments;
CREATE POLICY cbc_assessments_tenant ON public.cbc_assessments
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cbc_assessments TO authenticated, service_role;

-- ===========================================================================
-- 7. FEE STATEMENTS
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.fee_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  term text NOT NULL CHECK (term IN ('Term 1', 'Term 2', 'Term 3')),
  academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  current_term_balance numeric NOT NULL DEFAULT 0,
  next_term_fees numeric NOT NULL DEFAULT 0,
  total_balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, term, academic_year)
);

ALTER TABLE public.fee_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_statements_tenant ON public.fee_statements;
CREATE POLICY fee_statements_tenant ON public.fee_statements
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_statements TO authenticated, service_role;

-- ===========================================================================
-- 8. REPORT TEMPLATE CONFIGS (printout settings)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.report_template_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  config_key text NOT NULL,
  config_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, config_key)
);

ALTER TABLE public.report_template_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_template_configs_tenant ON public.report_template_configs;
CREATE POLICY report_template_configs_tenant ON public.report_template_configs
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_template_configs TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_report_template_config()
RETURNS TABLE(
  config_key text,
  config_value text
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
  SELECT rtc.config_key, rtc.config_value
  FROM public.report_template_configs rtc
  WHERE v_role = 'service_role' OR rtc.tenant_id = v_caller_tenant
  ORDER BY rtc.config_key;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_report_template_config(
  p_config_key text,
  p_config_value text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
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

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'edit-printout-settings') THEN
      RAISE EXCEPTION 'Access denied: permission required';
    END IF;
  END IF;

  INSERT INTO public.report_template_configs (tenant_id, config_key, config_value, updated_at)
  VALUES (v_caller_tenant, p_config_key, p_config_value, now())
  ON CONFLICT (tenant_id, config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = now();

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. Explicit REVOKE / GRANT (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_term_dates(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_term_date(integer, text, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_subject_papers(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_subject_paper(uuid, text, text, numeric, numeric, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_pathways() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_pathway(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_student_pathway(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_attendance_for_exam(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_attendance_for_exam(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_behaviour_for_student(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_report_template_config() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_report_template_config(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_term_dates(integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_term_date(integer, text, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_subject_papers(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_subject_paper(uuid, text, text, numeric, numeric, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pathways() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_pathway(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_student_pathway(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_attendance_for_exam(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_attendance_for_exam(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_behaviour_for_student(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_report_template_config() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_report_template_config(text, text) TO authenticated, service_role;
