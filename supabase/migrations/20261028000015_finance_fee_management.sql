-- TUSOME analytics: Zeraki-parity Finance & Fee Management
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- 1. Finance routes (route_tree.tsv):
--      * /main/finance/balances          (balance list)
--      * /main/finance/balances/balance-list/:streamId
--      * /main/finance/fee-str           (fee structures)
--      * /main/finance/fee-str/:feeStructureId
--      * /main/finance/pledges           (fee pledges)
--      * /main/finance/pledges/:studentId
--      * /main/finance/pledges/add
--      * /main/finance/student           (student finance)
--      * /main/finance/student/finance-details
--      * /main/finance/student/dashboard
--      * /main/finance/student/pay
--      * /main/finance/sch-fin           (school finance)
-- 2. Existing fee_statements table (migration 000009) stores per-student
--    fee balances (total_fees, amount_paid, balance).

-- ---------------------------------------------------------------------------
-- 1. Fee structures table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
  academic_year integer NOT NULL,
  term text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_structures_tenant ON public.fee_structures;
CREATE POLICY fee_structures_tenant ON public.fee_structures
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_structures TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Fee payments table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'bank', 'cheque', 'other')),
  reference_number text,
  academic_year integer,
  term text,
  notes text,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_payments_tenant ON public.fee_payments;
CREATE POLICY fee_payments_tenant ON public.fee_payments
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_payments TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Fee pledges table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  pledged_amount numeric NOT NULL,
  paid_amount numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'defaulted', 'cancelled')),
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_pledges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_pledges_tenant ON public.fee_pledges;
CREATE POLICY fee_pledges_tenant ON public.fee_pledges
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_pledges TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC: get_fee_structures
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fee_structures(p_academic_year integer DEFAULT NULL, p_term text DEFAULT NULL)
RETURNS TABLE(
  structure_id uuid,
  class_id uuid,
  class_name text,
  academic_year integer,
  term text,
  name text,
  amount numeric,
  description text,
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
    fs.id AS structure_id,
    fs.class_id,
    c.name AS class_name,
    fs.academic_year,
    fs.term,
    fs.name,
    fs.amount,
    fs.description,
    fs.is_active,
    fs.created_at
  FROM public.fee_structures fs
  LEFT JOIN public.classes c ON c.id = fs.class_id
  WHERE (v_role = 'service_role' OR fs.tenant_id = v_caller_tenant)
    AND (p_academic_year IS NULL OR fs.academic_year = p_academic_year)
    AND (p_term IS NULL OR fs.term = p_term)
  ORDER BY fs.academic_year DESC, fs.term, c.name, fs.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: upsert_fee_structure
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_fee_structure(
  p_class_id uuid DEFAULT NULL,
  p_academic_year integer DEFAULT NULL,
  p_term text DEFAULT NULL,
  p_name text DEFAULT '',
  p_amount numeric DEFAULT 0,
  p_description text DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_structure_id UUID;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees') THEN
      RAISE EXCEPTION 'Access denied: manage-fees permission required';
    END IF;
  END IF;

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Fee structure name is required';
  END IF;

  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Amount cannot be negative';
  END IF;

  INSERT INTO public.fee_structures (tenant_id, class_id, academic_year, term, name, amount, description, is_active)
  VALUES (v_caller_tenant, p_class_id, COALESCE(p_academic_year, extract(year from now())::int), COALESCE(p_term, 'Term 1'), btrim(p_name), p_amount, nullif(btrim(coalesce(p_description, '')), ''), p_is_active)
  RETURNING id INTO v_structure_id;

  RETURN v_structure_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_student_fee_balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_fee_balance(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_total_fees NUMERIC;
  v_total_paid NUMERIC;
  v_balance NUMERIC;
  v_student_name TEXT;
  v_admission_no TEXT;
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

  SELECT s.full_name, s.admission_no INTO v_student_name, v_admission_no
  FROM public.students s
  WHERE s.id = p_student_id
    AND (v_role = 'service_role' OR s.tenant_id = v_caller_tenant);

  SELECT COALESCE(SUM(fs.amount), 0) INTO v_total_fees
  FROM public.fee_structures fs
  WHERE (v_role = 'service_role' OR fs.tenant_id = v_caller_tenant)
    AND fs.is_active = true;

  SELECT COALESCE(SUM(fp.amount), 0) INTO v_total_paid
  FROM public.fee_payments fp
  WHERE (v_role = 'service_role' OR fp.tenant_id = v_caller_tenant)
    AND fp.student_id = p_student_id;

  v_balance := v_total_fees - v_total_paid;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'student_name', v_student_name,
    'admission_no', v_admission_no,
    'total_fees', v_total_fees,
    'total_paid', v_total_paid,
    'balance', v_balance
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: record_fee_payment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_fee_payment(
  p_student_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_reference_number text DEFAULT NULL,
  p_academic_year integer DEFAULT NULL,
  p_term text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_payment_id UUID;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees') THEN
      RAISE EXCEPTION 'Access denied: manage-fees permission required';
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  INSERT INTO public.fee_payments (tenant_id, student_id, amount, payment_method, reference_number, academic_year, term, notes, recorded_by)
  VALUES (v_caller_tenant, p_student_id, p_amount, p_payment_method, nullif(btrim(coalesce(p_reference_number, '')), ''), p_academic_year, p_term, nullif(btrim(coalesce(p_notes, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_fee_payments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fee_payments(p_student_id uuid DEFAULT NULL, p_limit integer DEFAULT 50)
RETURNS TABLE(
  payment_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  amount numeric,
  payment_method text,
  reference_number text,
  academic_year integer,
  term text,
  notes text,
  recorded_by_name text,
  paid_at timestamptz
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
    fp.id AS payment_id,
    fp.student_id,
    s.full_name AS student_name,
    s.admission_no,
    fp.amount,
    fp.payment_method,
    fp.reference_number,
    fp.academic_year,
    fp.term,
    fp.notes,
    p.full_name AS recorded_by_name,
    fp.paid_at
  FROM public.fee_payments fp
  LEFT JOIN public.students s ON s.id = fp.student_id
  LEFT JOIN public.profiles p ON p.id = fp.recorded_by
  WHERE (v_role = 'service_role' OR fp.tenant_id = v_caller_tenant)
    AND (p_student_id IS NULL OR fp.student_id = p_student_id)
  ORDER BY fp.paid_at DESC
  LIMIT v_limit;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: get_fee_pledges
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fee_pledges(p_student_id uuid DEFAULT NULL)
RETURNS TABLE(
  pledge_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  pledged_amount numeric,
  paid_amount numeric,
  remaining_amount numeric,
  due_date date,
  status text,
  notes text,
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
    fp.id AS pledge_id,
    fp.student_id,
    s.full_name AS student_name,
    s.admission_no,
    fp.pledged_amount,
    fp.paid_amount,
    (fp.pledged_amount - fp.paid_amount) AS remaining_amount,
    fp.due_date,
    fp.status,
    fp.notes,
    fp.created_at
  FROM public.fee_pledges fp
  LEFT JOIN public.students s ON s.id = fp.student_id
  WHERE (v_role = 'service_role' OR fp.tenant_id = v_caller_tenant)
    AND (p_student_id IS NULL OR fp.student_id = p_student_id)
  ORDER BY fp.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. RPC: create_fee_pledge
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_fee_pledge(
  p_student_id uuid,
  p_pledged_amount numeric,
  p_due_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_pledge_id UUID;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees') THEN
      RAISE EXCEPTION 'Access denied: manage-fees permission required';
    END IF;
  END IF;

  IF p_pledged_amount <= 0 THEN
    RAISE EXCEPTION 'Pledged amount must be positive';
  END IF;

  INSERT INTO public.fee_pledges (tenant_id, student_id, pledged_amount, due_date, notes, created_by)
  VALUES (v_caller_tenant, p_student_id, p_pledged_amount, p_due_date, nullif(btrim(coalesce(p_notes, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_pledge_id;

  RETURN v_pledge_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 11. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_fee_structures(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_fee_structure(uuid, integer, text, text, numeric, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_fee_balance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_fee_payment(uuid, numeric, text, text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fee_payments(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fee_pledges(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_fee_pledge(uuid, numeric, date, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_fee_structures(integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_fee_structure(uuid, integer, text, text, numeric, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_fee_balance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_fee_payment(uuid, numeric, text, text, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fee_payments(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fee_pledges(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_fee_pledge(uuid, numeric, date, text) TO authenticated, service_role;
