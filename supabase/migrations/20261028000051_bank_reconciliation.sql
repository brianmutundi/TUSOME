-- TUSOME analytics: Bank Reconciliation (Phase 6)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Bank statements table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  account_name text NOT NULL,
  bank_name text,
  statement_date date NOT NULL,
  opening_balance numeric DEFAULT 0,
  closing_balance numeric DEFAULT 0,
  imported_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  file_name text,
  status text NOT NULL DEFAULT 'imported' CHECK (status IN ('imported', 'reconciling', 'completed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_statements_tenant ON public.bank_statements;
CREATE POLICY bank_statements_tenant ON public.bank_statements
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.bank_statements TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Bank statement lines table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  statement_id uuid NOT NULL REFERENCES public.bank_statements (id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  description text,
  reference_number text,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  amount numeric NOT NULL,
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'matched', 'ambiguous', 'duplicate', 'excluded')),
  matched_payment_id uuid,
  matched_collection_id uuid,
  matched_at timestamptz,
  matched_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  match_notes text,
  is_duplicate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_statement_lines_tenant ON public.bank_statement_lines;
CREATE POLICY bank_statement_lines_tenant ON public.bank_statement_lines
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.bank_statement_lines TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: create_bank_statement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_bank_statement(
  p_account_name text,
  p_statement_date date,
  p_bank_name text DEFAULT NULL,
  p_opening_balance numeric DEFAULT 0,
  p_closing_balance numeric DEFAULT 0,
  p_file_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_statement_id UUID;
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

  INSERT INTO public.bank_statements (tenant_id, account_name, bank_name, statement_date, opening_balance, closing_balance, imported_by, file_name)
  VALUES (v_caller_tenant, btrim(p_account_name), nullif(btrim(coalesce(p_bank_name, '')), ''), p_statement_date, p_opening_balance, p_closing_balance, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END, p_file_name)
  RETURNING id INTO v_statement_id;

  PERFORM public.log_audit_event('create', 'bank_statement', v_statement_id, NULL, jsonb_build_object('account_name', p_account_name, 'statement_date', p_statement_date));

  RETURN v_statement_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: add_bank_statement_line
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_bank_statement_line(
  p_statement_id uuid,
  p_transaction_date date,
  p_description text DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_debit numeric DEFAULT 0,
  p_credit numeric DEFAULT 0,
  p_direction text DEFAULT 'credit'
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_line_id UUID;
  v_amount NUMERIC;
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

  v_amount := CASE WHEN p_direction = 'debit' THEN p_debit ELSE p_credit END;

  -- Check for duplicate (same date, amount, reference)
  IF EXISTS (
    SELECT 1 FROM public.bank_statement_lines bsl
    WHERE bsl.statement_id = p_statement_id
      AND bsl.transaction_date = p_transaction_date
      AND bsl.amount = v_amount
      AND bsl.direction = p_direction
      AND (bsl.reference_number = p_reference_number OR (bsl.reference_number IS NULL AND p_reference_number IS NULL))
  ) THEN
    INSERT INTO public.bank_statement_lines (tenant_id, statement_id, transaction_date, description, reference_number, debit, credit, amount, direction, is_duplicate, match_status)
    VALUES (v_caller_tenant, p_statement_id, p_transaction_date, nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_reference_number, '')), ''), p_debit, p_credit, v_amount, p_direction, true, 'duplicate')
    RETURNING id INTO v_line_id;
  ELSE
    INSERT INTO public.bank_statement_lines (tenant_id, statement_id, transaction_date, description, reference_number, debit, credit, amount, direction)
    VALUES (v_caller_tenant, p_statement_id, p_transaction_date, nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_reference_number, '')), ''), p_debit, p_credit, v_amount, p_direction)
    RETURNING id INTO v_line_id;
  END IF;

  RETURN v_line_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: match_bank_line
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_bank_line(
  p_line_id uuid,
  p_payment_id uuid DEFAULT NULL,
  p_collection_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_line RECORD;
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

  SELECT * INTO v_line
  FROM public.bank_statement_lines
  WHERE id = p_line_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_line IS NULL THEN
    RAISE EXCEPTION 'Bank statement line not found';
  END IF;

  IF v_line.match_status = 'matched' THEN
    RAISE EXCEPTION 'Line is already matched';
  END IF;

  UPDATE public.bank_statement_lines SET
    match_status = 'matched',
    matched_payment_id = p_payment_id,
    matched_collection_id = p_collection_id,
    matched_at = now(),
    matched_by = CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END,
    match_notes = nullif(btrim(coalesce(p_notes, '')), '')
  WHERE id = p_line_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM public.log_audit_event('match', 'bank_statement_line', p_line_id, jsonb_build_object('match_status', v_line.match_status), jsonb_build_object('match_status', 'matched', 'payment_id', p_payment_id, 'collection_id', p_collection_id), p_notes);

  RETURN v_updated > 0;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: unmatch_bank_line
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unmatch_bank_line(p_line_id uuid, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_line RECORD;
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

  SELECT * INTO v_line
  FROM public.bank_statement_lines
  WHERE id = p_line_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_line IS NULL THEN
    RAISE EXCEPTION 'Bank statement line not found';
  END IF;

  IF v_line.match_status != 'matched' THEN
    RAISE EXCEPTION 'Line is not matched';
  END IF;

  UPDATE public.bank_statement_lines SET
    match_status = 'unmatched',
    matched_payment_id = NULL,
    matched_collection_id = NULL,
    matched_at = NULL,
    matched_by = NULL,
    match_notes = nullif(btrim(coalesce(p_reason, '')), '')
  WHERE id = p_line_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM public.log_audit_event('unmatch', 'bank_statement_line', p_line_id, jsonb_build_object('match_status', 'matched'), jsonb_build_object('match_status', 'unmatched'), p_reason);

  RETURN v_updated > 0;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: get_bank_statements
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bank_statements()
RETURNS TABLE(
  statement_id uuid,
  account_name text,
  bank_name text,
  statement_date date,
  opening_balance numeric,
  closing_balance numeric,
  file_name text,
  status text,
  imported_by_name text,
  imported_at timestamptz,
  line_count bigint,
  matched_count bigint,
  unmatched_count bigint
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
    bs.id AS statement_id,
    bs.account_name,
    bs.bank_name,
    bs.statement_date,
    bs.opening_balance,
    bs.closing_balance,
    bs.file_name,
    bs.status,
    p.full_name AS imported_by_name,
    bs.imported_at,
    (SELECT COUNT(*) FROM public.bank_statement_lines bsl WHERE bsl.statement_id = bs.id) AS line_count,
    (SELECT COUNT(*) FROM public.bank_statement_lines bsl WHERE bsl.statement_id = bs.id AND bsl.match_status = 'matched') AS matched_count,
    (SELECT COUNT(*) FROM public.bank_statement_lines bsl WHERE bsl.statement_id = bs.id AND bsl.match_status = 'unmatched') AS unmatched_count
  FROM public.bank_statements bs
  LEFT JOIN public.profiles p ON p.id = bs.imported_by
  WHERE (v_role = 'service_role' OR bs.tenant_id = v_caller_tenant)
  ORDER BY bs.statement_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_bank_statement_lines
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bank_statement_lines(p_statement_id uuid, p_match_status text DEFAULT NULL)
RETURNS TABLE(
  line_id uuid,
  transaction_date date,
  description text,
  reference_number text,
  debit numeric,
  credit numeric,
  amount numeric,
  direction text,
  match_status text,
  matched_payment_id uuid,
  matched_collection_id uuid,
  is_duplicate boolean,
  match_notes text
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
    bsl.id AS line_id,
    bsl.transaction_date,
    bsl.description,
    bsl.reference_number,
    bsl.debit,
    bsl.credit,
    bsl.amount,
    bsl.direction,
    bsl.match_status,
    bsl.matched_payment_id,
    bsl.matched_collection_id,
    bsl.is_duplicate,
    bsl.match_notes
  FROM public.bank_statement_lines bsl
  WHERE (v_role = 'service_role' OR bsl.tenant_id = v_caller_tenant)
    AND bsl.statement_id = p_statement_id
    AND (p_match_status IS NULL OR bsl.match_status = p_match_status)
  ORDER BY bsl.transaction_date;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: complete_reconciliation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_reconciliation(p_statement_id uuid)
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

  UPDATE public.bank_statements SET
    status = 'completed'
  WHERE id = p_statement_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM public.log_audit_event('complete', 'bank_reconciliation', p_statement_id, NULL, jsonb_build_object('status', 'completed'));

  RETURN v_updated > 0;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_bank_statement(text, date, text, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_bank_statement_line(uuid, date, text, text, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.match_bank_line(uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unmatch_bank_line(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_bank_statements() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_bank_statement_lines(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_reconciliation(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_bank_statement(text, date, text, numeric, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_bank_statement_line(uuid, date, text, text, numeric, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_bank_line(uuid, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unmatch_bank_line(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bank_statements() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bank_statement_lines(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_reconciliation(uuid) TO authenticated, service_role;
