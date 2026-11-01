-- TUSOME analytics: Zeraki-parity Exam -> Marks -> Publish -> Reports pipeline
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence for how exams flow to reports
-- ----------------------------------------------------
-- 1. Exam routes & permissions (chunk-4XKZKDAN.js, chunk-DOX6SLRN.js, chunk-EG4LPDBH.js):
--      * /main/exams/create-exam  (permission: "create-edit-exam", chunk-HTDCN6NT.js CreateExamComponent)
--      * /main/exams/my-classes   (permission: "view-my-classes", chunk-XUCXCXPF.js, chunk-AMVB26KM.js UploadExamsSubjectComponent)
--      * /main/exams/manage       (permission: "manage-exams", chunk-372RFQAZ.js ManageExamComponent)
--      * /main/exams/manage/publish/status/:streamId/:examId (chunk-RMCHKSBZ.js PublishStatusComponent)
--      * /main/exams/manage/publish/:intakeId/:examId/:examType (chunk-E2VI6NTQ.js PublishExamsComponent)
-- 2. Lifecycle flow in Zeraki:
--      Stage A (Create): Admin creates an exam (name, term, academic_year,
--              assessment_component, participating classes in exam_classes).
--              Exam starts in 'draft' status.
--      Stage B (Mark Entry / Upload): Teachers or admins select an unpublished
--              exam ('draft', 'review', 'reopened') and a subject, key in or
--              upload marks (0..100) for students on the class roster.
--              The database trigger `marks_editable_guard` blocks edits once
--              status = 'published'.
--      Stage C (Readiness & Publish / Unpublish): Admin reviews per-subject
--              mark completion (students with marks vs students without marks)
--              and publishes the exam (`status = 'published'`). Admin can also
--              unpublish/reopen (`status = 'reopened'`) to allow mark corrections.
--      Stage D (Reports & Printouts): Publishing immediately exposes the exam
--              in `get_analytics_filters()` and unlocks Dashboard, Merit List,
--              Mark Sheet, Analysis Report, Student Report Card, Student
--              Analytics, and Transcripts.

-- ---------------------------------------------------------------------------
-- 1. RLS write policies and grants on exams, exam_classes, and marks
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS exams_admin_write ON public.exams;
CREATE POLICY exams_admin_write ON public.exams
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
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director'
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
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director'
        )
    )
  );

DROP POLICY IF EXISTS exam_classes_admin_write ON public.exam_classes;
CREATE POLICY exam_classes_admin_write ON public.exam_classes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_classes.exam_id
        AND e.tenant_id = public.my_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_classes.exam_id
        AND e.tenant_id = public.my_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = public.my_tenant_id()
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director'
        )
    )
  );

DROP POLICY IF EXISTS marks_staff_write ON public.marks;
CREATE POLICY marks_staff_write ON public.marks
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams, public.exam_classes, public.marks
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. get_exam_setup_options: classes, streams, and subjects for the tenant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exam_setup_options()
RETURNS jsonb
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

  RETURN jsonb_build_object(
    'classes', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', c.id, 'name', c.name)
          ORDER BY c.name, c.id
        )
        FROM public.classes c
        WHERE v_role = 'service_role' OR c.tenant_id = v_caller_tenant
      ),
      '[]'::jsonb
    ),
    'streams', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', s.id, 'class_id', s.class_id, 'name', s.name)
          ORDER BY s.name, s.id
        )
        FROM public.streams s
        WHERE v_role = 'service_role' OR s.tenant_id = v_caller_tenant
      ),
      '[]'::jsonb
    ),
    'subjects', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sub.id, 'name', sub.name, 'code', COALESCE(sub.code, ''))
          ORDER BY sub.name, sub.id
        )
        FROM public.subjects sub
        WHERE v_role = 'service_role' OR sub.tenant_id = v_caller_tenant
      ),
      '[]'::jsonb
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. get_exam_pipeline_overview: all exams (draft/review/reopened/published)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exam_pipeline_overview()
RETURNS TABLE(
  exam_id uuid,
  name text,
  term text,
  academic_year integer,
  assessment_component text,
  status text,
  class_ids uuid[],
  class_names text[],
  enrolled_students integer,
  students_with_marks integer,
  subjects_with_marks integer,
  total_marks_entered integer,
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
  WITH latest_enrollment AS (
    SELECT DISTINCT ON (se.student_id)
      se.student_id,
      se.class_id,
      se.stream_id
    FROM public.student_enrollments se
    WHERE v_role = 'service_role' OR se.tenant_id = v_caller_tenant
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  student_roster AS (
    SELECT
      s.id AS student_id,
      s.tenant_id,
      COALESCE(le.class_id, s.class_id) AS effective_class_id
    FROM public.students s
    LEFT JOIN latest_enrollment le ON le.student_id = s.id
    WHERE v_role = 'service_role' OR s.tenant_id = v_caller_tenant
  ),
  exam_class_list AS (
    SELECT
      ec.exam_id AS eid,
      array_agg(c.id ORDER BY c.name, c.id) AS cids,
      array_agg(c.name ORDER BY c.name, c.id) AS cnames
    FROM public.exam_classes ec
    JOIN public.classes c ON c.id = ec.class_id
    GROUP BY ec.exam_id
  ),
  mark_stats AS (
    SELECT
      m.exam_id AS eid,
      count(DISTINCT m.student_id)::integer AS stu_with_marks,
      count(DISTINCT m.subject_id)::integer AS subj_with_marks,
      count(*)::integer AS total_marks
    FROM public.marks m
    WHERE v_role = 'service_role' OR m.tenant_id = v_caller_tenant
    GROUP BY m.exam_id
  )
  SELECT
    e.id AS exam_id,
    e.name,
    e.term,
    e.academic_year,
    e.assessment_component,
    e.status,
    COALESCE(ecl.cids, ARRAY[]::uuid[]) AS class_ids,
    COALESCE(ecl.cnames, ARRAY[]::text[]) AS class_names,
    (
      SELECT count(*)::integer
      FROM student_roster sr
      WHERE sr.tenant_id = e.tenant_id
        AND (
          ecl.cids IS NULL
          OR array_length(ecl.cids, 1) IS NULL
          OR sr.effective_class_id = ANY(ecl.cids)
        )
    ) AS enrolled_students,
    COALESCE(ms.stu_with_marks, 0)::integer AS students_with_marks,
    COALESCE(ms.subj_with_marks, 0)::integer AS subjects_with_marks,
    COALESCE(ms.total_marks, 0)::integer AS total_marks_entered,
    e.created_at
  FROM public.exams e
  LEFT JOIN exam_class_list ecl ON ecl.eid = e.id
  LEFT JOIN mark_stats ms ON ms.eid = e.id
  WHERE v_role = 'service_role' OR e.tenant_id = v_caller_tenant
  ORDER BY COALESCE(e.academic_year, 0) DESC, e.created_at DESC, e.id DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. create_exam: create a draft exam and bind participating classes
-- ---------------------------------------------------------------------------
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
  v_is_admin BOOLEAN;
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
    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
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

-- ---------------------------------------------------------------------------
-- 5. get_exam_mark_entry_roster: student roster + existing subject marks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exam_mark_entry_roster(
  p_exam_id uuid,
  p_subject_id uuid,
  p_class_id uuid DEFAULT NULL::uuid,
  p_stream_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  student_id uuid,
  admission_no text,
  student_name text,
  class_id uuid,
  class_name text,
  stream_id uuid,
  stream_name text,
  score numeric,
  grade_code text,
  points integer
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_subj_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
  v_has_grading BOOLEAN;
BEGIN
  SELECT e.tenant_id INTO v_exam_tenant
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  SELECT sub.tenant_id INTO v_subj_tenant
  FROM public.subjects sub
  WHERE sub.id = p_subject_id;

  IF v_subj_tenant IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
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

    IF v_exam_tenant <> v_caller_tenant OR v_subj_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to exam or subject from different tenant';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.grading_configurations gc
    WHERE gc.tenant_id = v_exam_tenant AND gc.active = true
  ) INTO v_has_grading;

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
  exam_cids AS (
    SELECT ec.class_id
    FROM public.exam_classes ec
    WHERE ec.exam_id = p_exam_id
  ),
  roster AS (
    SELECT
      s.id AS student_id,
      s.admission_no,
      s.full_name AS student_name,
      COALESCE(le.class_id, s.class_id) AS eff_class_id,
      COALESCE(le.stream_id, s.stream_id) AS eff_stream_id
    FROM public.students s
    LEFT JOIN latest_enrollment le ON le.student_id = s.id
    WHERE s.tenant_id = v_exam_tenant
      AND (
        NOT EXISTS (SELECT 1 FROM exam_cids)
        OR COALESCE(le.class_id, s.class_id) IN (SELECT ec.class_id FROM exam_cids ec)
      )
      AND (p_class_id IS NULL OR COALESCE(le.class_id, s.class_id) = p_class_id)
      AND (p_stream_id IS NULL OR COALESCE(le.stream_id, s.stream_id) = p_stream_id)
  )
  SELECT
    r.student_id,
    r.admission_no,
    r.student_name,
    r.eff_class_id AS class_id,
    c.name AS class_name,
    r.eff_stream_id AS stream_id,
    st.name AS stream_name,
    m.score,
    g.code AS grade_code,
    g.points
  FROM roster r
  LEFT JOIN public.classes c ON c.id = r.eff_class_id
  LEFT JOIN public.streams st ON st.id = r.eff_stream_id
  LEFT JOIN public.marks m
    ON m.exam_id = p_exam_id
   AND m.subject_id = p_subject_id
   AND m.student_id = r.student_id
  LEFT JOIN LATERAL public.get_grade_for_score(v_exam_tenant, m.score, 'default', NULL) g
    ON m.score IS NOT NULL AND v_has_grading
  ORDER BY r.admission_no, r.student_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. save_exam_subject_marks: batch upsert / clear marks for a subject
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_exam_subject_marks(
  p_exam_id uuid,
  p_subject_id uuid,
  p_entries jsonb
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_exam_status TEXT;
  v_subj_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
  v_can_enter BOOLEAN;
  v_item JSONB;
  v_student_id UUID;
  v_score NUMERIC;
  v_saved INT := 0;
BEGIN
  SELECT e.tenant_id, e.status INTO v_exam_tenant, v_exam_status
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  SELECT sub.tenant_id INTO v_subj_tenant
  FROM public.subjects sub
  WHERE sub.id = p_subject_id;

  IF v_subj_tenant IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
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

    IF v_exam_tenant <> v_caller_tenant OR v_subj_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to exam or subject from different tenant';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director', 'teacher'
        )
    ) INTO v_can_enter;

    IF NOT coalesce(v_can_enter, false) THEN
      RAISE EXCEPTION 'Access denied: teacher or administrator role required to enter marks';
    END IF;
  END IF;

  IF v_exam_status = 'published' THEN
    RAISE EXCEPTION 'Marks cannot be modified for a published exam';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'Entries must be a JSON array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_student_id := (v_item ->> 'student_id')::uuid;

    IF NOT EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = v_student_id AND s.tenant_id = v_exam_tenant
    ) THEN
      RAISE EXCEPTION 'Student not found in this school';
    END IF;

    IF v_item -> 'score' IS NULL
       OR jsonb_typeof(v_item -> 'score') = 'null'
       OR btrim(coalesce(v_item ->> 'score', '')) = '' THEN
      DELETE FROM public.marks
      WHERE exam_id = p_exam_id
        AND subject_id = p_subject_id
        AND student_id = v_student_id;
    ELSE
      v_score := (v_item ->> 'score')::numeric;
      IF v_score < 0 OR v_score > 100 THEN
        RAISE EXCEPTION 'Score must be between 0 and 100';
      END IF;

      INSERT INTO public.marks (tenant_id, exam_id, student_id, subject_id, score)
      VALUES (v_exam_tenant, p_exam_id, v_student_id, p_subject_id, ROUND(v_score, 2))
      ON CONFLICT (exam_id, student_id, subject_id) DO UPDATE SET
        score = EXCLUDED.score;

      v_saved := v_saved + 1;
    END IF;
  END LOOP;

  RETURN v_saved;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. get_exam_publish_readiness: per-subject mark coverage before publishing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exam_publish_readiness(p_exam_id uuid)
RETURNS TABLE(
  subject_id uuid,
  subject_name text,
  subject_code text,
  enrolled_students integer,
  recorded_marks integer,
  missing_marks integer,
  mean_score numeric
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_exam_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
  v_cohort_count INT;
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

  WITH latest_enrollment AS (
    SELECT DISTINCT ON (se.student_id)
      se.student_id,
      se.class_id
    FROM public.student_enrollments se
    WHERE se.tenant_id = v_exam_tenant
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  exam_cids AS (
    SELECT ec.class_id FROM public.exam_classes ec WHERE ec.exam_id = p_exam_id
  )
  SELECT count(*)::integer INTO v_cohort_count
  FROM public.students s
  LEFT JOIN latest_enrollment le ON le.student_id = s.id
  WHERE s.tenant_id = v_exam_tenant
    AND (
      NOT EXISTS (SELECT 1 FROM exam_cids)
      OR COALESCE(le.class_id, s.class_id) IN (SELECT ec.class_id FROM exam_cids ec)
    );

  RETURN QUERY
  SELECT
    sub.id AS subject_id,
    sub.name AS subject_name,
    COALESCE(sub.code, '') AS subject_code,
    v_cohort_count AS enrolled_students,
    count(m.id)::integer AS recorded_marks,
    GREATEST(v_cohort_count - count(m.id)::integer, 0)::integer AS missing_marks,
    COALESCE(ROUND(AVG(m.score), 2), 0)::numeric AS mean_score
  FROM public.subjects sub
  LEFT JOIN public.marks m
    ON m.subject_id = sub.id
   AND m.exam_id = p_exam_id
  WHERE sub.tenant_id = v_exam_tenant
  GROUP BY sub.id, sub.name, sub.code
  ORDER BY sub.name, sub.id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. set_exam_lifecycle_status: publish / reopen / review / draft transition
-- ---------------------------------------------------------------------------
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
  v_is_admin BOOLEAN;
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

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'deputy principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
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
-- 9. Explicit REVOKE / GRANT (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_exam_setup_options() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_setup_options() FROM anon;
REVOKE ALL ON FUNCTION public.get_exam_pipeline_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_pipeline_overview() FROM anon;
REVOKE ALL ON FUNCTION public.create_exam(text, text, integer, text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_exam(text, text, integer, text, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.get_exam_mark_entry_roster(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_mark_entry_roster(uuid, uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.save_exam_subject_marks(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_exam_subject_marks(uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.get_exam_publish_readiness(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_publish_readiness(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.set_exam_lifecycle_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_exam_lifecycle_status(uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_exam_setup_options() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_exam_pipeline_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_exam(text, text, integer, text, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_exam_mark_entry_roster(uuid, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_exam_subject_marks(uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_exam_publish_readiness(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_exam_lifecycle_status(uuid, text) TO authenticated, service_role;
