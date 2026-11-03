-- TUSOME analytics: Data Retention Policies (Phase 4)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Data retention policies table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  retention_days integer NOT NULL DEFAULT 365,
  action text NOT NULL DEFAULT 'archive' CHECK (action IN ('archive', 'anonymize', 'delete')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type)
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_retention_policies_tenant ON public.data_retention_policies;
CREATE POLICY data_retention_policies_tenant ON public.data_retention_policies
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_retention_policies TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. RPC: get_data_retention_policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_data_retention_policies()
RETURNS TABLE(
  policy_id uuid,
  entity_type text,
  retention_days integer,
  action text,
  is_active boolean,
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
    drp.id AS policy_id,
    drp.entity_type,
    drp.retention_days,
    drp.action,
    drp.is_active,
    drp.created_at
  FROM public.data_retention_policies drp
  WHERE (v_role = 'service_role' OR drp.tenant_id = v_caller_tenant)
  ORDER BY drp.entity_type;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. RPC: upsert_data_retention_policy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_data_retention_policy(
  p_entity_type text,
  p_retention_days integer,
  p_action text DEFAULT 'archive',
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_policy_id UUID;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-retention') THEN
      RAISE EXCEPTION 'Access denied: manage-retention permission required';
    END IF;
  END IF;

  IF p_retention_days < 1 THEN
    RAISE EXCEPTION 'Retention days must be positive';
  END IF;

  IF p_action NOT IN ('archive', 'anonymize', 'delete') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  INSERT INTO public.data_retention_policies (tenant_id, entity_type, retention_days, action, is_active, created_by)
  VALUES (v_caller_tenant, btrim(p_entity_type), p_retention_days, p_action, p_is_active, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  ON CONFLICT (tenant_id, entity_type) DO UPDATE SET
    retention_days = EXCLUDED.retention_days,
    action = EXCLUDED.action,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_policy_id;

  PERFORM public.log_audit_event('upsert', 'data_retention_policy', v_policy_id, NULL, jsonb_build_object('entity_type', p_entity_type, 'retention_days', p_retention_days, 'action', p_action));

  RETURN v_policy_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_data_retention_policies() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_data_retention_policy(text, integer, text, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_data_retention_policies() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_data_retention_policy(text, integer, text, boolean) TO authenticated, service_role;
