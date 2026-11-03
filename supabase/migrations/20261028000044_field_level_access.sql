-- TUSOME analytics: Field-Level Access Controls (Phase 4)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Sensitive field access log table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sensitive_field_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  field_name text NOT NULL,
  access_type text NOT NULL CHECK (access_type IN ('read', 'write', 'export')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sensitive_field_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sensitive_field_access_tenant ON public.sensitive_field_access;
CREATE POLICY sensitive_field_access_tenant ON public.sensitive_field_access
  FOR SELECT
  USING (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT ON public.sensitive_field_access TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. RPC: log_sensitive_field_access
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_sensitive_field_access(
  p_entity_type text,
  p_entity_id uuid,
  p_field_name text,
  p_access_type text DEFAULT 'read'
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_actor_id UUID;
  v_log_id UUID;
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
    v_actor_id := auth.uid();
  ELSE
    v_caller_tenant := (SELECT tenant_id FROM public.tenants LIMIT 1);
    v_actor_id := NULL;
  END IF;

  INSERT INTO public.sensitive_field_access (tenant_id, actor_id, entity_type, entity_id, field_name, access_type)
  VALUES (v_caller_tenant, v_actor_id, p_entity_type, p_entity_id, p_field_name, p_access_type)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_sensitive_field_access_log
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sensitive_field_access_log(
  p_entity_type text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  log_id uuid,
  actor_id uuid,
  actor_name text,
  entity_type text,
  entity_id uuid,
  field_name text,
  access_type text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_limit INT;
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

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000);

  RETURN QUERY
  SELECT
    sfa.id AS log_id,
    sfa.actor_id,
    p.full_name AS actor_name,
    sfa.entity_type,
    sfa.entity_id,
    sfa.field_name,
    sfa.access_type,
    sfa.created_at
  FROM public.sensitive_field_access sfa
  LEFT JOIN public.profiles p ON p.id = sfa.actor_id
  WHERE (v_role = 'service_role' OR sfa.tenant_id = v_caller_tenant)
    AND (p_entity_type IS NULL OR sfa.entity_type = p_entity_type)
  ORDER BY sfa.created_at DESC
  LIMIT v_limit;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.log_sensitive_field_access(text, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sensitive_field_access_log(text, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.log_sensitive_field_access(text, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sensitive_field_access_log(text, integer) TO authenticated, service_role;
