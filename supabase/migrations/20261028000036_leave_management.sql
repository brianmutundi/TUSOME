-- TUSOME analytics: Leave Management
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Leave types table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  max_days_per_year integer,
  is_paid boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_types_tenant ON public.leave_types;
CREATE POLICY leave_types_tenant ON public.leave_types
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Leave requests table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types (id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (days_requested > 0)
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_requests_tenant ON public.leave_requests;
CREATE POLICY leave_requests_tenant ON public.leave_requests
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.leave_requests TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_leave_types
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leave_types()
RETURNS TABLE(
  leave_type_id uuid,
  name text,
  description text,
  max_days_per_year integer,
  is_paid boolean,
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
    lt.id AS leave_type_id,
    lt.name,
    lt.description,
    lt.max_days_per_year,
    lt.is_paid,
    lt.is_active
  FROM public.leave_types lt
  WHERE (v_role = 'service_role' OR lt.tenant_id = v_caller_tenant)
  ORDER BY lt.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_leave_type
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_leave_type(
  p_name text,
  p_description text DEFAULT NULL,
  p_max_days_per_year integer DEFAULT NULL,
  p_is_paid boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_lt_id UUID;
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
    RAISE EXCEPTION 'Leave type name is required';
  END IF;

  INSERT INTO public.leave_types (tenant_id, name, description, max_days_per_year, is_paid)
  VALUES (v_caller_tenant, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_max_days_per_year, p_is_paid)
  RETURNING id INTO v_lt_id;

  RETURN v_lt_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: submit_leave_request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_leave_request(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_staff_id UUID;
  v_days INT;
  v_request_id UUID;
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

  v_staff_id := auth.uid();
  v_days := (p_end_date - p_start_date + 1);

  IF v_days <= 0 THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  INSERT INTO public.leave_requests (tenant_id, staff_id, leave_type_id, start_date, end_date, days_requested, reason)
  VALUES (v_caller_tenant, v_staff_id, p_leave_type_id, p_start_date, p_end_date, v_days, nullif(btrim(coalesce(p_reason, '')), ''))
  RETURNING id INTO v_request_id;

  PERFORM public.log_audit_event('submit', 'leave_request', v_request_id, NULL, jsonb_build_object('leave_type_id', p_leave_type_id, 'start_date', p_start_date, 'end_date', p_end_date, 'days', v_days));

  RETURN v_request_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: approve_leave_request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_leave_request(
  p_request_id uuid,
  p_review_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_request RECORD;
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

  -- Check permission
  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'approve-leave') THEN
      RAISE EXCEPTION 'Access denied: approve-leave permission required';
    END IF;
  END IF;

  SELECT * INTO v_request
  FROM public.leave_requests
  WHERE id = p_request_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Leave request is not pending (current status: %)', v_request.status;
  END IF;

  -- Separation of duties
  IF v_request.staff_id = auth.uid() AND v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Cannot approve your own leave request';
  END IF;

  UPDATE public.leave_requests SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE id = p_request_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Leave approval failed (concurrent modification?)';
  END IF;

  PERFORM public.log_audit_event('approve', 'leave_request', p_request_id, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'approved'));

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: reject_leave_request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_leave_request(
  p_request_id uuid,
  p_rejection_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_request RECORD;
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

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'approve-leave') THEN
      RAISE EXCEPTION 'Access denied: approve-leave permission required';
    END IF;
  END IF;

  SELECT * INTO v_request
  FROM public.leave_requests
  WHERE id = p_request_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Leave request is not pending (current status: %)', v_request.status;
  END IF;

  UPDATE public.leave_requests SET
    status = 'rejected',
    approved_by = auth.uid(),
    approved_at = now(),
    rejection_reason = nullif(btrim(coalesce(p_rejection_reason, '')), ''),
    updated_at = now()
  WHERE id = p_request_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Leave rejection failed (concurrent modification?)';
  END IF;

  PERFORM public.log_audit_event('reject', 'leave_request', p_request_id, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'rejected'), p_rejection_reason);

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_leave_requests
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leave_requests(p_status text DEFAULT NULL, p_staff_id uuid DEFAULT NULL)
RETURNS TABLE(
  request_id uuid,
  staff_id uuid,
  staff_name text,
  leave_type_id uuid,
  leave_type_name text,
  start_date date,
  end_date date,
  days_requested integer,
  reason text,
  status text,
  approved_by_name text,
  approved_at timestamptz,
  rejection_reason text,
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
    lr.id AS request_id,
    lr.staff_id,
    p.full_name AS staff_name,
    lr.leave_type_id,
    lt.name AS leave_type_name,
    lr.start_date,
    lr.end_date,
    lr.days_requested,
    lr.reason,
    lr.status,
    ap.full_name AS approved_by_name,
    lr.approved_at,
    lr.rejection_reason,
    lr.created_at
  FROM public.leave_requests lr
  JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  LEFT JOIN public.profiles p ON p.id = lr.staff_id
  LEFT JOIN public.profiles ap ON ap.id = lr.approved_by
  WHERE (v_role = 'service_role' OR lr.tenant_id = v_caller_tenant)
    AND (p_status IS NULL OR lr.status = p_status)
    AND (p_staff_id IS NULL OR lr.staff_id = p_staff_id)
  ORDER BY lr.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_leave_types() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_leave_type(text, text, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_leave_request(uuid, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_leave_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_leave_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_leave_requests(text, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_leave_types() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_leave_type(text, text, integer, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_leave_request(uuid, date, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_leave_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_leave_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_leave_requests(text, uuid) TO authenticated, service_role;
