-- TUSOME analytics: Zeraki-parity Opportunities
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Opportunities table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  opportunity_type text NOT NULL DEFAULT 'scholarship' CHECK (opportunity_type IN ('scholarship', 'bursary', 'pathway', 'exchange', 'competition', 'other')),
  eligibility_criteria text,
  deadline date,
  application_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunities_tenant ON public.opportunities;
CREATE POLICY opportunities_tenant ON public.opportunities
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Opportunity applications table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunity_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'shortlisted', 'awarded', 'rejected', 'withdrawn')),
  notes text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, student_id)
);

ALTER TABLE public.opportunity_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunity_applications_tenant ON public.opportunity_applications;
CREATE POLICY opportunity_applications_tenant ON public.opportunity_applications
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_applications TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_opportunities
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_opportunities(p_active_only boolean DEFAULT true)
RETURNS TABLE(
  opportunity_id uuid,
  title text,
  description text,
  opportunity_type text,
  eligibility_criteria text,
  deadline date,
  application_url text,
  is_active boolean,
  applicant_count bigint,
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
    o.id AS opportunity_id,
    o.title,
    o.description,
    o.opportunity_type,
    o.eligibility_criteria,
    o.deadline,
    o.application_url,
    o.is_active,
    (SELECT COUNT(*) FROM public.opportunity_applications oa WHERE oa.opportunity_id = o.id) AS applicant_count,
    o.created_at
  FROM public.opportunities o
  WHERE (v_role = 'service_role' OR o.tenant_id = v_caller_tenant)
    AND (NOT p_active_only OR o.is_active = true)
  ORDER BY o.deadline NULLS LAST, o.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_opportunity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_opportunity(
  p_title text,
  p_description text DEFAULT NULL,
  p_opportunity_type text DEFAULT 'scholarship',
  p_eligibility_criteria text DEFAULT NULL,
  p_deadline date DEFAULT NULL,
  p_application_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_opp_id UUID;
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
    RAISE EXCEPTION 'Opportunity title is required';
  END IF;

  INSERT INTO public.opportunities (tenant_id, title, description, opportunity_type, eligibility_criteria, deadline, application_url, created_by)
  VALUES (v_caller_tenant, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), p_opportunity_type, nullif(btrim(coalesce(p_eligibility_criteria, '')), ''), p_deadline, nullif(btrim(coalesce(p_application_url, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_opp_id;

  RETURN v_opp_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: apply_for_opportunity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_for_opportunity(
  p_opportunity_id uuid,
  p_student_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_app_id UUID;
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

  INSERT INTO public.opportunity_applications (tenant_id, opportunity_id, student_id, notes)
  VALUES (v_caller_tenant, p_opportunity_id, p_student_id, nullif(btrim(coalesce(p_notes, '')), ''))
  ON CONFLICT (opportunity_id, student_id) DO UPDATE SET
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_app_id;

  RETURN v_app_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_opportunity_applications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_opportunity_applications(p_opportunity_id uuid DEFAULT NULL)
RETURNS TABLE(
  application_id uuid,
  opportunity_id uuid,
  opportunity_title text,
  student_id uuid,
  student_name text,
  admission_no text,
  status text,
  notes text,
  applied_at timestamptz
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
    oa.id AS application_id,
    oa.opportunity_id,
    o.title AS opportunity_title,
    oa.student_id,
    s.full_name AS student_name,
    s.admission_no,
    oa.status,
    oa.notes,
    oa.applied_at
  FROM public.opportunity_applications oa
  LEFT JOIN public.opportunities o ON o.id = oa.opportunity_id
  LEFT JOIN public.students s ON s.id = oa.student_id
  WHERE (v_role = 'service_role' OR oa.tenant_id = v_caller_tenant)
    AND (p_opportunity_id IS NULL OR oa.opportunity_id = p_opportunity_id)
  ORDER BY oa.applied_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_opportunities(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_opportunity(text, text, text, text, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_for_opportunity(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_opportunity_applications(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_opportunities(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_opportunity(text, text, text, text, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_for_opportunity(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_opportunity_applications(uuid) TO authenticated, service_role;
