-- TUSOME analytics: Fiscal-Period Locking (P7)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Fiscal periods table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
  closed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  closed_at timestamptz,
  close_reason text,
  reopened_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_periods_tenant ON public.fiscal_periods;
CREATE POLICY fiscal_periods_tenant ON public.fiscal_periods
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.fiscal_periods TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Function: check if a date falls in a locked period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_period_locked(p_date date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_locked BOOLEAN;
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
      RETURN false;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.fiscal_periods fp
    WHERE (v_role = 'service_role' OR fp.tenant_id = v_caller_tenant)
      AND fp.status IN ('closed', 'locked')
      AND p_date BETWEEN fp.start_date AND fp.end_date
  ) INTO v_locked;

  RETURN COALESCE(v_locked, false);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. RPC: create_fiscal_period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_fiscal_period(
  p_name text,
  p_start_date date,
  p_end_date date
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_period_id UUID;
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

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  INSERT INTO public.fiscal_periods (tenant_id, name, start_date, end_date, status)
  VALUES (v_caller_tenant, btrim(p_name), p_start_date, p_end_date, 'open')
  RETURNING id INTO v_period_id;

  PERFORM public.log_audit_event('create', 'fiscal_period', v_period_id, NULL, jsonb_build_object('name', p_name, 'start_date', p_start_date, 'end_date', p_end_date));

  RETURN v_period_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: close_fiscal_period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_fiscal_period(
  p_period_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_period RECORD;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'close-fiscal-period') THEN
      RAISE EXCEPTION 'Access denied: close-fiscal-period permission required';
    END IF;
  END IF;

  SELECT * INTO v_period
  FROM public.fiscal_periods
  WHERE id = p_period_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Fiscal period not found';
  END IF;

  IF v_period.status != 'open' THEN
    RAISE EXCEPTION 'Period is not open (current status: %)', v_period.status;
  END IF;

  UPDATE public.fiscal_periods SET
    status = 'closed',
    closed_by = auth.uid(),
    closed_at = now(),
    close_reason = nullif(btrim(coalesce(p_reason, '')), '')
  WHERE id = p_period_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Period close failed (concurrent modification?)';
  END IF;

  PERFORM public.log_audit_event('close', 'fiscal_period', p_period_id, jsonb_build_object('status', 'open'), jsonb_build_object('status', 'closed'), p_reason);

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: reopen_fiscal_period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reopen_fiscal_period(
  p_period_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_period RECORD;
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

  IF btrim(coalesce(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Reopen reason is required';
  END IF;

  -- Check permission (more restrictive)
  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'reopen-fiscal-period') THEN
      RAISE EXCEPTION 'Access denied: reopen-fiscal-period permission required';
    END IF;
  END IF;

  SELECT * INTO v_period
  FROM public.fiscal_periods
  WHERE id = p_period_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Fiscal period not found';
  END IF;

  IF v_period.status = 'open' THEN
    RAISE EXCEPTION 'Period is already open';
  END IF;

  UPDATE public.fiscal_periods SET
    status = 'open',
    reopened_by = auth.uid(),
    reopened_at = now(),
    reopen_reason = btrim(p_reason),
    updated_at = now()
  WHERE id = p_period_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Period reopen failed (concurrent modification?)';
  END IF;

  PERFORM public.log_audit_event('reopen', 'fiscal_period', p_period_id, jsonb_build_object('status', v_period.status), jsonb_build_object('status', 'open'), p_reason);

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_fiscal_periods
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fiscal_periods()
RETURNS TABLE(
  period_id uuid,
  name text,
  start_date date,
  end_date date,
  status text,
  closed_by_name text,
  closed_at timestamptz,
  close_reason text,
  reopened_by_name text,
  reopened_at timestamptz,
  reopen_reason text
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
    fp.id AS period_id,
    fp.name,
    fp.start_date,
    fp.end_date,
    fp.status,
    p1.full_name AS closed_by_name,
    fp.closed_at,
    fp.close_reason,
    p2.full_name AS reopened_by_name,
    fp.reopened_at,
    fp.reopen_reason
  FROM public.fiscal_periods fp
  LEFT JOIN public.profiles p1 ON p1.id = fp.closed_by
  LEFT JOIN public.profiles p2 ON p2.id = fp.reopened_by
  WHERE (v_role = 'service_role' OR fp.tenant_id = v_caller_tenant)
  ORDER BY fp.start_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_period_locked(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_fiscal_period(text, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_fiscal_period(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_fiscal_period(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fiscal_periods() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_period_locked(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_fiscal_period(text, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_fiscal_period(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_fiscal_period(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fiscal_periods() TO authenticated, service_role;
