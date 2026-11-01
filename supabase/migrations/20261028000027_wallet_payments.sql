-- TUSOME analytics: Zeraki-parity Wallet & Payments
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Wallets table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  owner_type text NOT NULL DEFAULT 'student' CHECK (owner_type IN ('student', 'parent', 'staff')),
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KES',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, owner_id)
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallets_tenant ON public.wallets;
CREATE POLICY wallets_tenant ON public.wallets
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Wallet transactions table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets (id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'payment', 'refund', 'transfer')),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL DEFAULT 0,
  description text,
  reference_number text,
  payment_method text,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_transactions_tenant ON public.wallet_transactions;
CREATE POLICY wallet_transactions_tenant ON public.wallet_transactions
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_wallet
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_wallet(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_wallet_id UUID;
  v_balance NUMERIC;
  v_currency TEXT;
  v_owner_type TEXT;
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

  SELECT w.id, w.balance, w.currency, w.owner_type INTO v_wallet_id, v_balance, v_currency, v_owner_type
  FROM public.wallets w
  WHERE w.owner_id = p_owner_id
    AND (v_role = 'service_role' OR w.tenant_id = v_caller_tenant);

  IF v_wallet_id IS NULL THEN
    -- Create wallet if not exists
    INSERT INTO public.wallets (tenant_id, owner_id, owner_type, balance, currency)
    VALUES (v_caller_tenant, p_owner_id, 'student', 0, 'KES')
    RETURNING id, balance, currency, owner_type INTO v_wallet_id, v_balance, v_currency, v_owner_type;
  END IF;

  RETURN jsonb_build_object(
    'wallet_id', v_wallet_id,
    'owner_id', p_owner_id,
    'balance', v_balance,
    'currency', v_currency,
    'owner_type', v_owner_type
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_wallet_transaction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_wallet_transaction(
  p_owner_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_payment_method text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_txn_id UUID;
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

  -- Get or create wallet
  SELECT w.id, w.balance INTO v_wallet_id, v_current_balance
  FROM public.wallets w
  WHERE w.owner_id = p_owner_id
    AND (v_role = 'service_role' OR w.tenant_id = v_caller_tenant);

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (tenant_id, owner_id, owner_type, balance, currency)
    VALUES (v_caller_tenant, p_owner_id, 'student', 0, 'KES')
    RETURNING id, balance INTO v_wallet_id, v_current_balance;
  END IF;

  -- Calculate new balance
  IF p_transaction_type IN ('deposit', 'refund') THEN
    v_new_balance := v_current_balance + p_amount;
  ELSE
    v_new_balance := v_current_balance - p_amount;
  END IF;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Record transaction
  INSERT INTO public.wallet_transactions (tenant_id, wallet_id, transaction_type, amount, balance_after, description, reference_number, payment_method, recorded_by)
  VALUES (v_caller_tenant, v_wallet_id, p_transaction_type, p_amount, v_new_balance, nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_reference_number, '')), ''), p_payment_method, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_txn_id;

  -- Update wallet balance
  UPDATE public.wallets SET balance = v_new_balance, updated_at = now()
  WHERE id = v_wallet_id;

  RETURN v_txn_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_wallet_transactions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_wallet_transactions(p_owner_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(
  transaction_id uuid,
  transaction_type text,
  amount numeric,
  balance_after numeric,
  description text,
  reference_number text,
  payment_method text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_wallet_id UUID;
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

  SELECT w.id INTO v_wallet_id
  FROM public.wallets w
  WHERE w.owner_id = p_owner_id
    AND (v_role = 'service_role' OR w.tenant_id = v_caller_tenant);

  IF v_wallet_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    wt.id AS transaction_id,
    wt.transaction_type,
    wt.amount,
    wt.balance_after,
    wt.description,
    wt.reference_number,
    wt.payment_method,
    wt.created_at
  FROM public.wallet_transactions wt
  WHERE wt.wallet_id = v_wallet_id
    AND (v_role = 'service_role' OR wt.tenant_id = v_caller_tenant)
  ORDER BY wt.created_at DESC
  LIMIT v_limit;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_wallet(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_wallet_transaction(uuid, text, numeric, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_wallet_transactions(uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_wallet(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_wallet_transaction(uuid, text, numeric, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_wallet_transactions(uuid, integer) TO authenticated, service_role;
