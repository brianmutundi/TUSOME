-- TUSOME analytics: data endpoints for the Zeraki-parity printouts
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Why this exists
-- ---------------
-- The Zeraki Analytics web bundle exposes printouts that the TUSOME dashboard
-- did not have data for:
--
--   * printouts/mark-list      (chunk-Z2GYXG2A.js: "All Papers", downloadMarkList)
--   * printouts/merit-list     (chunk-FRJZU4QD.js: "Merit List", "Most Improved",
--                               showMarks / showKcpeMarks / showSubjectPapers /
--                               showRanking toggles, classGradeSummary)
--   * printouts/analysis-report(chunk-Q4FKRZWB.js: analysisReport)
--   * students/:id/analytics   (chunk-P55HMAPS.js: compare-by-previous-exam,
--                               performanceOverTimeChartOptions)
--   * printouts/transcripts    (chunk-67MEQ2KN.js: transcripts)
--
-- The existing RPCs cover ranking (get_class_performance), grade bands
-- (get_grade_distribution) and subject aggregates (get_subject_performance).
-- They do not expose a student x subject matrix, a per-student exam history, or
-- a previous-exam comparison, so those three endpoints are added here.
--
-- Design rules (identical to the existing analytics functions)
-- -----------------------------------------------------------
-- * Exam-scoped functions require the exam to be published.
-- * Tenant comes from the verified JWT claim (auth.jwt()->>'tenant_id').
--   service_role is an explicit bypass. Everything else fails closed.
-- * SECURITY INVOKER, STABLE, no search_path override.
-- * Grades come from get_grade_for_score (tenant grading configuration); no
--   thresholds are hardcoded here.
-- * The roster is resolved with the same latest-enrollment rule as
--   get_class_performance: DISTINCT ON (student_id) ordered by academic_year
--   DESC, created_at DESC, then COALESCE(enrollment, students.*).
-- * New functions revoke the implicit PUBLIC/anon grant and grant only
--   authenticated + service_role.
--
-- Deliberately not included
-- -------------------------
-- * No KCPE column: the schema has no KCPE table or column, so the
--   showKcpeMarks toggle cannot be reproduced with real data.
-- * No paper-level breakdown: marks are one row per (exam, student, subject),
--   so "All Papers" is represented by the single subject score.
-- * No targets: the schema has no target table, so compare-by-targets is not
--   implementable without inventing data.
-- * pass_count is not recomputed here; the mark sheet is a matrix, not a
--   second definition of pass/fail.

-- ---------------------------------------------------------------------------
-- get_mark_sheet: student x subject matrix for the mark sheet / score sheet
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mark_sheet(
  p_exam_id uuid,
  p_class_id uuid DEFAULT NULL::uuid,
  p_stream_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  student_id uuid,
  admission_no text,
  student_name text,
  class_name text,
  stream_name text,
  subject_id uuid,
  subject_name text,
  subject_code text,
  score numeric,
  grade_code text,
  grade_name text,
  points integer
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
    SELECT DISTINCT ON (se.student_id)
           se.student_id,
           se.class_id,
           se.stream_id
    FROM student_enrollments se
    WHERE se.tenant_id = v_tenant_id
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  roster AS (
    SELECT
      s.id AS student_id,
      s.admission_no,
      s.full_name AS student_name,
      c.name AS class_name,
      st.name AS stream_name
    FROM students s
    LEFT JOIN current_enrollment se ON se.student_id = s.id
    LEFT JOIN classes c ON c.id = COALESCE(se.class_id, s.class_id)
    LEFT JOIN streams st ON st.id = COALESCE(se.stream_id, s.stream_id)
    WHERE s.tenant_id = v_tenant_id
      AND (p_class_id IS NULL OR COALESCE(se.class_id, s.class_id) = p_class_id)
      AND (p_stream_id IS NULL OR COALESCE(se.stream_id, s.stream_id) = p_stream_id)
  ),
  exam_scores AS (
    SELECT m.student_id, m.subject_id, m.score
    FROM marks m
    JOIN students s ON s.id = m.student_id
    WHERE m.exam_id = p_exam_id
      AND m.tenant_id = v_tenant_id
      AND s.tenant_id = v_tenant_id
  ),
  -- One grade lookup per distinct score instead of one per mark row.
  graded_scores AS (
    SELECT sc.score, g.code, g.name, g.points
    FROM (SELECT DISTINCT es.score FROM exam_scores es) sc
    LEFT JOIN LATERAL get_grade_for_score(
      v_tenant_id, sc.score, 'default', NULL
    ) g ON true
  )
  SELECT
    r.student_id,
    r.admission_no,
    r.student_name,
    r.class_name,
    r.stream_name,
    sub.id AS subject_id,
    sub.name AS subject_name,
    sub.code AS subject_code,
    es.score,
    gs.code AS grade_code,
    gs.name AS grade_name,
    gs.points
  FROM roster r
  JOIN exam_scores es ON es.student_id = r.student_id
  JOIN subjects sub ON sub.id = es.subject_id
  LEFT JOIN graded_scores gs ON gs.score = es.score
  WHERE sub.tenant_id = v_tenant_id
  ORDER BY r.admission_no, sub.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- get_student_exam_history: published-exam history for transcripts and
-- performance-over-time charts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_exam_history(p_student_id uuid)
RETURNS TABLE(
  exam_id uuid,
  exam_name text,
  term text,
  academic_year integer,
  assessment_component text,
  total_score numeric,
  mean_score numeric,
  subjects_count bigint,
  overall_grade text,
  overall_points integer,
  "position" bigint,
  total_in_exam bigint
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_student_tenant UUID;
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  SELECT s.tenant_id INTO v_student_tenant
  FROM students s
  WHERE s.id = p_student_id;

  IF v_student_tenant IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role = 'service_role' THEN
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

    IF v_caller_tenant <> v_student_tenant THEN
      RAISE EXCEPTION 'Access denied to student from different tenant';
    END IF;
  END IF;

  RETURN QUERY
  WITH exam_ids AS (
    SELECT DISTINCT m.exam_id
    FROM marks m
    WHERE m.student_id = p_student_id
  ),
  -- Rebuild the exam-wide ranking once, without calling get_class_performance
  -- for every row. DENSE_RANK matches that function's tie behaviour.
  exam_means AS (
    SELECT
      m.exam_id,
      m.student_id,
      SUM(m.score) AS total_score,
      COUNT(DISTINCT m.subject_id) AS subjects_count
    FROM marks m
    JOIN students s ON s.id = m.student_id
    WHERE m.exam_id IN (SELECT ei.exam_id FROM exam_ids ei)
      AND s.tenant_id = v_student_tenant
    GROUP BY m.exam_id, m.student_id
  ),
  ranked AS (
    SELECT
      em.*,
      DENSE_RANK() OVER (
        PARTITION BY em.exam_id
        ORDER BY (em.total_score / em.subjects_count) DESC
      ) AS "position",
      COUNT(*) OVER (PARTITION BY em.exam_id) AS total_in_exam
    FROM exam_means em
  )
  SELECT
    e.id AS exam_id,
    e.name AS exam_name,
    e.term,
    e.academic_year,
    e.assessment_component,
    r.total_score,
    ROUND((r.total_score / r.subjects_count)::numeric, 2) AS mean_score,
    r.subjects_count,
    g.code AS overall_grade,
    g.points AS overall_points,
    r."position",
    r.total_in_exam
  FROM ranked r
  JOIN exams e ON e.id = r.exam_id
  LEFT JOIN LATERAL get_grade_for_score(
    v_student_tenant,
    ROUND((r.total_score / r.subjects_count)::numeric, 2),
    'default',
    NULL
  ) g ON true
  WHERE r.student_id = p_student_id
    AND e.tenant_id = v_student_tenant
    AND e.status = 'published'
    AND r.subjects_count > 0
  ORDER BY e.academic_year DESC NULLS LAST, e.created_at DESC, e.id DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- get_most_improved: current mean vs the previous published exam
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_most_improved(
  p_exam_id uuid,
  p_class_id uuid DEFAULT NULL::uuid,
  p_stream_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  student_id uuid,
  admission_no text,
  student_name text,
  stream_name text,
  current_mean numeric,
  previous_mean numeric,
  delta numeric,
  previous_exam_name text
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tenant_id UUID;
  v_exam_status TEXT;
  v_exam_year INTEGER;
  v_exam_created TIMESTAMPTZ;
  v_caller_tenant UUID;
  v_role TEXT;
  v_previous_id UUID;
  v_previous_name TEXT;
BEGIN
  SELECT e.tenant_id, e.status, e.academic_year, e.created_at
  INTO v_tenant_id, v_exam_status, v_exam_year, v_exam_created
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

  -- Previous published exam for the same tenant, strictly earlier than the
  -- selected exam. Academic year is the primary key so a 2026 exam compares to
  -- 2025 even when both rows share a created_at timestamp.
  SELECT e.id, e.name INTO v_previous_id, v_previous_name
  FROM exams e
  WHERE e.tenant_id = v_tenant_id
    AND e.status = 'published'
    AND e.id <> p_exam_id
    AND (
      (v_exam_year IS NOT NULL AND e.academic_year IS NOT NULL AND e.academic_year < v_exam_year)
      OR (e.academic_year IS NOT DISTINCT FROM v_exam_year AND e.created_at < v_exam_created)
      OR (e.academic_year IS NOT DISTINCT FROM v_exam_year
          AND e.created_at = v_exam_created
          AND e.id < p_exam_id)
    )
  ORDER BY e.academic_year DESC NULLS LAST, e.created_at DESC, e.id DESC
  LIMIT 1;

  -- No earlier published exam: there is nothing to compare against.
  IF v_previous_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH current_enrollment AS (
    SELECT DISTINCT ON (se.student_id)
           se.student_id,
           se.class_id,
           se.stream_id
    FROM student_enrollments se
    WHERE se.tenant_id = v_tenant_id
    ORDER BY se.student_id, se.academic_year DESC, se.created_at DESC
  ),
  roster AS (
    SELECT
      s.id AS student_id,
      s.admission_no,
      s.full_name AS student_name,
      st.name AS stream_name
    FROM students s
    LEFT JOIN current_enrollment se ON se.student_id = s.id
    LEFT JOIN streams st ON st.id = COALESCE(se.stream_id, s.stream_id)
    WHERE s.tenant_id = v_tenant_id
      AND (p_class_id IS NULL OR COALESCE(se.class_id, s.class_id) = p_class_id)
      AND (p_stream_id IS NULL OR COALESCE(se.stream_id, s.stream_id) = p_stream_id)
  ),
  exam_means AS (
    SELECT
      m.exam_id,
      m.student_id,
      (SUM(m.score) / COUNT(DISTINCT m.subject_id)) AS mean_score
    FROM marks m
    JOIN students s ON s.id = m.student_id
    WHERE m.exam_id IN (p_exam_id, v_previous_id)
      AND s.tenant_id = v_tenant_id
    GROUP BY m.exam_id, m.student_id
  ),
  current_means AS (
    SELECT em.student_id, em.mean_score FROM exam_means em WHERE em.exam_id = p_exam_id
  ),
  previous_means AS (
    SELECT em.student_id, em.mean_score FROM exam_means em WHERE em.exam_id = v_previous_id
  )
  SELECT
    r.student_id,
    r.admission_no,
    r.student_name,
    r.stream_name,
    ROUND(c.mean_score, 2) AS current_mean,
    ROUND(p.mean_score, 2) AS previous_mean,
    ROUND(c.mean_score - p.mean_score, 2) AS delta,
    v_previous_name AS previous_exam_name
  FROM roster r
  JOIN current_means c ON c.student_id = r.student_id
  JOIN previous_means p ON p.student_id = r.student_id
  ORDER BY (c.mean_score - p.mean_score) DESC, r.admission_no;
END;
$function$;

-- New functions: remove the implicit PUBLIC grant instead of inheriting it.
REVOKE ALL ON FUNCTION public.get_mark_sheet(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mark_sheet(UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_student_exam_history(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_exam_history(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_most_improved(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_most_improved(UUID, UUID, UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_mark_sheet(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mark_sheet(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_student_exam_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_exam_history(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_most_improved(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_most_improved(UUID, UUID, UUID) TO service_role;
