-- TUSOME analytics: Full Boarding Management (Phase 5)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Meal plans table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  residence_id uuid REFERENCES public.student_residences (id) ON DELETE SET NULL,
  meal_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  menu text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_plans_tenant ON public.meal_plans;
CREATE POLICY meal_plans_tenant ON public.meal_plans
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plans TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Meal attendance table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  meal_plan_id uuid NOT NULL REFERENCES public.meal_plans (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused')),
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meal_plan_id, student_id)
);

ALTER TABLE public.meal_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_attendance_tenant ON public.meal_attendance;
CREATE POLICY meal_attendance_tenant ON public.meal_attendance
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.meal_attendance TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Boarding roll calls table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boarding_roll_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  residence_id uuid NOT NULL REFERENCES public.student_residences (id) ON DELETE CASCADE,
  roll_call_date date NOT NULL,
  roll_call_time time NOT NULL DEFAULT '21:00',
  roll_call_type text NOT NULL DEFAULT 'evening' CHECK (roll_call_type IN ('morning', 'evening', 'night')),
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, residence_id, roll_call_date, roll_call_type)
);

ALTER TABLE public.boarding_roll_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boarding_roll_calls_tenant ON public.boarding_roll_calls;
CREATE POLICY boarding_roll_calls_tenant ON public.boarding_roll_calls
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.boarding_roll_calls TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Boarding roll call entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boarding_roll_call_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  roll_call_id uuid NOT NULL REFERENCES public.boarding_roll_calls (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused', 'on_leave')),
  remarks text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roll_call_id, student_id)
);

ALTER TABLE public.boarding_roll_call_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boarding_roll_call_entries_tenant ON public.boarding_roll_call_entries;
CREATE POLICY boarding_roll_call_entries_tenant ON public.boarding_roll_call_entries
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.boarding_roll_call_entries TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_meal_plans
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_meal_plans(p_residence_id uuid DEFAULT NULL, p_date date DEFAULT NULL)
RETURNS TABLE(
  plan_id uuid,
  residence_id uuid,
  residence_name text,
  meal_date date,
  meal_type text,
  menu text,
  present_count bigint,
  absent_count bigint
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
    mp.id AS plan_id,
    mp.residence_id,
    sr.name AS residence_name,
    mp.meal_date,
    mp.meal_type,
    mp.menu,
    (SELECT COUNT(*) FROM public.meal_attendance ma WHERE ma.meal_plan_id = mp.id AND ma.status = 'present') AS present_count,
    (SELECT COUNT(*) FROM public.meal_attendance ma WHERE ma.meal_plan_id = mp.id AND ma.status = 'absent') AS absent_count
  FROM public.meal_plans mp
  LEFT JOIN public.student_residences sr ON sr.id = mp.residence_id
  WHERE (v_role = 'service_role' OR mp.tenant_id = v_caller_tenant)
    AND (p_residence_id IS NULL OR mp.residence_id = p_residence_id)
    AND (p_date IS NULL OR mp.meal_date = p_date)
  ORDER BY mp.meal_date DESC, mp.meal_type;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: create_meal_plan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_meal_plan(
  p_residence_id uuid,
  p_meal_date date,
  p_meal_type text,
  p_menu text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_plan_id UUID;
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

  INSERT INTO public.meal_plans (tenant_id, residence_id, meal_date, meal_type, menu, created_by)
  VALUES (v_caller_tenant, p_residence_id, p_meal_date, p_meal_type, nullif(btrim(coalesce(p_menu, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_plan_id;

  RETURN v_plan_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: save_meal_attendance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_meal_attendance(
  p_meal_plan_id uuid,
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
    INSERT INTO public.meal_attendance (tenant_id, meal_plan_id, student_id, status, recorded_by)
    VALUES (
      v_caller_tenant,
      p_meal_plan_id,
      (v_entry->>'student_id')::uuid,
      v_entry->>'status',
      CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END
    )
    ON CONFLICT (meal_plan_id, student_id) DO UPDATE SET
      status = EXCLUDED.status,
      recorded_by = EXCLUDED.recorded_by,
      recorded_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_boarding_roll_calls
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_boarding_roll_calls(p_residence_id uuid DEFAULT NULL, p_date date DEFAULT NULL)
RETURNS TABLE(
  roll_call_id uuid,
  residence_id uuid,
  residence_name text,
  roll_call_date date,
  roll_call_time time,
  roll_call_type text,
  present_count bigint,
  absent_count bigint,
  total_count bigint
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
    brc.id AS roll_call_id,
    brc.residence_id,
    sr.name AS residence_name,
    brc.roll_call_date,
    brc.roll_call_time,
    brc.roll_call_type,
    (SELECT COUNT(*) FROM public.boarding_roll_call_entries brce WHERE brce.roll_call_id = brc.id AND brce.status = 'present') AS present_count,
    (SELECT COUNT(*) FROM public.boarding_roll_call_entries brce WHERE brce.roll_call_id = brc.id AND brce.status = 'absent') AS absent_count,
    (SELECT COUNT(*) FROM public.boarding_roll_call_entries brce WHERE brce.roll_call_id = brc.id) AS total_count
  FROM public.boarding_roll_calls brc
  LEFT JOIN public.student_residences sr ON sr.id = brc.residence_id
  WHERE (v_role = 'service_role' OR brc.tenant_id = v_caller_tenant)
    AND (p_residence_id IS NULL OR brc.residence_id = p_residence_id)
    AND (p_date IS NULL OR brc.roll_call_date = p_date)
  ORDER BY brc.roll_call_date DESC, brc.roll_call_time;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: create_boarding_roll_call
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_boarding_roll_call(
  p_residence_id uuid,
  p_roll_call_date date,
  p_roll_call_time time DEFAULT '21:00'::time,
  p_roll_call_type text DEFAULT 'evening'
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_rc_id UUID;
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

  INSERT INTO public.boarding_roll_calls (tenant_id, residence_id, roll_call_date, roll_call_time, roll_call_type, recorded_by)
  VALUES (v_caller_tenant, p_residence_id, p_roll_call_date, p_roll_call_time, p_roll_call_type, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  ON CONFLICT (tenant_id, residence_id, roll_call_date, roll_call_type) DO NOTHING
  RETURNING id INTO v_rc_id;

  IF v_rc_id IS NULL THEN
    SELECT id INTO v_rc_id FROM public.boarding_roll_calls
    WHERE tenant_id = v_caller_tenant AND residence_id = p_residence_id AND roll_call_date = p_roll_call_date AND roll_call_type = p_roll_call_type;
  END IF;

  RETURN v_rc_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. RPC: save_boarding_roll_call_entries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_boarding_roll_call_entries(
  p_roll_call_id uuid,
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
    INSERT INTO public.boarding_roll_call_entries (tenant_id, roll_call_id, student_id, status, remarks, recorded_by)
    VALUES (
      v_caller_tenant,
      p_roll_call_id,
      (v_entry->>'student_id')::uuid,
      v_entry->>'status',
      nullif(btrim(coalesce(v_entry->>'remarks', '')), ''),
      CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END
    )
    ON CONFLICT (roll_call_id, student_id) DO UPDATE SET
      status = EXCLUDED.status,
      remarks = EXCLUDED.remarks,
      recorded_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 11. RPC: get_boarding_roll_call_entries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_boarding_roll_call_entries(p_roll_call_id uuid)
RETURNS TABLE(
  entry_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  residence_name text,
  status text,
  remarks text
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
    brce.id AS entry_id,
    brce.student_id,
    s.full_name AS student_name,
    s.admission_no,
    sr.name AS residence_name,
    COALESCE(brce.status, 'present') AS status,
    brce.remarks
  FROM public.boarding_roll_call_entries brce
  RIGHT JOIN public.students s ON s.id = brce.student_id
  LEFT JOIN public.student_residence_assignments sra ON sra.student_id = s.id
  LEFT JOIN public.student_residences sr ON sr.id = sra.residence_id
  WHERE (v_role = 'service_role' OR s.tenant_id = v_caller_tenant)
    AND (brce.roll_call_id = p_roll_call_id OR brce.roll_call_id IS NULL)
  ORDER BY s.full_name, s.admission_no;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 12. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_meal_plans(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_meal_plan(uuid, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_meal_attendance(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_boarding_roll_calls(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_boarding_roll_call(uuid, date, time, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_boarding_roll_call_entries(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_boarding_roll_call_entries(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_meal_plans(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_meal_plan(uuid, date, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_meal_attendance(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_boarding_roll_calls(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_boarding_roll_call(uuid, date, time, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_boarding_roll_call_entries(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_boarding_roll_call_entries(uuid) TO authenticated, service_role;
