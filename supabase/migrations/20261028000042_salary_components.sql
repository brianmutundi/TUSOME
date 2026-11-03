-- TUSOME analytics: Salary Components & Employee Salary Assignment
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. RPC: get_salary_components
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_salary_components()
RETURNS TABLE(
  component_id uuid,
  name text,
  component_type text,
  calculation_type text,
  default_amount numeric,
  percentage_rate numeric,
  is_taxable boolean,
  is_pensionable boolean,
  statutory_type text,
  effective_from date,
  effective_to date,
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
    sc.id AS component_id,
    sc.name,
    sc.component_type,
    sc.calculation_type,
    sc.default_amount,
    sc.percentage_rate,
    sc.is_taxable,
    sc.is_pensionable,
    sc.statutory_type,
    sc.effective_from,
    sc.effective_to,
    sc.is_active
  FROM public.salary_components sc
  WHERE (v_role = 'service_role' OR sc.tenant_id = v_caller_tenant)
  ORDER BY sc.component_type, sc.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. RPC: upsert_salary_component
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_salary_component(
  p_name text,
  p_component_type text,
  p_calculation_type text DEFAULT 'fixed',
  p_default_amount numeric DEFAULT NULL,
  p_percentage_rate numeric DEFAULT NULL,
  p_is_taxable boolean DEFAULT true,
  p_is_pensionable boolean DEFAULT true,
  p_statutory_type text DEFAULT 'none',
  p_effective_from date DEFAULT CURRENT_DATE,
  p_effective_to date DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_component_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_comp_id UUID;
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
    RAISE EXCEPTION 'Component name is required';
  END IF;

  IF p_component_type NOT IN ('earning', 'deduction', 'employer_contribution') THEN
    RAISE EXCEPTION 'Invalid component type';
  END IF;

  IF p_component_id IS NOT NULL THEN
    UPDATE public.salary_components SET
      name = btrim(p_name),
      component_type = p_component_type,
      calculation_type = p_calculation_type,
      default_amount = p_default_amount,
      percentage_rate = p_percentage_rate,
      is_taxable = p_is_taxable,
      is_pensionable = p_is_pensionable,
      statutory_type = p_statutory_type,
      effective_from = p_effective_from,
      effective_to = p_effective_to,
      is_active = p_is_active
    WHERE id = p_component_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_comp_id;
  ELSE
    INSERT INTO public.salary_components (tenant_id, name, component_type, calculation_type, default_amount, percentage_rate, is_taxable, is_pensionable, statutory_type, effective_from, effective_to, is_active)
    VALUES (v_caller_tenant, btrim(p_name), p_component_type, p_calculation_type, p_default_amount, p_percentage_rate, p_is_taxable, p_is_pensionable, p_statutory_type, p_effective_from, p_effective_to, p_is_active)
    RETURNING id INTO v_comp_id;
  END IF;

  RETURN v_comp_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_employee_salaries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_employee_salaries(p_staff_id uuid DEFAULT NULL)
RETURNS TABLE(
  salary_id uuid,
  staff_id uuid,
  staff_name text,
  basic_salary numeric,
  effective_from date,
  effective_to date,
  is_active boolean,
  component_count bigint
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
    es.id AS salary_id,
    es.staff_id,
    p.full_name AS staff_name,
    es.basic_salary,
    es.effective_from,
    es.effective_to,
    es.is_active,
    (SELECT COUNT(*) FROM public.employee_salary_components esc WHERE esc.employee_salary_id = es.id) AS component_count
  FROM public.employee_salaries es
  LEFT JOIN public.profiles p ON p.id = es.staff_id
  WHERE (v_role = 'service_role' OR es.tenant_id = v_caller_tenant)
    AND (p_staff_id IS NULL OR es.staff_id = p_staff_id)
  ORDER BY p.full_name, es.effective_from DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: upsert_employee_salary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_employee_salary(
  p_staff_id uuid,
  p_basic_salary numeric,
  p_effective_from date DEFAULT CURRENT_DATE,
  p_effective_to date DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_salary_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_salary_id UUID;
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

  IF p_basic_salary < 0 THEN
    RAISE EXCEPTION 'Basic salary cannot be negative';
  END IF;

  IF p_salary_id IS NOT NULL THEN
    UPDATE public.employee_salaries SET
      basic_salary = p_basic_salary,
      effective_from = p_effective_from,
      effective_to = p_effective_to,
      is_active = p_is_active,
      updated_at = now()
    WHERE id = p_salary_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_salary_id;
  ELSE
    INSERT INTO public.employee_salaries (tenant_id, staff_id, basic_salary, effective_from, effective_to, is_active, created_by)
    VALUES (v_caller_tenant, p_staff_id, p_basic_salary, p_effective_from, p_effective_to, p_is_active, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
    RETURNING id INTO v_salary_id;
  END IF;

  RETURN v_salary_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: upsert_employee_salary_component
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_employee_salary_component(
  p_employee_salary_id uuid,
  p_component_id uuid,
  p_amount numeric,
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_esc_id UUID;
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

  INSERT INTO public.employee_salary_components (tenant_id, employee_salary_id, component_id, amount, is_active)
  VALUES (v_caller_tenant, p_employee_salary_id, p_component_id, p_amount, p_is_active)
  ON CONFLICT (employee_salary_id, component_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    is_active = EXCLUDED.is_active
  RETURNING id INTO v_esc_id;

  RETURN v_esc_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_salary_components() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_salary_component(text, text, text, numeric, numeric, boolean, boolean, text, date, date, boolean, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_employee_salaries(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_employee_salary(uuid, numeric, date, date, boolean, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_employee_salary_component(uuid, uuid, numeric, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_salary_components() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_salary_component(text, text, text, numeric, numeric, boolean, boolean, text, date, date, boolean, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_salaries(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_employee_salary(uuid, numeric, date, date, boolean, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_employee_salary_component(uuid, uuid, numeric, boolean) TO authenticated, service_role;
