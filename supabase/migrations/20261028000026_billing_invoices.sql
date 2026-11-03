-- TUSOME analytics: Zeraki-parity Billing & Invoices
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Invoices table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  student_id uuid REFERENCES public.students (id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date date,
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_tenant ON public.invoices;
CREATE POLICY invoices_tenant ON public.invoices
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Invoice items table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_items_tenant ON public.invoice_items;
CREATE POLICY invoice_items_tenant ON public.invoice_items
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Receipts table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices (id) ON DELETE SET NULL,
  receipt_number text NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'mpesa', 'bank', 'cheque', 'other')),
  reference_number text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipts_tenant ON public.receipts;
CREATE POLICY receipts_tenant ON public.receipts
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC: get_invoices
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invoices(p_status text DEFAULT NULL)
RETURNS TABLE(
  invoice_id uuid,
  invoice_number text,
  student_id uuid,
  student_name text,
  admission_no text,
  amount numeric,
  tax_amount numeric,
  total_amount numeric,
  status text,
  due_date date,
  issued_date date,
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
    i.id AS invoice_id,
    i.invoice_number,
    i.student_id,
    s.full_name AS student_name,
    s.admission_no,
    i.amount,
    i.tax_amount,
    i.total_amount,
    i.status,
    i.due_date,
    i.issued_date,
    i.notes,
    i.created_at
  FROM public.invoices i
  LEFT JOIN public.students s ON s.id = i.student_id
  WHERE (v_role = 'service_role' OR i.tenant_id = v_caller_tenant)
    AND (p_status IS NULL OR i.status = p_status)
  ORDER BY i.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: create_invoice
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_invoice(
  p_invoice_number text,
  p_student_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
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
  v_invoice_id UUID;
  v_total NUMERIC;
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

  IF btrim(coalesce(p_invoice_number, '')) = '' THEN
    RAISE EXCEPTION 'Invoice number is required';
  END IF;

  v_total := p_amount + p_tax_amount;

  INSERT INTO public.invoices (tenant_id, invoice_number, student_id, amount, tax_amount, total_amount, due_date, notes, created_by)
  VALUES (v_caller_tenant, btrim(p_invoice_number), p_student_id, p_amount, p_tax_amount, v_total, p_due_date, nullif(btrim(coalesce(p_notes, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_receipts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_receipts(p_invoice_id uuid DEFAULT NULL)
RETURNS TABLE(
  receipt_id uuid,
  invoice_id uuid,
  invoice_number text,
  receipt_number text,
  amount_paid numeric,
  payment_method text,
  reference_number text,
  paid_at timestamptz,
  recorded_by_name text
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
    r.id AS receipt_id,
    r.invoice_id,
    i.invoice_number,
    r.receipt_number,
    r.amount_paid,
    r.payment_method,
    r.reference_number,
    r.paid_at,
    p.full_name AS recorded_by_name
  FROM public.receipts r
  LEFT JOIN public.invoices i ON i.id = r.invoice_id
  LEFT JOIN public.profiles p ON p.id = r.recorded_by
  WHERE (v_role = 'service_role' OR r.tenant_id = v_caller_tenant)
    AND (p_invoice_id IS NULL OR r.invoice_id = p_invoice_id)
  ORDER BY r.paid_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: record_receipt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_receipt(
  p_invoice_id uuid,
  p_receipt_number text,
  p_amount_paid numeric,
  p_payment_method text DEFAULT 'cash',
  p_reference_number text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_receipt_id UUID;
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

  INSERT INTO public.receipts (tenant_id, invoice_id, receipt_number, amount_paid, payment_method, reference_number, recorded_by)
  VALUES (v_caller_tenant, p_invoice_id, btrim(p_receipt_number), p_amount_paid, p_payment_method, nullif(btrim(coalesce(p_reference_number, '')), ''), CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_receipt_id;

  -- Update invoice status if fully paid
  UPDATE public.invoices SET status = 'paid', updated_at = now()
  WHERE id = p_invoice_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    AND (SELECT COALESCE(SUM(amount_paid), 0) FROM public.receipts WHERE invoice_id = p_invoice_id) >= total_amount;

  RETURN v_receipt_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_invoices(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_invoice(text, uuid, numeric, numeric, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_receipts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_receipt(uuid, text, numeric, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_invoices(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice(text, uuid, numeric, numeric, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_receipts(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_receipt(uuid, text, numeric, text, text) TO authenticated, service_role;
