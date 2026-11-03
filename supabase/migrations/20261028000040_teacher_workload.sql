-- TUSOME analytics: Teacher Workload (Phase 3D)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. RPC: get_teacher_workload
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_teacher_workload()
RETURNS TABLE(
  teacher_id uuid,
  teacher_name text,
  total_periods bigint,
  total_hours numeric,
  subject_count bigint,
  class_count bigint,
  duty_count bigint,
  substitution_count bigint
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
    p.id AS teacher_id,
    p.full_name AS teacher_name,
    COUNT(DISTINCT te.id) AS total_periods,
    COALESCE(SUM(
      EXTRACT(EPOCH FROM (ts.end_time - ts.start_time)) / 3600
    ), 0) AS total_hours,
    COUNT(DISTINCT te.subject_id) AS subject_count,
    COUNT(DISTINCT te.class_id) AS class_count,
    (SELECT COUNT(*) FROM public.duty_assignments da WHERE da.staff_id = p.id AND (v_role = 'service_role' OR da.tenant_id = v_caller_tenant)) AS duty_count,
    (SELECT COUNT(*) FROM public.substitutions s WHERE s.substitute_staff_id = p.id AND (v_role = 'service_role' OR s.tenant_id = v_caller_tenant)) AS substitution_count
  FROM public.profiles p
  LEFT JOIN public.timetable_entries te ON te.teacher_id = p.id
  LEFT JOIN public.timetable_slots ts ON ts.id = te.slot_id
  WHERE (v_role = 'service_role' OR p.tenant_id = v_caller_tenant)
    AND p.staff_type = 'TEACHER'
  GROUP BY p.id, p.full_name
  ORDER BY total_periods DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_teacher_workload() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_workload() TO authenticated, service_role;
