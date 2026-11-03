-- TUSOME analytics: correctness fixes (config-driven grading + roster joins)
--
-- STATUS: repository-only. NOT applied to any database.
-- The functions in 20261028000000_create_analytics_functions.sql were deployed
-- directly with SQL against project fzwexcgsyzdqyauwccah and are NOT recorded in
-- supabase_migrations.schema_migrations. This file deliberately does not repair
-- that history; applying it is a separate deployment decision.
--
-- Why this migration exists
-- -------------------------
-- 1. get_class_performance joined marks to BOTH exam_classes and
--    student_enrollments without restricting the join, so every mark was
--    duplicated once per exam class (and per enrollment row). Verified against
--    exam 1dd32eb4-c3ea-4bc6-bb97-9008d54589a4 (9 exam_classes): a student with
--    224 raw marks had a reported total of 2016 and a mean of 252%. Means above
--    100 then reach get_grade_for_score, which raises
--    'No grade level matches score ...', breaking the dashboard, the grade
--    distribution and report positions for multi-class exams.
--    Fix: aggregate marks first, resolve the student's current enrollment with
--    DISTINCT ON, and filter on COALESCE(enrollment, student record).
--
-- 2. get_subject_performance counted EE/ME/AE/BE with hardcoded thresholds
--    (>=75, 50-74, 40-49, <40). Those thresholds do not match the tenant
--    grading configurations (e.g. tenant 59556692 lower-primary uses
--    76/50/26/0; tenant e2d776cf upper-primary uses 75/41/20/0). Broad codes
--    now come from get_grade_for_score(), the single source of truth, so the
--    four columns follow the tenant configuration. All live
--    grading_configuration_levels rows use broad in (EE, ME, AE, BE); if a
--    future configuration uses another or a NULL broad code the function raises
--    instead of returning totals that do not add up.
--
-- What is intentionally unchanged
-- ------------------------------
-- * Signatures, grants, STABLE, tenant isolation and published-exam guards.
-- * pass_count / pass_rate still use score >= 40: the schema has no pass-mark
--   column (grading_configuration_levels, report_grading_levels and
--   report_template_configs only describe bands/points), so a config-derived
--   pass mark would be a guess. This needs a product decision before changing.
-- * get_student_report_data is untouched. Its position now benefits from the
--   fixed get_class_performance. Its class/stream header still prefers
--   students.class_id / students.stream_id over the enrollment; current data has
--   zero mismatches, but it should be aligned with enrollment precedence in a
--   later change.
-- * The coarse score > = 40 "passed" count inside get_class_performance is also
--   unchanged for the same missing-pass-mark reason.

-- ---------------------------------------------------------------------------
-- get_class_performance: no join multiplication; enrollment-first roster
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_class_performance(
  p_exam_id uuid,
  p_class_id uuid DEFAULT NULL::uuid,
  p_stream_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  student_id uuid,
  admission_no text,
  student_name text,
  stream_name text,
  total_score numeric,
  mean_score numeric,
  mean_percentage numeric,
  overall_grade text,
  overall_points integer,
  class_position bigint,
  subjects_count bigint,
  passed_count bigint
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tenant_id UUID;
  v_exam_status TEXT;
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  SELECT e.tenant_id, e.status INTO v_tenant_id, v_exam_status
  FROM exams e
  WHERE e.id = p_exam_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  IF v_exam_status != 'published' THEN
    RAISE EXCEPTION 'Exam is not published';
  END IF;

  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role = 'service_role' THEN
    -- Explicitly allowed for service_role
    NULL;
  ELSE
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;

    IF v_caller_tenant <> v_tenant_id THEN
      RAISE EXCEPTION 'Access denied to exam from different tenant';
    END IF;
  END IF;

  RETURN QUERY
  WITH current_enrollment AS (
    -- One row per student: latest academic year wins (created_at breaks ties).
    SELECT DISTINCT ON (se.student_id)
           se.student_id,
           se.class_id,
           se.stream_id
    FROM student_enrollments se
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  student_totals AS (
    -- Aggregate BEFORE joining so exam_classes / enrollment rows cannot
    -- multiply marks.
    SELECT
      m.student_id,
      SUM(m.score) AS total_score,
      COUNT(DISTINCT m.subject_id) AS cnt_subjects,
      COUNT(DISTINCT CASE WHEN m.score >= 40 THEN m.subject_id END) AS cnt_passed
    FROM marks m
    WHERE m.exam_id = p_exam_id
    GROUP BY m.student_id
  ),
  ranked AS (
    SELECT
      f.student_id,
      f.admission_no,
      f.student_name,
      f.stream_name,
      f.total_score,
      f.raw_mean,
      f.cnt_subjects,
      f.cnt_passed,
      -- Rank within the current selection: exam-wide when no class/stream
      -- filter is supplied (what report cards use), otherwise within the
      -- filtered class/stream. This matches the original behaviour.
      DENSE_RANK() OVER (ORDER BY f.raw_mean DESC) AS position
    FROM (
      SELECT
        s.id AS student_id,
        s.admission_no,
        s.full_name AS student_name,
        st.name AS stream_name,
        t.total_score,
        (t.total_score / t.cnt_subjects) AS raw_mean,
        t.cnt_subjects,
        t.cnt_passed
      FROM student_totals t
      JOIN students s ON s.id = t.student_id
      LEFT JOIN current_enrollment se ON se.student_id = s.id
      LEFT JOIN streams st ON st.id = COALESCE(se.stream_id, s.stream_id)
      WHERE s.tenant_id = v_tenant_id
        AND t.cnt_subjects > 0
        AND (p_class_id IS NULL OR COALESCE(se.class_id, s.class_id) = p_class_id)
        AND (p_stream_id IS NULL OR COALESCE(se.stream_id, s.stream_id) = p_stream_id)
    ) f
  )
  SELECT
    r.student_id,
    r.admission_no,
    r.student_name,
    r.stream_name,
    r.total_score,
    ROUND(r.raw_mean, 2) AS mean_score,
    ROUND(r.raw_mean, 2) AS mean_percentage,
    g.code AS overall_grade,
    g.points AS overall_points,
    r.position AS class_position,
    r.cnt_subjects AS subjects_count,
    r.cnt_passed AS passed_count
  FROM ranked r
  LEFT JOIN LATERAL get_grade_for_score(
    v_tenant_id, ROUND(r.raw_mean, 2), 'default', NULL
  ) g ON true
  ORDER BY r.position, r.admission_no;
END;
$function$;

-- ---------------------------------------------------------------------------
-- get_subject_performance: broad categories from the tenant grading config
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_subject_performance(
  p_exam_id uuid,
  p_class_id uuid DEFAULT NULL::uuid,
  p_stream_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  subject_id uuid,
  subject_name text,
  subject_code text,
  total_students bigint,
  mean_score numeric,
  highest_score numeric,
  lowest_score numeric,
  pass_count bigint,
  pass_rate numeric,
  ee_count bigint,
  me_count bigint,
  ae_count bigint,
  be_count bigint
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tenant_id UUID;
  v_exam_status TEXT;
  v_caller_tenant UUID;
  v_role TEXT;
  v_unsupported_broad TEXT;
BEGIN
  SELECT e.tenant_id, e.status INTO v_tenant_id, v_exam_status
  FROM exams e
  WHERE e.id = p_exam_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  IF v_exam_status != 'published' THEN
    RAISE EXCEPTION 'Exam is not published';
  END IF;

  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role = 'service_role' THEN
    -- Explicitly allowed for service_role
    NULL;
  ELSE
    BEGIN
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_tenant := NULL;
    END;

    IF v_caller_tenant IS NULL THEN
      RAISE EXCEPTION 'Missing tenant claim';
    END IF;

    IF v_caller_tenant <> v_tenant_id THEN
      RAISE EXCEPTION 'Access denied to exam from different tenant';
    END IF;
  END IF;

  -- The dashboard renders exactly four broad columns. If the tenant's
  -- configuration resolves a score to a different (or missing) broad code the
  -- four counts cannot be consistent with total_students, so fail loudly with a
  -- message an administrator can act on instead of showing wrong totals.
  WITH current_enrollment AS (
    SELECT DISTINCT ON (se.student_id)
           se.student_id,
           se.class_id,
           se.stream_id
    FROM student_enrollments se
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  filtered AS (
    SELECT m.score
    FROM marks m
    JOIN students s ON s.id = m.student_id
    LEFT JOIN current_enrollment se ON se.student_id = s.id
    WHERE m.exam_id = p_exam_id
      AND s.tenant_id = v_tenant_id
      AND (p_class_id IS NULL OR COALESCE(se.class_id, s.class_id) = p_class_id)
      AND (p_stream_id IS NULL OR COALESCE(se.stream_id, s.stream_id) = p_stream_id)
  ),
  graded_scores AS (
    -- One grade lookup per distinct score (marks are integers in practice).
    SELECT sc.score, g.broad
    FROM (SELECT DISTINCT score FROM filtered) sc
    LEFT JOIN LATERAL get_grade_for_score(
      v_tenant_id, sc.score, 'default', NULL
    ) g ON true
  )
  SELECT COALESCE(gs.broad, 'NULL') INTO v_unsupported_broad
  FROM filtered f
  JOIN graded_scores gs ON gs.score = f.score
  WHERE gs.broad IS NULL OR gs.broad NOT IN ('EE', 'ME', 'AE', 'BE')
  LIMIT 1;

  IF v_unsupported_broad IS NOT NULL THEN
    RAISE EXCEPTION
      'Subject performance supports broad codes EE, ME, AE and BE, but the active grading configuration resolved a score to %',
      COALESCE(v_unsupported_broad, 'NULL');
  END IF;

  RETURN QUERY
  WITH current_enrollment AS (
    SELECT DISTINCT ON (se.student_id)
           se.student_id,
           se.class_id,
           se.stream_id
    FROM student_enrollments se
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  subject_stats AS (
    SELECT
      sub.id AS subject_id,
      sub.name AS subject_name,
      sub.code AS subject_code,
      m.student_id,
      m.score
    FROM marks m
    JOIN subjects sub ON sub.id = m.subject_id
    JOIN students s ON s.id = m.student_id
    LEFT JOIN current_enrollment se ON se.student_id = s.id
    WHERE m.exam_id = p_exam_id
      AND s.tenant_id = v_tenant_id
      AND (p_class_id IS NULL OR COALESCE(se.class_id, s.class_id) = p_class_id)
      AND (p_stream_id IS NULL OR COALESCE(se.stream_id, s.stream_id) = p_stream_id)
  ),
  graded AS (
    SELECT ss.*, g.broad
    FROM subject_stats ss
    LEFT JOIN LATERAL get_grade_for_score(
      v_tenant_id, ss.score, 'default', NULL
    ) g ON true
  )
  SELECT
    g.subject_id,
    g.subject_name,
    g.subject_code,
    COUNT(DISTINCT g.student_id) AS total_students,
    ROUND(AVG(g.score)::numeric, 2) AS mean_score,
    MAX(g.score) AS highest_score,
    MIN(g.score) AS lowest_score,
    -- Pass mark is intentionally NOT config-derived yet (no pass-mark column).
    COUNT(DISTINCT CASE WHEN g.score >= 40 THEN g.student_id END) AS pass_count,
    ROUND((
      COUNT(DISTINCT CASE WHEN g.score >= 40 THEN g.student_id END) * 100.0
      / NULLIF(COUNT(DISTINCT g.student_id), 0)
    )::numeric, 2) AS pass_rate,
    COUNT(DISTINCT CASE WHEN g.broad = 'EE' THEN g.student_id END) AS ee_count,
    COUNT(DISTINCT CASE WHEN g.broad = 'ME' THEN g.student_id END) AS me_count,
    COUNT(DISTINCT CASE WHEN g.broad = 'AE' THEN g.student_id END) AS ae_count,
    COUNT(DISTINCT CASE WHEN g.broad = 'BE' THEN g.student_id END) AS be_count
  FROM graded g
  GROUP BY g.subject_id, g.subject_name, g.subject_code
  ORDER BY g.subject_name;
END;
$function$;

-- CREATE OR REPLACE keeps existing grants, but re-assert them so a fresh
-- database built from this migration alone is usable.
GRANT EXECUTE ON FUNCTION get_class_performance(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_subject_performance(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_class_performance(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_subject_performance(UUID, UUID, UUID) TO service_role;
