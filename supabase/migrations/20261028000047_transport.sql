-- TUSOME analytics: Transport Management (Phase 5)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Vehicles table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  registration_number text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'bus' CHECK (vehicle_type IN ('bus', 'van', 'car', 'motorcycle', 'other')),
  capacity integer NOT NULL DEFAULT 0,
  make text,
  model text,
  year integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, registration_number)
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicles_tenant ON public.vehicles;
CREATE POLICY vehicles_tenant ON public.vehicles
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Transport routes table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  vehicle_id uuid REFERENCES public.vehicles (id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  pickup_points text,
  departure_time time,
  return_time time,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transport_routes_tenant ON public.transport_routes;
CREATE POLICY transport_routes_tenant ON public.transport_routes
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_routes TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Student transport assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_transport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes (id) ON DELETE CASCADE,
  pickup_point text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, route_id)
);

ALTER TABLE public.student_transport ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_transport_tenant ON public.student_transport;
CREATE POLICY student_transport_tenant ON public.student_transport
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_transport TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC: get_vehicles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vehicles()
RETURNS TABLE(
  vehicle_id uuid,
  registration_number text,
  vehicle_type text,
  capacity integer,
  make text,
  model text,
  year integer,
  is_active boolean
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
    v.id AS vehicle_id,
    v.registration_number,
    v.vehicle_type,
    v.capacity,
    v.make,
    v.model,
    v.year,
    v.is_active
  FROM public.vehicles v
  WHERE (v_role = 'service_role' OR v.tenant_id = v_caller_tenant)
  ORDER BY v.registration_number;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: add_vehicle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_vehicle(
  p_registration_number text,
  p_vehicle_type text DEFAULT 'bus',
  p_capacity integer DEFAULT 0,
  p_make text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_year integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_vehicle_id UUID;
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

  IF btrim(coalesce(p_registration_number, '')) = '' THEN
    RAISE EXCEPTION 'Registration number is required';
  END IF;

  INSERT INTO public.vehicles (tenant_id, registration_number, vehicle_type, capacity, make, model, year)
  VALUES (v_caller_tenant, btrim(p_registration_number), p_vehicle_type, p_capacity, nullif(btrim(coalesce(p_make, '')), ''), nullif(btrim(coalesce(p_model, '')), ''), p_year)
  RETURNING id INTO v_vehicle_id;

  RETURN v_vehicle_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_transport_routes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_transport_routes()
RETURNS TABLE(
  route_id uuid,
  name text,
  description text,
  vehicle_id uuid,
  registration_number text,
  driver_id uuid,
  driver_name text,
  pickup_points text,
  departure_time time,
  return_time time,
  is_active boolean,
  student_count bigint
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
    tr.id AS route_id,
    tr.name,
    tr.description,
    tr.vehicle_id,
    v.registration_number,
    tr.driver_id,
    p.full_name AS driver_name,
    tr.pickup_points,
    tr.departure_time,
    tr.return_time,
    tr.is_active,
    (SELECT COUNT(*) FROM public.student_transport st WHERE st.route_id = tr.id AND st.is_active = true) AS student_count
  FROM public.transport_routes tr
  LEFT JOIN public.vehicles v ON v.id = tr.vehicle_id
  LEFT JOIN public.profiles p ON p.id = tr.driver_id
  WHERE (v_role = 'service_role' OR tr.tenant_id = v_caller_tenant)
  ORDER BY tr.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: create_transport_route
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_transport_route(
  p_name text,
  p_description text DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL,
  p_driver_id uuid DEFAULT NULL,
  p_pickup_points text DEFAULT NULL,
  p_departure_time time DEFAULT NULL,
  p_return_time time DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_route_id UUID;
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

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Route name is required';
  END IF;

  INSERT INTO public.transport_routes (tenant_id, name, description, vehicle_id, driver_id, pickup_points, departure_time, return_time)
  VALUES (v_caller_tenant, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_vehicle_id, p_driver_id, nullif(btrim(coalesce(p_pickup_points, '')), ''), p_departure_time, p_return_time)
  RETURNING id INTO v_route_id;

  RETURN v_route_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: assign_student_transport
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_student_transport(
  p_student_id uuid,
  p_route_id uuid,
  p_pickup_point text DEFAULT NULL
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

  INSERT INTO public.student_transport (tenant_id, student_id, route_id, pickup_point)
  VALUES (v_caller_tenant, p_student_id, p_route_id, nullif(btrim(coalesce(p_pickup_point, '')), ''))
  ON CONFLICT (student_id, route_id) DO UPDATE SET
    pickup_point = EXCLUDED.pickup_point,
    is_active = true
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: get_student_transport
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_transport(p_student_id uuid DEFAULT NULL)
RETURNS TABLE(
  assignment_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  route_id uuid,
  route_name text,
  pickup_point text,
  is_active boolean
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
    st.id AS assignment_id,
    st.student_id,
    s.full_name AS student_name,
    s.admission_no,
    st.route_id,
    tr.name AS route_name,
    st.pickup_point,
    st.is_active
  FROM public.student_transport st
  LEFT JOIN public.students s ON s.id = st.student_id
  LEFT JOIN public.transport_routes tr ON tr.id = st.route_id
  WHERE (v_role = 'service_role' OR st.tenant_id = v_caller_tenant)
    AND (p_student_id IS NULL OR st.student_id = p_student_id)
  ORDER BY s.full_name, tr.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_vehicles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_vehicle(text, text, integer, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_transport_routes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_transport_route(text, text, uuid, uuid, text, time, time) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_student_transport(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_transport(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_vehicles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_vehicle(text, text, integer, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_transport_routes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_transport_route(text, text, uuid, uuid, text, time, time) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_student_transport(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_transport(uuid) TO authenticated, service_role;
