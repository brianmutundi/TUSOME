-- TUSOME analytics: Financial Audit Trail
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- P1 prerequisite: "Implement this first because every subsequent
-- financial workflow needs accountability."

-- ---------------------------------------------------------------------------
-- 1. Audit events table (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_values jsonb,
  after_values jsonb,
  reason text,
  correlation_id uuid,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only: prevent updates and deletes
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Audit events are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS audit_events_no_update ON public.audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_tenant_select ON public.audit_events;
CREATE POLICY audit_events_tenant_select ON public.audit_events
  FOR SELECT
  USING (tenant_id = public.my_tenant_id());

-- Only service_role and system can insert (via SECURITY DEFINER functions)
DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_insert ON public.audit_events
  FOR INSERT
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT ON public.audit_events TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. RPC: log_audit_event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_before_values jsonb DEFAULT NULL,
  p_after_values jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_correlation_id uuid DEFAULT NULL
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
  v_event_id UUID;
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

  INSERT INTO public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, before_values, after_values, reason, correlation_id)
  VALUES (v_caller_tenant, v_actor_id, p_action, p_entity_type, p_entity_id, p_before_values, p_after_values, p_reason, p_correlation_id)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_audit_events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_audit_events(
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  event_id uuid,
  actor_id uuid,
  actor_name text,
  action text,
  entity_type text,
  entity_id uuid,
  before_values jsonb,
  after_values jsonb,
  reason text,
  correlation_id uuid,
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
    ae.id AS event_id,
    ae.actor_id,
    p.full_name AS actor_name,
    ae.action,
    ae.entity_type,
    ae.entity_id,
    ae.before_values,
    ae.after_values,
    ae.reason,
    ae.correlation_id,
    ae.created_at
  FROM public.audit_events ae
  LEFT JOIN public.profiles p ON p.id = ae.actor_id
  WHERE (v_role = 'service_role' OR ae.tenant_id = v_caller_tenant)
    AND (p_entity_type IS NULL OR ae.entity_type = p_entity_type)
    AND (p_entity_id IS NULL OR ae.entity_id = p_entity_id)
    AND (p_action IS NULL OR ae.action = p_action)
  ORDER BY ae.created_at DESC
  LIMIT v_limit;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, jsonb, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_audit_events(text, uuid, text, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, jsonb, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_audit_events(text, uuid, text, integer) TO authenticated, service_role;
