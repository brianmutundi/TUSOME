-- TUSOME analytics: Payroll Foundation (Phase 3E-F)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Salary components table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salary_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  component_type text NOT NULL CHECK (component_type IN ('earning', 'deduction', 'employer_contribution')),
  calculation_type text NOT NULL DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'formula')),
  default_amount numeric,
  percentage_rate numeric,
  is_taxable boolean NOT NULL DEFAULT true,
  is_pensionable boolean NOT NULL DEFAULT true,
  statutory_type text CHECK (statutory_type IN ('paye', 'nssf', 'sha', 'ahl', 'none')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salary_components_tenant ON public.salary_components;
CREATE POLICY salary_components_tenant ON public.salary_components
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_components TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Employee salary assignments table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  basic_salary numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_salaries_tenant ON public.employee_salaries;
CREATE POLICY employee_salaries_tenant ON public.employee_salaries
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.employee_salaries TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Employee salary component overrides
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_salary_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  employee_salary_id uuid NOT NULL REFERENCES public.employee_salaries (id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.salary_components (id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_salary_id, component_id)
);

ALTER TABLE public.employee_salary_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_salary_components_tenant ON public.employee_salary_components;
CREATE POLICY employee_salary_components_tenant ON public.employee_salary_components
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_salary_components TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Payroll periods table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'finalized')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_periods_tenant ON public.payroll_periods;
CREATE POLICY payroll_periods_tenant ON public.payroll_periods
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.payroll_periods TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Payroll entries table (per employee per period)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  payroll_period_id uuid NOT NULL REFERENCES public.payroll_periods (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  basic_salary numeric NOT NULL DEFAULT 0,
  gross_earnings numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  employer_contributions numeric NOT NULL DEFAULT 0,
  paye numeric NOT NULL DEFAULT 0,
  nssf_employee numeric NOT NULL DEFAULT 0,
  nssf_employer numeric NOT NULL DEFAULT 0,
  sha_employee numeric NOT NULL DEFAULT 0,
  ahl_employee numeric NOT NULL DEFAULT 0,
  ahl_employer numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'finalized')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_period_id, staff_id)
);

ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_entries_tenant ON public.payroll_entries;
CREATE POLICY payroll_entries_tenant ON public.payroll_entries
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.payroll_entries TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Payroll entry details (line items)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_entry_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  payroll_entry_id uuid NOT NULL REFERENCES public.payroll_entries (id) ON DELETE CASCADE,
  component_id uuid REFERENCES public.salary_components (id) ON DELETE SET NULL,
  component_name text NOT NULL,
  component_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_entry_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_entry_details_tenant ON public.payroll_entry_details;
CREATE POLICY payroll_entry_details_tenant ON public.payroll_entry_details
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT ON public.payroll_entry_details TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. RPC: get_payroll_periods
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payroll_periods()
RETURNS TABLE(
  period_id uuid,
  name text,
  start_date date,
  end_date date,
  status text,
  created_by_name text,
  approved_by_name text,
  approved_at timestamptz,
  finalized_at timestamptz,
  entry_count bigint
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
    pp.id AS period_id,
    pp.name,
    pp.start_date,
    pp.end_date,
    pp.status,
    p1.full_name AS created_by_name,
    p2.full_name AS approved_by_name,
    pp.approved_at,
    pp.finalized_at,
    (SELECT COUNT(*) FROM public.payroll_entries pe WHERE pe.payroll_period_id = pp.id) AS entry_count
  FROM public.payroll_periods pp
  LEFT JOIN public.profiles p1 ON p1.id = pp.created_by
  LEFT JOIN public.profiles p2 ON p2.id = pp.approved_by
  WHERE (v_role = 'service_role' OR pp.tenant_id = v_caller_tenant)
  ORDER BY pp.start_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: create_payroll_period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_payroll_period(
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

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Period name is required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  -- Check for overlapping periods
  IF EXISTS (
    SELECT 1 FROM public.payroll_periods pp
    WHERE (v_role = 'service_role' OR pp.tenant_id = v_caller_tenant)
      AND pp.start_date <= p_end_date AND pp.end_date >= p_start_date
  ) THEN
    RAISE EXCEPTION 'Overlapping payroll period exists';
  END IF;

  INSERT INTO public.payroll_periods (tenant_id, name, start_date, end_date, created_by)
  VALUES (v_caller_tenant, btrim(p_name), p_start_date, p_end_date, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_period_id;

  PERFORM public.log_audit_event('create', 'payroll_period', v_period_id, NULL, jsonb_build_object('name', p_name, 'start_date', p_start_date, 'end_date', p_end_date));

  RETURN v_period_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: get_payroll_entries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payroll_entries(p_period_id uuid)
RETURNS TABLE(
  entry_id uuid,
  staff_id uuid,
  staff_name text,
  basic_salary numeric,
  gross_earnings numeric,
  total_deductions numeric,
  net_pay numeric,
  employer_contributions numeric,
  paye numeric,
  nssf_employee numeric,
  nssf_employer numeric,
  sha_employee numeric,
  ahl_employee numeric,
  ahl_employer numeric,
  status text
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
    pe.id AS entry_id,
    pe.staff_id,
    p.full_name AS staff_name,
    pe.basic_salary,
    pe.gross_earnings,
    pe.total_deductions,
    pe.net_pay,
    pe.employer_contributions,
    pe.paye,
    pe.nssf_employee,
    pe.nssf_employer,
    pe.sha_employee,
    pe.ahl_employee,
    pe.ahl_employer,
    pe.status
  FROM public.payroll_entries pe
  LEFT JOIN public.profiles p ON p.id = pe.staff_id
  WHERE (v_role = 'service_role' OR pe.tenant_id = v_caller_tenant)
    AND pe.payroll_period_id = p_period_id
  ORDER BY p.full_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. RPC: generate_payroll
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_payroll(p_period_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_period RECORD;
  v_staff RECORD;
  v_salary RECORD;
  v_count INT := 0;
  v_basic NUMERIC;
  v_gross NUMERIC;
  v_deductions NUMERIC;
  v_net NUMERIC;
  v_employer NUMERIC;
  -- Statutory rates (Kenya, current as of 2026)
  -- NSSF: 6% employee, 6% employer (Tier I + II, capped)
  -- SHA/SHIF: 2.75% of gross salary
  -- AHL: 1.5% employee, 1.5% employer
  -- PAYE: progressive bands
  v_nssf_emp NUMERIC;
  v_nssf_er NUMERIC;
  v_sha NUMERIC;
  v_ahl_emp NUMERIC;
  v_ahl_er NUMERIC;
  v_paye NUMERIC;
  v_taxable NUMERIC;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-payroll') THEN
      RAISE EXCEPTION 'Access denied: manage-payroll permission required';
    END IF;
  END IF;

  -- Get period
  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = p_period_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Payroll period not found';
  END IF;

  IF v_period.status != 'draft' THEN
    RAISE EXCEPTION 'Payroll period is not in draft status (current: %)', v_period.status;
  END IF;

  -- Prevent duplicate entries
  IF EXISTS (SELECT 1 FROM public.payroll_entries WHERE payroll_period_id = p_period_id) THEN
    RAISE EXCEPTION 'Payroll already generated for this period';
  END IF;

  -- Generate entries for each active staff member
  FOR v_staff IN
    SELECT p.id AS staff_id, p.full_name
    FROM public.profiles p
    WHERE (v_role = 'service_role' OR p.tenant_id = v_caller_tenant)
      AND p.is_active = true
      AND p.staff_type IN ('TEACHER', 'OFFICIAL', 'WORKER')
  LOOP
    -- Get active salary
    SELECT * INTO v_salary
    FROM public.employee_salaries es
    WHERE es.staff_id = v_staff.staff_id
      AND (v_role = 'service_role' OR es.tenant_id = v_caller_tenant)
      AND es.is_active = true
      AND es.effective_from <= v_period.end_date
      AND (es.effective_to IS NULL OR es.effective_to >= v_period.start_date)
    ORDER BY es.effective_from DESC
    LIMIT 1;

    IF v_salary IS NULL THEN
      CONTINUE; -- Skip staff without salary
    END IF;

    v_basic := v_salary.basic_salary;
    v_gross := v_basic;

    -- Add salary component overrides
    -- (simplified: just use basic salary for now)

    -- Calculate statutory deductions
    -- NSSF: 6% employee, 6% employer (capped at KES 2,160 each for Tier I+II)
    v_nssf_emp := LEAST(v_basic * 0.06, 2160);
    v_nssf_er := LEAST(v_basic * 0.06, 2160);

    -- SHA/SHIF: 2.75% of gross
    v_sha := v_gross * 0.0275;

    -- AHL: 1.5% employee, 1.5% employer
    v_ahl_emp := v_gross * 0.015;
    v_ahl_er := v_gross * 0.015;

    -- PAYE: progressive (simplified bands)
    -- 0-24,000: 10%, 24,001-32,333: 25%, 32,334-500,000: 30%, 500,001-800,000: 32.5%, 800,001+: 35%
    -- Personal relief: KES 2,400/month
    v_taxable := v_gross - v_nssf_emp;
    IF v_taxable <= 24000 THEN
      v_paye := v_taxable * 0.10;
    ELSIF v_taxable <= 32333 THEN
      v_paye := 2400 + (v_taxable - 24000) * 0.25;
    ELSIF v_taxable <= 500000 THEN
      v_paye := 2400 + 2083.25 + (v_taxable - 32333) * 0.30;
    ELSIF v_taxable <= 800000 THEN
      v_paye := 2400 + 2083.25 + 140300.10 + (v_taxable - 500000) * 0.325;
    ELSE
      v_paye := 2400 + 2083.25 + 140300.10 + 97500 + (v_taxable - 800000) * 0.35;
    END IF;
    v_paye := GREATEST(v_paye - 2400, 0); -- Personal relief

    v_deductions := v_paye + v_nssf_emp + v_sha + v_ahl_emp;
    v_net := v_gross - v_deductions;
    v_employer := v_nssf_er + v_ahl_er;

    INSERT INTO public.payroll_entries (
      tenant_id, payroll_period_id, staff_id, basic_salary, gross_earnings,
      total_deductions, net_pay, employer_contributions,
      paye, nssf_employee, nssf_employer, sha_employee, ahl_employee, ahl_employer
    ) VALUES (
      v_caller_tenant, p_period_id, v_staff.staff_id, v_basic, v_gross,
      v_deductions, v_net, v_employer,
      v_paye, v_nssf_emp, v_nssf_er, v_sha, v_ahl_emp, v_ahl_er
    );

    v_count := v_count + 1;
  END LOOP;

  PERFORM public.log_audit_event('generate', 'payroll_period', p_period_id, NULL, jsonb_build_object('entries', v_count));

  RETURN v_count;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 11. RPC: approve_payroll
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_payroll(p_period_id uuid)
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

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'approve-payroll') THEN
      RAISE EXCEPTION 'Access denied: approve-payroll permission required';
    END IF;
  END IF;

  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = p_period_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Payroll period not found';
  END IF;

  IF v_period.status != 'reviewed' THEN
    RAISE EXCEPTION 'Payroll is not in reviewed status (current: %)', v_period.status;
  END IF;

  UPDATE public.payroll_periods SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now()
  WHERE id = p_period_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Payroll approval failed (concurrent modification?)';
  END IF;

  -- Update entries status
  UPDATE public.payroll_entries SET status = 'approved', updated_at = now()
  WHERE payroll_period_id = p_period_id;

  PERFORM public.log_audit_event('approve', 'payroll_period', p_period_id, jsonb_build_object('status', 'reviewed'), jsonb_build_object('status', 'approved'));

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 12. RPC: finalize_payroll
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_payroll(p_period_id uuid)
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

  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'finalize-payroll') THEN
      RAISE EXCEPTION 'Access denied: finalize-payroll permission required';
    END IF;
  END IF;

  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = p_period_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Payroll period not found';
  END IF;

  IF v_period.status != 'approved' THEN
    RAISE EXCEPTION 'Payroll is not approved (current: %)', v_period.status;
  END IF;

  UPDATE public.payroll_periods SET
    status = 'finalized',
    finalized_at = now()
  WHERE id = p_period_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Payroll finalization failed (concurrent modification?)';
  END IF;

  UPDATE public.payroll_entries SET status = 'finalized', updated_at = now()
  WHERE payroll_period_id = p_period_id;

  PERFORM public.log_audit_event('finalize', 'payroll_period', p_period_id, jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'finalized'));

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 13. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_payroll_periods() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_payroll_period(text, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_payroll_entries(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_payroll(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_payroll(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_payroll(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_payroll_periods() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_payroll_period(text, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payroll_entries(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_payroll(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_payroll(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_payroll(uuid) TO authenticated, service_role;
