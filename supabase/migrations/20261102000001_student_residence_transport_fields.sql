-- Student residence and transport details.
-- Additive only: existing student data is not backfilled or overwritten.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS residence_type text,
  ADD COLUMN IF NOT EXISTS transport_mode text,
  ADD COLUMN IF NOT EXISTS transport_route_id uuid,
  ADD COLUMN IF NOT EXISTS other_transport_details text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_residence_type_check') THEN
    ALTER TABLE public.students ADD CONSTRAINT students_residence_type_check
      CHECK (residence_type IS NULL OR residence_type IN ('day_scholar', 'boarder'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_transport_mode_check') THEN
    ALTER TABLE public.students ADD CONSTRAINT students_transport_mode_check
      CHECK (transport_mode IS NULL OR transport_mode IN ('school_transport', 'parent_guardian', 'public_transport', 'walking', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_residence_transport_consistency_check') THEN
    ALTER TABLE public.students ADD CONSTRAINT students_residence_transport_consistency_check
      CHECK (
        (residence_type IS DISTINCT FROM 'boarder' OR (transport_mode IS NULL AND transport_route_id IS NULL AND other_transport_details IS NULL))
        AND (transport_mode IS DISTINCT FROM 'school_transport' OR (residence_type = 'day_scholar' AND transport_route_id IS NOT NULL))
        AND (transport_mode IS DISTINCT FROM 'other' OR nullif(btrim(other_transport_details), '') IS NOT NULL)
      );
  END IF;
END $$;

-- Composite FK requires a matching unique key on routes; add it without altering route data.
CREATE UNIQUE INDEX IF NOT EXISTS transport_routes_id_tenant_uidx
  ON public.transport_routes (id, tenant_id);

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_transport_route_tenant_fk') THEN
    ALTER TABLE public.students ADD CONSTRAINT students_transport_route_tenant_fk
      FOREIGN KEY (transport_route_id, tenant_id)
      REFERENCES public.transport_routes (id, tenant_id) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_student_residence_transport(p_student_id uuid DEFAULT NULL)
RETURNS TABLE (
  student_id uuid,
  residence_type text,
  transport_mode text,
  transport_route_id uuid,
  transport_route_name text,
  other_transport_details text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $function$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.my_tenant_id();
  IF v_tenant IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  RETURN QUERY
  SELECT s.id, s.residence_type, s.transport_mode, s.transport_route_id,
         tr.name, s.other_transport_details
  FROM public.students s
  LEFT JOIN public.transport_routes tr
    ON tr.id = s.transport_route_id AND tr.tenant_id = s.tenant_id
  WHERE (auth.role() = 'service_role' OR s.tenant_id = v_tenant)
    AND (p_student_id IS NULL OR s.id = p_student_id)
  ORDER BY s.full_name, s.admission_no;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_student_residence_transport(
  p_student_id uuid,
  p_residence_type text,
  p_transport_mode text DEFAULT NULL,
  p_transport_route_id uuid DEFAULT NULL,
  p_other_transport_details text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
AS $function$
DECLARE
  v_tenant uuid;
  v_role text;
  v_route_tenant uuid;
BEGIN
  v_tenant := public.my_tenant_id();
  v_role := auth.role();

  IF v_tenant IS NULL AND v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;
  IF v_role IS DISTINCT FROM 'service_role'
     AND NOT public.user_has_permission(auth.uid(), v_tenant, 'edit-student-profile') THEN
    RAISE EXCEPTION 'Access denied: edit-student-profile permission required';
  END IF;
  IF p_residence_type NOT IN ('day_scholar', 'boarder') THEN
    RAISE EXCEPTION 'Invalid residence type';
  END IF;
  IF p_residence_type = 'boarder' THEN
    IF p_transport_mode IS NOT NULL OR p_transport_route_id IS NOT NULL OR nullif(btrim(coalesce(p_other_transport_details, '')), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Boarders cannot have day-scholar transport details';
    END IF;
  ELSE
    IF p_transport_mode NOT IN ('school_transport', 'parent_guardian', 'public_transport', 'walking', 'other') THEN
      RAISE EXCEPTION 'A valid transport mode is required for day scholars';
    END IF;
    IF p_transport_mode = 'school_transport' THEN
      IF p_transport_route_id IS NULL THEN RAISE EXCEPTION 'Select an existing school transport route'; END IF;
      SELECT tenant_id INTO v_route_tenant FROM public.transport_routes
      WHERE id = p_transport_route_id AND is_active = true;
      IF v_route_tenant IS NULL OR (v_role IS DISTINCT FROM 'service_role' AND v_route_tenant <> v_tenant) THEN
        RAISE EXCEPTION 'Transport route is not active in this school';
      END IF;
    ELSIF p_transport_route_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only school transport can use a route';
    END IF;
    IF p_transport_mode = 'other' AND nullif(btrim(coalesce(p_other_transport_details, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Enter the other transport details';
    END IF;
  END IF;

  UPDATE public.students
  SET residence_type = p_residence_type,
      transport_mode = CASE WHEN p_residence_type = 'boarder' THEN NULL ELSE p_transport_mode END,
      transport_route_id = CASE WHEN p_residence_type = 'boarder' THEN NULL ELSE p_transport_route_id END,
      other_transport_details = CASE WHEN p_residence_type = 'boarder' THEN NULL
        WHEN p_transport_mode = 'other' THEN nullif(btrim(p_other_transport_details), '') ELSE NULL END,
      boarding_status = CASE WHEN p_residence_type = 'boarder' THEN 'Boarding' ELSE 'Day' END
  WHERE id = p_student_id
    AND (v_role = 'service_role' OR tenant_id = v_tenant);

  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found in your school'; END IF;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_student_residence_transport(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_residence_transport(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_student_residence_transport(uuid, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_student_residence_transport(uuid, text, text, uuid, text) TO authenticated, service_role;
