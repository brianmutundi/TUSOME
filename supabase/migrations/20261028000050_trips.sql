-- TUSOME analytics: Trips & Excursions (Phase 5)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Trips table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  trip_type text NOT NULL DEFAULT 'educational' CHECK (trip_type IN ('educational', 'sports', 'cultural', 'religious', 'social', 'other')),
  destination text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  departure_time time,
  return_time time,
  transport_mode text,
  estimated_cost numeric,
  actual_cost numeric,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'approved', 'in_progress', 'completed', 'cancelled')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trips_tenant ON public.trips;
CREATE POLICY trips_tenant ON public.trips
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Trip participants table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  permission_slip_signed boolean NOT NULL DEFAULT false,
  permission_slip_date date,
  signed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'waived', 'not_required')),
  amount_paid numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, student_id)
);

ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_participants_tenant ON public.trip_participants;
CREATE POLICY trip_participants_tenant ON public.trip_participants
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_participants TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_trips
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_trips(p_status text DEFAULT NULL)
RETURNS TABLE(
  trip_id uuid,
  title text,
  description text,
  trip_type text,
  destination text,
  start_date date,
  end_date date,
  departure_time time,
  return_time time,
  transport_mode text,
  estimated_cost numeric,
  actual_cost numeric,
  status text,
  participant_count bigint,
  permission_slip_count bigint,
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
  SELECT
    t.id AS trip_id,
    t.title,
    t.description,
    t.trip_type,
    t.destination,
    t.start_date,
    t.end_date,
    t.departure_time,
    t.return_time,
    t.transport_mode,
    t.estimated_cost,
    t.actual_cost,
    t.status,
    (SELECT COUNT(*) FROM public.trip_participants tp WHERE tp.trip_id = t.id) AS participant_count,
    (SELECT COUNT(*) FROM public.trip_participants tp WHERE tp.trip_id = t.id AND tp.permission_slip_signed = true) AS permission_slip_count,
    t.created_at
  FROM public.trips t
  WHERE (v_role = 'service_role' OR t.tenant_id = v_caller_tenant)
    AND (p_status IS NULL OR t.status = p_status)
  ORDER BY t.start_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_trip
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_trip(
  p_title text,
  p_destination text,
  p_start_date date,
  p_end_date date,
  p_trip_type text DEFAULT 'educational',
  p_description text DEFAULT NULL,
  p_departure_time time DEFAULT NULL,
  p_return_time time DEFAULT NULL,
  p_transport_mode text DEFAULT NULL,
  p_estimated_cost numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_trip_id UUID;
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

  IF btrim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Trip title is required';
  END IF;

  IF btrim(coalesce(p_destination, '')) = '' THEN
    RAISE EXCEPTION 'Destination is required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  INSERT INTO public.trips (tenant_id, title, description, trip_type, destination, start_date, end_date, departure_time, return_time, transport_mode, estimated_cost, created_by)
  VALUES (v_caller_tenant, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), p_trip_type, btrim(p_destination), p_start_date, p_end_date, p_departure_time, p_return_time, nullif(btrim(coalesce(p_transport_mode, '')), ''), p_estimated_cost, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_trip_id;

  RETURN v_trip_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: add_trip_participant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_trip_participant(
  p_trip_id uuid,
  p_student_id uuid,
  p_permission_slip_signed boolean DEFAULT false,
  p_permission_slip_date date DEFAULT NULL,
  p_payment_status text DEFAULT 'pending',
  p_amount_paid numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_part_id UUID;
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

  INSERT INTO public.trip_participants (tenant_id, trip_id, student_id, permission_slip_signed, permission_slip_date, signed_by, payment_status, amount_paid, notes)
  VALUES (v_caller_tenant, p_trip_id, p_student_id, p_permission_slip_signed, p_permission_slip_date, CASE WHEN p_permission_slip_signed THEN (CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END) ELSE NULL END, p_payment_status, p_amount_paid, nullif(btrim(coalesce(p_notes, '')), ''))
  ON CONFLICT (trip_id, student_id) DO UPDATE SET
    permission_slip_signed = EXCLUDED.permission_slip_signed,
    permission_slip_date = EXCLUDED.permission_slip_date,
    signed_by = EXCLUDED.signed_by,
    payment_status = EXCLUDED.payment_status,
    amount_paid = EXCLUDED.amount_paid,
    notes = EXCLUDED.notes
  RETURNING id INTO v_part_id;

  RETURN v_part_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_trip_participants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_trip_participants(p_trip_id uuid)
RETURNS TABLE(
  participant_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  permission_slip_signed boolean,
  permission_slip_date date,
  payment_status text,
  amount_paid numeric,
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
    tp.id AS participant_id,
    tp.student_id,
    s.full_name AS student_name,
    s.admission_no,
    tp.permission_slip_signed,
    tp.permission_slip_date,
    tp.payment_status,
    tp.amount_paid,
    tp.notes
  FROM public.trip_participants tp
  LEFT JOIN public.students s ON s.id = tp.student_id
  WHERE (v_role = 'service_role' OR tp.tenant_id = v_caller_tenant)
    AND tp.trip_id = p_trip_id
  ORDER BY s.full_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: update_trip_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_trip_status(p_trip_id uuid, p_status text, p_actual_cost numeric DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_updated INT;
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

  IF p_status NOT IN ('planned', 'approved', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.trips SET
    status = p_status,
    actual_cost = COALESCE(p_actual_cost, actual_cost),
    approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE approved_by END,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    updated_at = now()
  WHERE id = p_trip_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_trips(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_trip(text, text, date, date, text, text, time, time, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_trip_participant(uuid, uuid, boolean, date, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_trip_participants(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_trip_status(uuid, text, numeric) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_trips(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_trip(text, text, date, date, text, text, time, time, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_trip_participant(uuid, uuid, boolean, date, text, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_trip_participants(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_trip_status(uuid, text, numeric) TO authenticated, service_role;
