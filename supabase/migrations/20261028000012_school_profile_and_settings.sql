-- TUSOME analytics: School Profile, Term Dates & Report Template Settings
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- 1. School profile (chunk-35JZRRAP.js, chunk-3KBYUFQ5.js):
--      * updateSchool(), getSchoolInfo(), updateSchoolValidityStatus(),
--        updateSchoolPartner(), updateSchoolAccountManager(), updateSchoolAccountOwner()
-- 2. Term dates (chunk-2EH2VPVR.js, chunk-DTRKVYAB.js):
--      * /main/settings/term-dates (permission: "view-term-dates", "edit-term-dates")
-- 3. Printout settings (chunk-2EH2VPVR.js, chunk-DTRKVYAB.js):
--      * /main/settings/printout-settings (permission: "edit-printout-settings")
-- 4. School validity (chunk-DZTHJJJ3.js, chunk-3DB2MD7V.js):
--      * school_validity_info.is_valid_school, subscription.allowAccess

-- ---------------------------------------------------------------------------
-- 1. Extend tenants with school profile & validity fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS school_type text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS education_system text,
  ADD COLUMN IF NOT EXISTS ownership_type text,
  ADD COLUMN IF NOT EXISTS setup_stage text DEFAULT 'Completed',
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS is_valid boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'expired', 'suspended', 'trial')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS watermark_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS motto text;

-- ---------------------------------------------------------------------------
-- 2. get_school_profile: read school profile for the caller's tenant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_school_profile()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_tenant RECORD;
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

  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE v_role = 'service_role' OR t.id = v_caller_tenant;

  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant.id,
    'name', v_tenant.name,
    'school_type', v_tenant.school_type,
    'country', v_tenant.country,
    'region', v_tenant.region,
    'county', v_tenant.county,
    'education_system', v_tenant.education_system,
    'ownership_type', v_tenant.ownership_type,
    'setup_stage', v_tenant.setup_stage,
    'contact_person', v_tenant.contact_person,
    'contact_phone', v_tenant.contact_phone,
    'contact_email', v_tenant.contact_email,
    'is_valid', v_tenant.is_valid,
    'subscription_status', v_tenant.subscription_status,
    'subscription_expires_at', v_tenant.subscription_expires_at,
    'watermark_url', v_tenant.watermark_url,
    'logo_url', v_tenant.logo_url,
    'motto', v_tenant.motto,
    'created_at', v_tenant.created_at
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. update_school_profile: edit school profile (admin only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_school_profile(
  p_name text DEFAULT NULL,
  p_school_type text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_county text DEFAULT NULL,
  p_education_system text DEFAULT NULL,
  p_ownership_type text DEFAULT NULL,
  p_contact_person text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_watermark_url text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_motto text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
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

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'edit-school-profile') THEN
      RAISE EXCEPTION 'Access denied: edit-school-profile permission required';
    END IF;
  END IF;

  UPDATE public.tenants
  SET
    name = COALESCE(nullif(btrim(coalesce(p_name, '')), ''), name),
    school_type = COALESCE(nullif(btrim(coalesce(p_school_type, '')), ''), school_type),
    country = COALESCE(nullif(btrim(coalesce(p_country, '')), ''), country),
    region = COALESCE(nullif(btrim(coalesce(p_region, '')), ''), region),
    county = COALESCE(nullif(btrim(coalesce(p_county, '')), ''), county),
    education_system = COALESCE(nullif(btrim(coalesce(p_education_system, '')), ''), education_system),
    ownership_type = COALESCE(nullif(btrim(coalesce(p_ownership_type, '')), ''), ownership_type),
    contact_person = COALESCE(nullif(btrim(coalesce(p_contact_person, '')), ''), contact_person),
    contact_phone = COALESCE(nullif(btrim(coalesce(p_contact_phone, '')), ''), contact_phone),
    contact_email = COALESCE(nullif(btrim(coalesce(p_contact_email, '')), ''), contact_email),
    watermark_url = COALESCE(nullif(btrim(coalesce(p_watermark_url, '')), ''), watermark_url),
    logo_url = COALESCE(nullif(btrim(coalesce(p_logo_url, '')), ''), logo_url),
    motto = COALESCE(nullif(btrim(coalesce(p_motto, '')), ''), motto)
  WHERE id = v_caller_tenant;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. get_school_validity: subscription/validity status for the caller's school
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_school_validity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_tenant RECORD;
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

  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE v_role = 'service_role' OR t.id = v_caller_tenant;

  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant.id,
    'name', v_tenant.name,
    'is_valid', v_tenant.is_valid,
    'subscription_status', v_tenant.subscription_status,
    'subscription_expires_at', v_tenant.subscription_expires_at,
    'days_remaining', CASE
      WHEN v_tenant.subscription_expires_at IS NULL THEN NULL
      ELSE GREATEST(0, EXTRACT(DAY FROM (v_tenant.subscription_expires_at - now()))::integer)
    END,
    'is_expired', CASE
      WHEN v_tenant.subscription_expires_at IS NULL THEN false
      ELSE v_tenant.subscription_expires_at < now()
    END
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Explicit REVOKE / GRANT (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_school_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_school_profile(text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_school_validity() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_school_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_school_profile(text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_school_validity() TO authenticated, service_role;
