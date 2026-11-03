-- TUSOME analytics: Emergency Contacts & Medical Alerts
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Emergency contacts table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text NOT NULL,
  phone_primary text NOT NULL,
  phone_secondary text,
  email text,
  is_primary boolean NOT NULL DEFAULT false,
  is_authorized_pickup boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_contacts_tenant ON public.emergency_contacts;
CREATE POLICY emergency_contacts_tenant ON public.emergency_contacts
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Medical alerts table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('allergy', 'chronic_condition', 'medication', 'disability', 'special_needs', 'other')),
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_alerts_tenant ON public.medical_alerts;
CREATE POLICY medical_alerts_tenant ON public.medical_alerts
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_alerts TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_emergency_contacts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_emergency_contacts(p_student_id uuid)
RETURNS TABLE(
  contact_id uuid,
  student_id uuid,
  full_name text,
  relationship text,
  phone_primary text,
  phone_secondary text,
  email text,
  is_primary boolean,
  is_authorized_pickup boolean,
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
    ec.id AS contact_id,
    ec.student_id,
    ec.full_name,
    ec.relationship,
    ec.phone_primary,
    ec.phone_secondary,
    ec.email,
    ec.is_primary,
    ec.is_authorized_pickup,
    ec.notes
  FROM public.emergency_contacts ec
  WHERE (v_role = 'service_role' OR ec.tenant_id = v_caller_tenant)
    AND ec.student_id = p_student_id
  ORDER BY ec.is_primary DESC, ec.full_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: upsert_emergency_contact
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_emergency_contact(
  p_student_id uuid,
  p_full_name text,
  p_relationship text,
  p_phone_primary text,
  p_phone_secondary text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_is_primary boolean DEFAULT false,
  p_is_authorized_pickup boolean DEFAULT false,
  p_notes text DEFAULT NULL,
  p_contact_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_contact_id UUID;
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

  IF btrim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Contact name is required';
  END IF;

  IF btrim(coalesce(p_phone_primary, '')) = '' THEN
    RAISE EXCEPTION 'Primary phone is required';
  END IF;

  IF p_contact_id IS NOT NULL THEN
    UPDATE public.emergency_contacts SET
      full_name = btrim(p_full_name),
      relationship = btrim(p_relationship),
      phone_primary = btrim(p_phone_primary),
      phone_secondary = nullif(btrim(coalesce(p_phone_secondary, '')), ''),
      email = nullif(btrim(coalesce(p_email, '')), ''),
      is_primary = p_is_primary,
      is_authorized_pickup = p_is_authorized_pickup,
      notes = nullif(btrim(coalesce(p_notes, '')), '')
    WHERE id = p_contact_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_contact_id;
  ELSE
    INSERT INTO public.emergency_contacts (tenant_id, student_id, full_name, relationship, phone_primary, phone_secondary, email, is_primary, is_authorized_pickup, notes)
    VALUES (v_caller_tenant, p_student_id, btrim(p_full_name), btrim(p_relationship), btrim(p_phone_primary), nullif(btrim(coalesce(p_phone_secondary, '')), ''), nullif(btrim(coalesce(p_email, '')), ''), p_is_primary, p_is_authorized_pickup, nullif(btrim(coalesce(p_notes, '')), ''))
    RETURNING id INTO v_contact_id;
  END IF;

  RETURN v_contact_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_medical_alerts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_medical_alerts(p_student_id uuid)
RETURNS TABLE(
  alert_id uuid,
  student_id uuid,
  alert_type text,
  description text,
  severity text,
  instructions text,
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
    ma.id AS alert_id,
    ma.student_id,
    ma.alert_type,
    ma.description,
    ma.severity,
    ma.instructions,
    ma.is_active,
    ma.created_at
  FROM public.medical_alerts ma
  WHERE (v_role = 'service_role' OR ma.tenant_id = v_caller_tenant)
    AND ma.student_id = p_student_id
  ORDER BY
    CASE ma.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
    ma.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: upsert_medical_alert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_medical_alert(
  p_student_id uuid,
  p_alert_type text,
  p_description text,
  p_severity text DEFAULT 'medium',
  p_instructions text DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_alert_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_alert_id UUID;
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

  IF btrim(coalesce(p_description, '')) = '' THEN
    RAISE EXCEPTION 'Alert description is required';
  END IF;

  IF p_alert_id IS NOT NULL THEN
    UPDATE public.medical_alerts SET
      alert_type = p_alert_type,
      description = btrim(p_description),
      severity = p_severity,
      instructions = nullif(btrim(coalesce(p_instructions, '')), ''),
      is_active = p_is_active,
      updated_at = now()
    WHERE id = p_alert_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_alert_id;
  ELSE
    INSERT INTO public.medical_alerts (tenant_id, student_id, alert_type, description, severity, instructions, is_active, created_by)
    VALUES (v_caller_tenant, p_student_id, p_alert_type, btrim(p_description), p_severity, nullif(btrim(coalesce(p_instructions, '')), ''), p_is_active, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
    RETURNING id INTO v_alert_id;
  END IF;

  RETURN v_alert_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_emergency_contacts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_emergency_contact(uuid, text, text, text, text, text, boolean, boolean, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_medical_alerts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_medical_alert(uuid, text, text, text, text, boolean, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_emergency_contacts(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_emergency_contact(uuid, text, text, text, text, text, boolean, boolean, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_medical_alerts(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_medical_alert(uuid, text, text, text, text, boolean, uuid) TO authenticated, service_role;
