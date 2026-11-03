-- TUSOME analytics: Budgets vs Actual (P8)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Budget headers table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  fiscal_period_id uuid REFERENCES public.fiscal_periods (id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'locked')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budgets_tenant ON public.budgets;
CREATE POLICY budgets_tenant ON public.budgets
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.budgets TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Budget lines table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.budgets (id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.chart_of_accounts (id) ON DELETE SET NULL,
  vote_head_id uuid REFERENCES public.vote_heads (id) ON DELETE SET NULL,
  budget_type text NOT NULL DEFAULT 'expenditure' CHECK (budget_type IN ('expenditure', 'revenue')),
  amount numeric NOT NULL DEFAULT 0,
  monthly_allocations jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, account_id, vote_head_id)
);

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_lines_tenant ON public.budget_lines;
CREATE POLICY budget_lines_tenant ON public.budget_lines
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Budget versions table (history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.budgets (id) ON DELETE CASCADE,
  version integer NOT NULL,
  changes jsonb NOT NULL,
  reason text,
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_versions_tenant ON public.budget_versions;
CREATE POLICY budget_versions_tenant ON public.budget_versions
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT ON public.budget_versions TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_budget
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_budget(
  p_name text,
  p_fiscal_period_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_budget_id UUID;
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
    RAISE EXCEPTION 'Budget name is required';
  END IF;

  INSERT INTO public.budgets (tenant_id, name, fiscal_period_id, description, created_by)
  VALUES (v_caller_tenant, btrim(p_name), p_fiscal_period_id, nullif(btrim(coalesce(p_description, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_budget_id;

  PERFORM public.log_audit_event('create', 'budget', v_budget_id, NULL, jsonb_build_object('name', p_name));

  RETURN v_budget_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: add_budget_line
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_budget_line(
  p_budget_id uuid,
  p_account_id uuid DEFAULT NULL,
  p_vote_head_id uuid DEFAULT NULL,
  p_budget_type text DEFAULT 'expenditure',
  p_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_line_id UUID;
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

  IF p_budget_type NOT IN ('expenditure', 'revenue') THEN
    RAISE EXCEPTION 'Invalid budget type';
  END IF;

  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Budget amount cannot be negative';
  END IF;

  INSERT INTO public.budget_lines (tenant_id, budget_id, account_id, vote_head_id, budget_type, amount, notes)
  VALUES (v_caller_tenant, p_budget_id, p_account_id, p_vote_head_id, p_budget_type, p_amount, nullif(btrim(coalesce(p_notes, '')), ''))
  ON CONFLICT (budget_id, account_id, vote_head_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    budget_type = EXCLUDED.budget_type,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_line_id;

  RETURN v_line_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: approve_budget
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_budget(p_budget_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_budget RECORD;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'approve-budget') THEN
      RAISE EXCEPTION 'Access denied: approve-budget permission required';
    END IF;
  END IF;

  SELECT * INTO v_budget
  FROM public.budgets
  WHERE id = p_budget_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_budget IS NULL THEN
    RAISE EXCEPTION 'Budget not found';
  END IF;

  IF v_budget.status != 'submitted' THEN
    RAISE EXCEPTION 'Budget is not submitted (current status: %)', v_budget.status;
  END IF;

  UPDATE public.budgets SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE id = p_budget_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Budget approval failed (concurrent modification?)';
  END IF;

  PERFORM public.log_audit_event('approve', 'budget', p_budget_id, jsonb_build_object('status', 'submitted'), jsonb_build_object('status', 'approved'));

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: get_budget_vs_actual
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_budget_vs_actual(
  p_budget_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE(
  line_id uuid,
  account_id uuid,
  account_code text,
  account_name text,
  vote_head_id uuid,
  vote_head_name text,
  budget_type text,
  budget_amount numeric,
  actual_amount numeric,
  variance numeric,
  variance_pct numeric
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_start DATE;
  v_end DATE;
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

  -- Default date range from fiscal period
  SELECT fp.start_date, fp.end_date INTO v_start, v_end
  FROM public.budgets b
  LEFT JOIN public.fiscal_periods fp ON fp.id = b.fiscal_period_id
  WHERE b.id = p_budget_id;

  v_start := COALESCE(p_start_date, v_start, CURRENT_DATE - INTERVAL '1 year');
  v_end := COALESCE(p_end_date, v_end, CURRENT_DATE);

  RETURN QUERY
  SELECT
    bl.id AS line_id,
    bl.account_id,
    coa.code AS account_code,
    coa.name AS account_name,
    bl.vote_head_id,
    vh.name AS vote_head_name,
    bl.budget_type,
    bl.amount AS budget_amount,
    COALESCE(
      (SELECT SUM(jl.debit - jl.credit)
       FROM public.journal_lines jl
       JOIN public.journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.is_posted = true
         AND je.entry_date BETWEEN v_start AND v_end
         AND (v_role = 'service_role' OR je.tenant_id = v_caller_tenant)
         AND jl.account_id = bl.account_id),
      0
    ) AS actual_amount,
    (bl.amount - COALESCE(
      (SELECT SUM(jl.debit - jl.credit)
       FROM public.journal_lines jl
       JOIN public.journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.is_posted = true
         AND je.entry_date BETWEEN v_start AND v_end
         AND (v_role = 'service_role' OR je.tenant_id = v_caller_tenant)
         AND jl.account_id = bl.account_id),
      0
    )) AS variance,
    CASE
      WHEN bl.amount = 0 THEN NULL
      ELSE ROUND(
        ((bl.amount - COALESCE(
          (SELECT SUM(jl.debit - jl.credit)
           FROM public.journal_lines jl
           JOIN public.journal_entries je ON je.id = jl.journal_entry_id
           WHERE je.is_posted = true
             AND je.entry_date BETWEEN v_start AND v_end
             AND (v_role = 'service_role' OR je.tenant_id = v_caller_tenant)
             AND jl.account_id = bl.account_id),
          0
        )) / bl.amount * 100, 2))
    END AS variance_pct
  FROM public.budget_lines bl
  LEFT JOIN public.chart_of_accounts coa ON coa.id = bl.account_id
  LEFT JOIN public.vote_heads vh ON vh.id = bl.vote_head_id
  WHERE (v_role = 'service_role' OR bl.tenant_id = v_caller_tenant)
    AND bl.budget_id = p_budget_id
  ORDER BY coa.code, vh.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_budgets
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_budgets(p_status text DEFAULT NULL)
RETURNS TABLE(
  budget_id uuid,
  name text,
  fiscal_period_id uuid,
  fiscal_period_name text,
  status text,
  version integer,
  created_by_name text,
  approved_by_name text,
  approved_at timestamptz,
  created_at timestamptz,
  line_count bigint,
  total_budget numeric
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
    b.id AS budget_id,
    b.name,
    b.fiscal_period_id,
    fp.name AS fiscal_period_name,
    b.status,
    b.version,
    p1.full_name AS created_by_name,
    p2.full_name AS approved_by_name,
    b.approved_at,
    b.created_at,
    (SELECT COUNT(*) FROM public.budget_lines bl WHERE bl.budget_id = b.id) AS line_count,
    (SELECT COALESCE(SUM(bl.amount), 0) FROM public.budget_lines bl WHERE bl.budget_id = b.id) AS total_budget
  FROM public.budgets b
  LEFT JOIN public.fiscal_periods fp ON fp.id = b.fiscal_period_id
  LEFT JOIN public.profiles p1 ON p1.id = b.created_by
  LEFT JOIN public.profiles p2 ON p2.id = b.approved_by
  WHERE (v_role = 'service_role' OR b.tenant_id = v_caller_tenant)
    AND (p_status IS NULL OR b.status = p_status)
  ORDER BY b.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_budget(text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_budget_line(uuid, uuid, uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_budget(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_budget_vs_actual(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_budgets(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_budget(text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_budget_line(uuid, uuid, uuid, text, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_budget(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_budget_vs_actual(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_budgets(text) TO authenticated, service_role;
