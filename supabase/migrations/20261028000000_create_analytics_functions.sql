-- TUSOME Analytics Migration (Synced from live DB)
-- All functions include tenant isolation, publication checks, and fail-closed authorization

-- Drop existing functions
DROP FUNCTION IF EXISTS get_grade_for_score(UUID, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_class_performance(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS get_grade_distribution(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS get_student_report_data(UUID, UUID);
DROP FUNCTION IF EXISTS get_subject_performance(UUID, UUID, UUID);

-- Function to get grade for a given percentage using grading configuration
CREATE OR REPLACE FUNCTION public.get_grade_for_score(p_tenant_id uuid, p_score numeric, p_school_level text DEFAULT 'default'::text, p_grade_level text DEFAULT NULL::text)
 RETURNS TABLE(code text, name text, points integer, broad text, color text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_config_id UUID;
  v_count INTEGER;
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  -- Validate inputs
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id cannot be null';
  END IF;
  
  IF p_score IS NULL THEN
    RAISE EXCEPTION 'score cannot be null';
  END IF;

  -- Get role
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  -- Tenant isolation: fail closed
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

    IF v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'Access denied to grading config from different tenant';
    END IF;
  END IF;

  -- Find active grading configuration for tenant/school level
  SELECT gc.id INTO v_config_id
  FROM grading_configurations gc
  WHERE gc.tenant_id = p_tenant_id
    AND gc.active = true
    AND (gc.school_level = COALESCE(p_school_level, 'default') OR gc.school_level = 'default')
  ORDER BY 
    CASE WHEN gc.school_level = COALESCE(p_school_level, 'default') THEN 0 ELSE 1 END,
    CASE WHEN gc.grade_level = p_grade_level THEN 0 ELSE 1 END,
    gc.created_at DESC
  LIMIT 1;

  IF v_config_id IS NULL AND p_school_level IS NOT NULL AND p_school_level != 'default' THEN
    RAISE EXCEPTION 'No active grading configuration found for tenant % and school_level %', p_tenant_id, p_school_level;
  END IF;

  IF v_config_id IS NULL THEN
    SELECT gc.id INTO v_config_id
    FROM grading_configurations gc
    WHERE gc.tenant_id = p_tenant_id
      AND gc.active = true
    ORDER BY gc.created_at DESC
    LIMIT 1;
  END IF;

  IF v_config_id IS NULL THEN
    RAISE EXCEPTION 'No active grading configuration found for tenant %', p_tenant_id;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM grading_configuration_levels
  WHERE config_id = v_config_id;
  
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Grading configuration % has no levels defined', v_config_id;
  END IF;

  RETURN QUERY
  SELECT gcl.code, gcl.name, gcl.points, gcl.broad, gcl.color
  FROM grading_configuration_levels gcl
  WHERE gcl.config_id = v_config_id
    AND p_score >= gcl.min_percent
    AND p_score <= gcl.max_percent
  ORDER BY gcl.sort_order, gcl.points DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No grade level matches score % for config %', p_score, v_config_id;
  END IF;
END;
$function$;

-- Class Performance Summary
CREATE OR REPLACE FUNCTION public.get_class_performance(p_exam_id uuid, p_class_id uuid DEFAULT NULL::uuid, p_stream_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(student_id uuid, admission_no text, student_name text, stream_name text, total_score numeric, mean_score numeric, mean_percentage numeric, overall_grade text, overall_points integer, class_position bigint, subjects_count bigint, passed_count bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_tenant_id UUID;
  v_exam_status TEXT;
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  SELECT tenant_id, status INTO v_tenant_id, v_exam_status
  FROM exams
  WHERE id = p_exam_id;
  
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
  WITH student_totals AS (
    SELECT 
      s.id as student_id,
      s.admission_no as admission_no,
      s.full_name as student_name,
      st.name as stream_name,
      COALESCE(SUM(m.score), 0) as total_score,
      COUNT(DISTINCT m.subject_id) as cnt_subjects,
      COUNT(DISTINCT CASE WHEN m.score >= 40 THEN m.subject_id END) as cnt_passed,
      s.tenant_id
    FROM students s
    LEFT JOIN marks m ON m.student_id = s.id AND m.exam_id = p_exam_id
    LEFT JOIN student_enrollments se ON se.student_id = s.id
    LEFT JOIN streams st ON st.id = COALESCE(se.stream_id, s.stream_id)
    LEFT JOIN exam_classes ec ON ec.exam_id = p_exam_id
    WHERE s.tenant_id = v_tenant_id
      AND (p_class_id IS NULL OR ec.class_id = p_class_id OR se.class_id = p_class_id OR s.class_id = p_class_id)
      AND (p_stream_id IS NULL OR COALESCE(se.stream_id, s.stream_id) = p_stream_id)
      AND EXISTS (SELECT 1 FROM marks m2 WHERE m2.student_id = s.id AND m2.exam_id = p_exam_id)
    GROUP BY s.id, s.admission_no, s.full_name, st.name, se.stream_id, s.tenant_id
  ),
  ranked AS (
    SELECT 
      st2.*,
      CASE WHEN st2.cnt_subjects > 0 THEN ROUND((st2.total_score / st2.cnt_subjects)::numeric, 2) ELSE 0 END as mean_score,
      CASE WHEN st2.cnt_subjects > 0 THEN ROUND((st2.total_score / st2.cnt_subjects)::numeric, 2) ELSE 0 END as mean_percentage,
      DENSE_RANK() OVER (ORDER BY (CASE WHEN st2.cnt_subjects > 0 THEN st2.total_score / st2.cnt_subjects ELSE 0 END) DESC) as position
    FROM student_totals st2
  )
  SELECT 
    r.student_id,
    r.admission_no,
    r.student_name,
    r.stream_name,
    r.total_score,
    r.mean_score,
    r.mean_percentage,
    g.code as overall_grade,
    g.points as overall_points,
    r.position as class_position,
    r.cnt_subjects as subjects_count,
    r.cnt_passed as passed_count
  FROM ranked r
  LEFT JOIN LATERAL get_grade_for_score(r.tenant_id, r.mean_percentage, 'default', NULL) g ON true
  ORDER BY r.position, r.admission_no;
END;
$function$;

-- Grade distribution for a class/exam
CREATE OR REPLACE FUNCTION public.get_grade_distribution(p_exam_id uuid, p_class_id uuid DEFAULT NULL::uuid, p_stream_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(grade_code text, grade_name text, broad_grade text, count bigint, percentage numeric, color text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_tenant_id UUID;
  v_exam_status TEXT;
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  SELECT tenant_id, status INTO v_tenant_id, v_exam_status FROM exams WHERE id = p_exam_id;
  
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
  WITH class_perf AS (
    SELECT * FROM get_class_performance(p_exam_id, p_class_id, p_stream_id)
  ),
  total AS (
    SELECT COUNT(*) as total_count FROM class_perf
  )
  SELECT 
    cp.overall_grade as grade_code,
    g.name as grade_name,
    g.broad as broad_grade,
    COUNT(*) as count,
    CASE 
      WHEN t.total_count = 0 THEN 0::numeric
      ELSE ROUND((COUNT(*) * 100.0 / t.total_count)::numeric, 1)
    END as percentage,
    g.color
  FROM class_perf cp
  CROSS JOIN total t
  LEFT JOIN LATERAL get_grade_for_score(v_tenant_id, cp.mean_percentage, 'default', NULL) g ON true
  WHERE cp.overall_grade IS NOT NULL
  GROUP BY cp.overall_grade, g.name, g.broad, g.color, t.total_count
  ORDER BY MAX(COALESCE(g.points, 0)) DESC;
END;
$function$;

-- Student Report Data (for generating report cards)
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

  SELECT * INTO v_school
  FROM tenants
  WHERE id = v_exam_tenant;

  SELECT json_build_object(
    'student', json_build_object(
      'id', v_student.id,
      'admission_no', v_student.admission_no,
      'name', v_student.full_name,
      'class', (SELECT name FROM classes WHERE id = COALESCE(v_student.class_id, (SELECT class_id FROM student_enrollments WHERE student_id = p_student_id LIMIT 1))),
      'stream', (SELECT name FROM streams WHERE id = COALESCE(v_student.stream_id, (SELECT stream_id FROM student_enrollments WHERE student_id = p_student_id LIMIT 1))),
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

-- Departmental/Subject Performance Analysis
CREATE OR REPLACE FUNCTION public.get_subject_performance(p_exam_id uuid, p_class_id uuid DEFAULT NULL::uuid, p_stream_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(subject_id uuid, subject_name text, subject_code text, total_students bigint, mean_score numeric, highest_score numeric, lowest_score numeric, pass_count bigint, pass_rate numeric, ee_count bigint, me_count bigint, ae_count bigint, be_count bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_tenant_id UUID;
  v_exam_status TEXT;
  v_caller_tenant UUID;
  v_role TEXT;
BEGIN
  SELECT tenant_id, status INTO v_tenant_id, v_exam_status FROM exams WHERE id = p_exam_id;
  
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
  WITH subject_stats AS (
    SELECT 
      sub.id as subject_id,
      sub.name as subject_name,
      sub.code as subject_code,
      m.student_id,
      m.score
    FROM marks m
    JOIN subjects sub ON sub.id = m.subject_id
    JOIN students s ON s.id = m.student_id
    LEFT JOIN exam_classes ec ON ec.exam_id = p_exam_id
    LEFT JOIN student_enrollments se ON se.student_id = m.student_id
    WHERE m.exam_id = p_exam_id
      AND s.tenant_id = v_tenant_id
      AND EXISTS (SELECT 1 FROM marks m2 WHERE m2.student_id = s.id AND m2.exam_id = p_exam_id)
      AND (p_class_id IS NULL OR ec.class_id = p_class_id OR se.class_id = p_class_id OR s.class_id = p_class_id)
      AND (p_stream_id IS NULL OR COALESCE(se.stream_id, s.stream_id) = p_stream_id)
  )
  SELECT 
    ss.subject_id,
    ss.subject_name,
    ss.subject_code,
    COUNT(DISTINCT ss.student_id) as total_students,
    ROUND(AVG(ss.score)::numeric, 2) as mean_score,
    MAX(ss.score) as highest_score,
    MIN(ss.score) as lowest_score,
    COUNT(DISTINCT CASE WHEN ss.score >= 40 THEN ss.student_id END) as pass_count,
    ROUND((COUNT(DISTINCT CASE WHEN ss.score >= 40 THEN ss.student_id END) * 100.0 / NULLIF(COUNT(DISTINCT ss.student_id),0))::numeric, 2) as pass_rate,
    COUNT(DISTINCT CASE WHEN ss.score >= 75 THEN ss.student_id END) as ee_count,
    COUNT(DISTINCT CASE WHEN ss.score >= 50 AND ss.score < 75 THEN ss.student_id END) as me_count,
    COUNT(DISTINCT CASE WHEN ss.score >= 40 AND ss.score < 50 THEN ss.student_id END) as ae_count,
    COUNT(DISTINCT CASE WHEN ss.score < 40 THEN ss.student_id END) as be_count
  FROM subject_stats ss
  GROUP BY ss.subject_id, ss.subject_name, ss.subject_code
  ORDER BY ss.subject_name;
END;
$function$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_grade_for_score(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_class_performance(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_grade_distribution(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_report_data(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_subject_performance(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_grade_for_score(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_class_performance(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_grade_distribution(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_student_report_data(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_subject_performance(UUID, UUID, UUID) TO service_role;
