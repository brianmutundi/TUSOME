-- TUSOME analytics: Daily Attendance Register
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Gap audit: Attendance was per-exam only. ShuleMS advertises daily class
-- registers, absence reasons, attendance trends, and parent notifications.

-- ---------------------------------------------------------------------------
-- 1. Daily attendance table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'sick')),
  absence_reason text,
  arrival_time time,
  remarks text,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, attendance_date)
);

ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_attendance_tenant ON public.daily_attendance;
CREATE POLICY daily_attendance_tenant ON public.daily_attendance
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_attendance TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. RPC: save_daily_attendance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_daily_attendance(
  p_attendance_date date,
  p_entries jsonb
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_entry jsonb;
  v_count INT := 0;
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

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    INSERT INTO public.daily_attendance (tenant_id, student_id, attendance_date, status, absence_reason, arrival_time, remarks, recorded_by)
    VALUES (
      v_caller_tenant,
      (v_entry->>'student_id')::uuid,
      p_attendance_date,
      v_entry->>'status',
      nullif(btrim(coalesce(v_entry->>'absence_reason', '')), ''),
      CASE WHEN v_entry->>'arrival_time' IS NOT NULL AND v_entry->>'arrival_time' != '' THEN (v_entry->>'arrival_time')::time ELSE NULL END,
      nullif(btrim(coalesce(v_entry->>'remarks', '')), ''),
      CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END
    )
    ON CONFLICT (tenant_id, student_id, attendance_date) DO UPDATE SET
      status = EXCLUDED.status,
      absence_reason = EXCLUDED.absence_reason,
      arrival_time = EXCLUDED.arrival_time,
      remarks = EXCLUDED.remarks,
      recorded_by = EXCLUDED.recorded_by,
      recorded_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_daily_attendance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_attendance(
  p_date date,
  p_class_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL
)
RETURNS TABLE(
  student_id uuid,
  student_name text,
  admission_no text,
  class_name text,
  stream_name text,
  status text,
  absence_reason text,
  arrival_time time,
  remarks text,
  recorded_at timestamptz
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
    s.id AS student_id,
    s.full_name AS student_name,
    s.admission_no,
    c.name AS class_name,
    st.name AS stream_name,
    COALESCE(da.status, 'present') AS status,
    da.absence_reason,
    da.arrival_time,
    da.remarks,
    da.recorded_at
  FROM public.students s
  LEFT JOIN public.classes c ON c.id = s.class_id
  LEFT JOIN public.streams st ON st.id = s.stream_id
  LEFT JOIN public.daily_attendance da ON da.student_id = s.id AND da.attendance_date = p_date
  WHERE (v_role = 'service_role' OR s.tenant_id = v_caller_tenant)
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
    AND (p_stream_id IS NULL OR s.stream_id = p_stream_id)
  ORDER BY s.full_name, s.admission_no;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: get_attendance_summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_attendance_summary(
  p_start_date date,
  p_end_date date,
  p_class_id uuid DEFAULT NULL
)
RETURNS TABLE(
  student_id uuid,
  student_name text,
  admission_no text,
  total_days bigint,
  present_days bigint,
  absent_days bigint,
  late_days bigint,
  excused_days bigint,
  sick_days bigint,
  attendance_pct numeric
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
    s.id AS student_id,
    s.full_name AS student_name,
    s.admission_no,
    COUNT(da.id) AS total_days,
    COUNT(da.id) FILTER (WHERE da.status = 'present') AS present_days,
    COUNT(da.id) FILTER (WHERE da.status = 'absent') AS absent_days,
    COUNT(da.id) FILTER (WHERE da.status = 'late') AS late_days,
    COUNT(da.id) FILTER (WHERE da.status = 'excused') AS excused_days,
    COUNT(da.id) FILTER (WHERE da.status = 'sick') AS sick_days,
    CASE
      WHEN COUNT(da.id) = 0 THEN 0
      ELSE ROUND(COUNT(da.id) FILTER (WHERE da.status IN ('present', 'late'))::numeric / COUNT(da.id)::numeric * 100, 1)
    END AS attendance_pct
  FROM public.students s
  LEFT JOIN public.daily_attendance da ON da.student_id = s.id AND da.attendance_date BETWEEN p_start_date AND p_end_date
  WHERE (v_role = 'service_role' OR s.tenant_id = v_caller_tenant)
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
  GROUP BY s.id, s.full_name, s.admission_no
  ORDER BY s.full_name, s.admission_no;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.save_daily_attendance(date, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_daily_attendance(date, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_attendance_summary(date, date, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_daily_attendance(date, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_attendance(date, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary(date, date, uuid) TO authenticated, service_role;
