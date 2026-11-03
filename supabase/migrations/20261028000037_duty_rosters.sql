-- TUSOME analytics: Duty Rosters & Substitutions
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Duty rosters table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duty_rosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  term_week_id text,
  duty_type text NOT NULL DEFAULT 'general' CHECK (duty_type IN ('general', 'assembly', 'break', 'lunch', 'gate', 'library', 'lab', 'sports')),
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.duty_rosters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS duty_rosters_tenant ON public.duty_rosters;
CREATE POLICY duty_rosters_tenant ON public.duty_rosters
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_rosters TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Duty assignments table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  roster_id uuid NOT NULL REFERENCES public.duty_rosters (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  duty_date date NOT NULL,
  duty_period text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roster_id, staff_id, duty_date)
);

ALTER TABLE public.duty_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS duty_assignments_tenant ON public.duty_assignments;
CREATE POLICY duty_assignments_tenant ON public.duty_assignments
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_assignments TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Substitutions table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  original_staff_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  substitute_staff_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  timetable_entry_id uuid REFERENCES public.timetable_entries (id) ON DELETE SET NULL,
  substitution_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS substitutions_tenant ON public.substitutions;
CREATE POLICY substitutions_tenant ON public.substitutions
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.substitutions TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC: get_duty_rosters
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_duty_rosters()
RETURNS TABLE(
  roster_id uuid,
  duty_type text,
  description text,
  start_date date,
  end_date date,
  assignment_count bigint
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
    dr.id AS roster_id,
    dr.duty_type,
    dr.description,
    dr.start_date,
    dr.end_date,
    (SELECT COUNT(*) FROM public.duty_assignments da WHERE da.roster_id = dr.id) AS assignment_count
  FROM public.duty_rosters dr
  WHERE (v_role = 'service_role' OR dr.tenant_id = v_caller_tenant)
  ORDER BY dr.start_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: create_duty_roster
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_duty_roster(
  p_duty_type text,
  p_start_date date,
  p_end_date date,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_roster_id UUID;
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

  INSERT INTO public.duty_rosters (tenant_id, duty_type, start_date, end_date, description, created_by)
  VALUES (v_caller_tenant, p_duty_type, p_start_date, p_end_date, nullif(btrim(coalesce(p_description, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_roster_id;

  RETURN v_roster_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_duty_assignments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_duty_assignments(p_roster_id uuid)
RETURNS TABLE(
  assignment_id uuid,
  staff_id uuid,
  staff_name text,
  duty_date date,
  duty_period text,
  notes text
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
    da.id AS assignment_id,
    da.staff_id,
    p.full_name AS staff_name,
    da.duty_date,
    da.duty_period,
    da.notes
  FROM public.duty_assignments da
  LEFT JOIN public.profiles p ON p.id = da.staff_id
  WHERE (v_role = 'service_role' OR da.tenant_id = v_caller_tenant)
    AND da.roster_id = p_roster_id
  ORDER BY da.duty_date, p.full_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: assign_duty
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_duty(
  p_roster_id uuid,
  p_staff_id uuid,
  p_duty_date date,
  p_duty_period text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_assignment_id UUID;
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

  INSERT INTO public.duty_assignments (tenant_id, roster_id, staff_id, duty_date, duty_period, notes)
  VALUES (v_caller_tenant, p_roster_id, p_staff_id, p_duty_date, nullif(btrim(coalesce(p_duty_period, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''))
  ON CONFLICT (roster_id, staff_id, duty_date) DO UPDATE SET
    duty_period = EXCLUDED.duty_period,
    notes = EXCLUDED.notes
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_substitutions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_substitutions(p_date date DEFAULT NULL)
RETURNS TABLE(
  substitution_id uuid,
  original_staff_id uuid,
  original_staff_name text,
  substitute_staff_id uuid,
  substitute_staff_name text,
  timetable_entry_id uuid,
  substitution_date date,
  reason text,
  status text
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
    s.id AS substitution_id,
    s.original_staff_id,
    p1.full_name AS original_staff_name,
    s.substitute_staff_id,
    p2.full_name AS substitute_staff_name,
    s.timetable_entry_id,
    s.substitution_date,
    s.reason,
    s.status
  FROM public.substitutions s
  LEFT JOIN public.profiles p1 ON p1.id = s.original_staff_id
  LEFT JOIN public.profiles p2 ON p2.id = s.substitute_staff_id
  WHERE (v_role = 'service_role' OR s.tenant_id = v_caller_tenant)
    AND (p_date IS NULL OR s.substitution_date = p_date)
  ORDER BY s.substitution_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: create_substitution
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_substitution(
  p_original_staff_id uuid,
  p_substitute_staff_id uuid,
  p_substitution_date date,
  p_timetable_entry_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_sub_id UUID;
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

  IF p_original_staff_id = p_substitute_staff_id THEN
    RAISE EXCEPTION 'Original and substitute staff cannot be the same';
  END IF;

  INSERT INTO public.substitutions (tenant_id, original_staff_id, substitute_staff_id, timetable_entry_id, substitution_date, reason, created_by)
  VALUES (v_caller_tenant, p_original_staff_id, p_substitute_staff_id, p_timetable_entry_id, p_substitution_date, nullif(btrim(coalesce(p_reason, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_sub_id;

  RETURN v_sub_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_duty_rosters() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_duty_roster(text, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_duty_assignments(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_duty(uuid, uuid, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_substitutions(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_substitution(uuid, uuid, date, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_duty_rosters() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_duty_roster(text, date, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_duty_assignments(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_duty(uuid, uuid, date, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_substitutions(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_substitution(uuid, uuid, date, uuid, text) TO authenticated, service_role;
