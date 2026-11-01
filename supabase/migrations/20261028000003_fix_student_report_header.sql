-- TUSOME analytics: deterministic student report header
--
-- STATUS: repository-only. NOT applied to any database.
--
-- Why this migration exists
-- -------------------------
-- get_student_report_data() built the report header from students.class_id /
-- students.stream_id and only fell back to an *unordered* student_enrollments
-- row:
--
--   COALESCE(v_student.class_id, (SELECT class_id FROM student_enrollments ... LIMIT 1))
--
-- Two problems:
--   1. Enrollment data is authoritative for class/stream/academic year. When a
--      student has moved class, students.class_id is stale and the header is
--      wrong even though the enrollment table is correct.
--   2. The fallback subquery has no ORDER BY, so with more than one enrollment
--      PostgreSQL may return any row. The same report could show different
--      classes on different runs.
--
-- This migration resolves the enrollment once, deterministically, and uses it
-- first. The behavior is:
--
--   * Prefer the enrollment for the exam's academic year (that is the class the
--     student actually sat the exam in).
--   * Otherwise use the most recent enrollment by academic_year, then
--     created_at, then id (id only to break exact ties deterministically).
--   * Fall back to students.class_id / students.stream_id when the student has
--     no enrollment at all.
--   * Expose student.academic_year so the report can show which year the
--     header describes. It is null when no enrollment exists.
--
-- Student identity (admission_no, name, gender) still comes from students.
-- The signature, return type (json) and summary semantics (position is
-- exam-wide, as before) are unchanged. CREATE OR REPLACE preserves the
-- existing ACLs; 20261028000002 still applies after this migration because it
-- revokes EXECUTE from anon on the same signature.
--
-- Non-goal: changing the pass mark. See PRODUCT_DECISIONS.md.

CREATE OR REPLACE FUNCTION public.get_student_report_data(p_student_id uuid, p_exam_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_result JSON;
  v_exam_tenant UUID;
  v_exam RECORD;
  v_student RECORD;
  v_enrollment RECORD;
  v_school RECORD;
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  SELECT tenant_id, name, term, academic_year, assessment_component, status
  INTO v_exam
  FROM exams
  WHERE id = p_exam_id;

  v_exam_tenant := v_exam.tenant_id;

  IF v_exam_tenant IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  IF v_exam.status != 'published' THEN
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

    IF v_caller_tenant <> v_exam_tenant THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  SELECT s.*, s.tenant_id as student_tenant
  INTO v_student
  FROM students s
  WHERE s.id = p_student_id;

  IF v_student.student_tenant IS NULL OR v_student.student_tenant != v_exam_tenant THEN
    RAISE EXCEPTION 'Student not found in this tenant';
  END IF;

  -- Single deterministic choice. The first sort key prefers the class the
  -- student sat this exam in; the remaining keys make the choice stable when
  -- the exam year is unknown or the student has several enrollments in it.
  SELECT se.academic_year, se.class_id, se.stream_id
  INTO v_enrollment
  FROM student_enrollments se
  WHERE se.student_id = p_student_id
    AND se.tenant_id = v_exam_tenant
  ORDER BY
    (se.academic_year = v_exam.academic_year) DESC,
    se.academic_year DESC,
    se.created_at DESC,
    se.id DESC
  LIMIT 1;

  SELECT * INTO v_school
  FROM tenants
  WHERE id = v_exam_tenant;

  SELECT json_build_object(
    'student', json_build_object(
      'id', v_student.id,
      'admission_no', v_student.admission_no,
      'name', v_student.full_name,
      'class', (
        SELECT name FROM classes
        WHERE id = COALESCE(v_enrollment.class_id, v_student.class_id)
      ),
      'stream', (
        SELECT name FROM streams
        WHERE id = COALESCE(v_enrollment.stream_id, v_student.stream_id)
      ),
      'academic_year', v_enrollment.academic_year,
      'gender', v_student.gender
    ),
    'school', json_build_object(
      'name', v_school.name
    ),
    'exam', json_build_object(
      'name', v_exam.name,
      'term', v_exam.term,
      'year', v_exam.academic_year,
      'assessment_component', v_exam.assessment_component
    ),
    'subjects', (
      SELECT COALESCE(json_agg(json_build_object(
        'subject_id', sub.id,
        'subject_name', sub.name,
        'subject_code', sub.code,
        'score', m.score,
        'percentage', m.score,
        'grade', g.code,
        'grade_name', g.name,
        'points', g.points
      ) ORDER BY sub.name), '[]'::json)
      FROM marks m
      JOIN subjects sub ON sub.id = m.subject_id
      LEFT JOIN LATERAL get_grade_for_score(v_exam_tenant, m.score, 'default', NULL) g ON true
      WHERE m.exam_id = p_exam_id AND m.student_id = p_student_id
    ),
    'summary', (
      SELECT json_build_object(
        'total_score', COALESCE(SUM(m.score),0),
        'mean_percentage', CASE WHEN COUNT(m.score)>0 THEN ROUND(AVG(m.score)::numeric, 2) ELSE 0 END,
        'subjects_count', COUNT(DISTINCT m.subject_id),
        'position', (SELECT class_position FROM get_class_performance(p_exam_id) WHERE student_id = p_student_id LIMIT 1),
        'total_in_class', (SELECT COUNT(*)::int FROM get_class_performance(p_exam_id))
      )
      FROM marks m
      WHERE m.exam_id = p_exam_id AND m.student_id = p_student_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
