-- TUSOME analytics: Zeraki-parity Medical
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Medical visits table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students (id) ON DELETE SET NULL,
  visit_date timestamptz NOT NULL DEFAULT now(),
  complaint text,
  diagnosis text,
  treatment text,
  referred_to text,
  attended_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('scheduled', 'completed', 'referred', 'follow_up')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_visits_tenant ON public.medical_visits;
CREATE POLICY medical_visits_tenant ON public.medical_visits
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_visits TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Medical inventory table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text DEFAULT 'Medication',
  quantity integer NOT NULL DEFAULT 0,
  unit text DEFAULT 'units',
  expiry_date date,
  supplier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_inventory_tenant ON public.medical_inventory;
CREATE POLICY medical_inventory_tenant ON public.medical_inventory
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_inventory TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_medical_visits
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_medical_visits(p_student_id uuid DEFAULT NULL)
RETURNS TABLE(
  visit_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  visit_date timestamptz,
  complaint text,
  diagnosis text,
  treatment text,
  referred_to text,
  attended_by_name text,
  status text,
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
    mv.id AS visit_id,
    mv.student_id,
    s.full_name AS student_name,
    s.admission_no,
    mv.visit_date,
    mv.complaint,
    mv.diagnosis,
    mv.treatment,
    mv.referred_to,
    p.full_name AS attended_by_name,
    mv.status,
    mv.notes
  FROM public.medical_visits mv
  LEFT JOIN public.students s ON s.id = mv.student_id
  LEFT JOIN public.profiles p ON p.id = mv.attended_by
  WHERE (v_role = 'service_role' OR mv.tenant_id = v_caller_tenant)
    AND (p_student_id IS NULL OR mv.student_id = p_student_id)
  ORDER BY mv.visit_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_medical_visit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_medical_visit(
  p_student_id uuid DEFAULT NULL,
  p_complaint text DEFAULT NULL,
  p_diagnosis text DEFAULT NULL,
  p_treatment text DEFAULT NULL,
  p_referred_to text DEFAULT NULL,
  p_status text DEFAULT 'completed',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_visit_id UUID;
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

  INSERT INTO public.medical_visits (tenant_id, student_id, complaint, diagnosis, treatment, referred_to, attended_by, status, notes)
  VALUES (v_caller_tenant, p_student_id, nullif(btrim(coalesce(p_complaint, '')), ''), nullif(btrim(coalesce(p_diagnosis, '')), ''), nullif(btrim(coalesce(p_treatment, '')), ''), nullif(btrim(coalesce(p_referred_to, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END, p_status, nullif(btrim(coalesce(p_notes, '')), ''))
  RETURNING id INTO v_visit_id;

  RETURN v_visit_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_medical_inventory
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_medical_inventory()
RETURNS TABLE(
  item_id uuid,
  item_name text,
  category text,
  quantity integer,
  unit text,
  expiry_date date,
  supplier text
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
    mi.id AS item_id,
    mi.item_name,
    mi.category,
    mi.quantity,
    mi.unit,
    mi.expiry_date,
    mi.supplier
  FROM public.medical_inventory mi
  WHERE (v_role = 'service_role' OR mi.tenant_id = v_caller_tenant)
  ORDER BY mi.item_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_medical_visits(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_medical_visit(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_medical_inventory() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_medical_visits(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_medical_visit(uuid, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_medical_inventory() TO authenticated, service_role;
