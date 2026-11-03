-- TUSOME analytics: Zeraki-parity Accounting Foundation (P4)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- XULE evidence: "Double-entry accounting built for a school office"
--   - Chart of accounts, journals, cash book, trial balance, bank
--     reconciliation, budgets, fiscal-year lock, PSASB reports.

-- ---------------------------------------------------------------------------
-- 1. Chart of accounts table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id uuid REFERENCES public.chart_of_accounts (id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coa_tenant ON public.chart_of_accounts;
CREATE POLICY coa_tenant ON public.chart_of_accounts
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Journal entries table (double-entry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  description text NOT NULL,
  source_type text CHECK (source_type IN ('fee_payment', 'fee_collection', 'expense', 'adjustment', 'opening_balance', 'reversal')),
  source_id uuid,
  is_posted boolean NOT NULL DEFAULT false,
  posted_at timestamptz,
  posted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journal_entries_tenant ON public.journal_entries;
CREATE POLICY journal_entries_tenant ON public.journal_entries
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.journal_entries TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Journal lines table (debit/credit lines)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts (id) ON DELETE RESTRICT,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journal_lines_tenant ON public.journal_lines;
CREATE POLICY journal_lines_tenant ON public.journal_lines
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Cash book entries table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_book_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_type text NOT NULL CHECK (entry_type IN ('receipt', 'payment', 'transfer', 'adjustment')),
  amount numeric NOT NULL,
  description text NOT NULL,
  account_id uuid REFERENCES public.chart_of_accounts (id) ON DELETE SET NULL,
  reference_number text,
  payment_method text,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_book_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_book_entries_tenant ON public.cash_book_entries;
CREATE POLICY cash_book_entries_tenant ON public.cash_book_entries
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_book_entries TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_chart_of_accounts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_chart_of_accounts()
RETURNS TABLE(
  account_id uuid,
  code text,
  name text,
  account_type text,
  parent_id uuid,
  parent_name text,
  is_active boolean,
  description text
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
    coa.id AS account_id,
    coa.code,
    coa.name,
    coa.account_type,
    coa.parent_id,
    p.name AS parent_name,
    coa.is_active,
    coa.description
  FROM public.chart_of_accounts coa
  LEFT JOIN public.chart_of_accounts p ON p.id = coa.parent_id
  WHERE (v_role = 'service_role' OR coa.tenant_id = v_caller_tenant)
  ORDER BY coa.code;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: upsert_chart_of_account
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_chart_of_account(
  p_code text,
  p_name text,
  p_account_type text,
  p_parent_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_account_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_account_id UUID;
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

  IF btrim(coalesce(p_code, '')) = '' THEN
    RAISE EXCEPTION 'Account code is required';
  END IF;

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Account name is required';
  END IF;

  IF p_account_type NOT IN ('asset', 'liability', 'equity', 'revenue', 'expense') THEN
    RAISE EXCEPTION 'Invalid account type';
  END IF;

  IF p_account_id IS NOT NULL THEN
    UPDATE public.chart_of_accounts SET
      code = btrim(p_code),
      name = btrim(p_name),
      account_type = p_account_type,
      parent_id = p_parent_id,
      description = nullif(btrim(coalesce(p_description, '')), '')
    WHERE id = p_account_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_account_id;
  ELSE
    INSERT INTO public.chart_of_accounts (tenant_id, code, name, account_type, parent_id, description)
    VALUES (v_caller_tenant, btrim(p_code), btrim(p_name), p_account_type, p_parent_id, nullif(btrim(coalesce(p_description, '')), ''))
    RETURNING id INTO v_account_id;
  END IF;

  RETURN v_account_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: create_journal_entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_journal_entry(
  p_entry_date date DEFAULT CURRENT_DATE,
  p_description text DEFAULT '',
  p_reference text DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_entry_id UUID;
  v_line jsonb;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_debit NUMERIC;
  v_credit NUMERIC;
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
    RAISE EXCEPTION 'Journal entry description is required';
  END IF;

  -- Validate lines balance
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_debit := COALESCE((v_line->>'debit')::numeric, 0);
    v_credit := COALESCE((v_line->>'credit')::numeric, 0);
    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  END LOOP;

  IF v_total_debit != v_total_credit THEN
    RAISE EXCEPTION 'Journal entry does not balance: debits=% credits=%', v_total_debit, v_total_credit;
  END IF;

  IF v_total_debit = 0 THEN
    RAISE EXCEPTION 'Journal entry must have non-zero amounts';
  END IF;

  -- Create journal entry
  INSERT INTO public.journal_entries (tenant_id, entry_date, description, reference, source_type, source_id, created_by)
  VALUES (v_caller_tenant, p_entry_date, btrim(p_description), nullif(btrim(coalesce(p_reference, '')), ''), p_source_type, p_source_id, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_entry_id;

  -- Create journal lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
    VALUES (
      v_caller_tenant,
      v_entry_id,
      (v_line->>'account_id')::uuid,
      COALESCE((v_line->>'debit')::numeric, 0),
      COALESCE((v_line->>'credit')::numeric, 0),
      nullif(btrim(coalesce(v_line->>'description', '')), '')
    );
  END LOOP;

  RETURN v_entry_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: post_journal_entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_entry_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
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

  -- Verify the entry balances before posting
  UPDATE public.journal_entries SET
    is_posted = true,
    posted_at = now(),
    posted_by = CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END
  WHERE id = p_entry_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    AND is_posted = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: get_trial_balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_trial_balance(p_as_of_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  total_debit numeric,
  total_credit numeric,
  balance numeric
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
    coa.id AS account_id,
    coa.code AS account_code,
    coa.name AS account_name,
    coa.account_type,
    COALESCE(SUM(jl.debit), 0) AS total_debit,
    COALESCE(SUM(jl.credit), 0) AS total_credit,
    COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
  FROM public.chart_of_accounts coa
  LEFT JOIN public.journal_lines jl ON jl.account_id = coa.id
  LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.is_posted = true AND je.entry_date <= p_as_of_date
  WHERE (v_role = 'service_role' OR coa.tenant_id = v_caller_tenant)
    AND coa.is_active = true
  GROUP BY coa.id, coa.code, coa.name, coa.account_type
  ORDER BY coa.code;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. RPC: record_cash_book_entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_cash_book_entry(
  p_entry_type text,
  p_amount numeric,
  p_description text,
  p_account_id uuid DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_entry_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_entry_id UUID;
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

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF btrim(coalesce(p_description, '')) = '' THEN
    RAISE EXCEPTION 'Description is required';
  END IF;

  INSERT INTO public.cash_book_entries (tenant_id, entry_type, amount, description, account_id, reference_number, payment_method, entry_date, recorded_by)
  VALUES (v_caller_tenant, p_entry_type, p_amount, btrim(p_description), p_account_id, nullif(btrim(coalesce(p_reference_number, '')), ''), p_payment_method, p_entry_date, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 11. RPC: get_cash_book_entries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cash_book_entries(p_limit integer DEFAULT 50)
RETURNS TABLE(
  entry_id uuid,
  entry_date date,
  entry_type text,
  amount numeric,
  description text,
  account_code text,
  account_name text,
  reference_number text,
  payment_method text,
  recorded_by_name text,
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

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);

  RETURN QUERY
  SELECT
    cbe.id AS entry_id,
    cbe.entry_date,
    cbe.entry_type,
    cbe.amount,
    cbe.description,
    coa.code AS account_code,
    coa.name AS account_name,
    cbe.reference_number,
    cbe.payment_method,
    p.full_name AS recorded_by_name,
    cbe.created_at
  FROM public.cash_book_entries cbe
  LEFT JOIN public.chart_of_accounts coa ON coa.id = cbe.account_id
  LEFT JOIN public.profiles p ON p.id = cbe.recorded_by
  WHERE (v_role = 'service_role' OR cbe.tenant_id = v_caller_tenant)
  ORDER BY cbe.entry_date DESC, cbe.created_at DESC
  LIMIT v_limit;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 12. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_chart_of_accounts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_chart_of_account(text, text, text, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_journal_entry(date, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_journal_entry(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_trial_balance(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_cash_book_entry(text, numeric, text, uuid, text, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_cash_book_entries(integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_chart_of_accounts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_chart_of_account(text, text, text, uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_journal_entry(date, text, text, text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_trial_balance(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_cash_book_entry(text, numeric, text, uuid, text, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cash_book_entries(integer) TO authenticated, service_role;
