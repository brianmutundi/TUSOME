-- TUSOME analytics: Zeraki-parity Finance Enhancement (Vote Heads, Collections, Statements)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- 1. Finance API (chunk-ZMZCYM6K.js):
--      * /vote_heads, /vote_head_categories
--      * /fee_structure_groups, /fee_structures/:id
--      * /balances/vote_heads?studentId=:param
--      * /collections/?page=:param&pageSize=20&studentId=:param
--      * /statements/?studentId=:param&page=:param&pageSize=20
--      * /reversal_reasons/?page=:param&pageSize=1000
--      * /pledges/?page=:param&pageSize=100000&student_id=:param
--      * /dashboard/balances?amountAbove/amountBelow
--      * /dashboard/snapshot (revenue vs expenditure)
--      * /z_finance/principal/balance, statement, structure
-- 2. Student finance dashboard (finance strings):
--      * Nav tabs: feeStructure, pledges, statements
--      * Statement types: feeCollection, feeInvoice, feeReversal
--      * Vote heads: fee components (Tuition, Transport, etc.)
--      * Fee structure groups: grouping fee structures
--      * Convenience fee: additional fee type
--      * Next payment due, total fees, school fee payments

-- ---------------------------------------------------------------------------
-- 1. Vote head categories table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_head_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vote_head_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vote_head_categories_tenant ON public.vote_head_categories;
CREATE POLICY vote_head_categories_tenant ON public.vote_head_categories
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vote_head_categories TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Vote heads table (fee components)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.vote_head_categories (id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vote_heads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vote_heads_tenant ON public.vote_heads;
CREATE POLICY vote_heads_tenant ON public.vote_heads
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vote_heads TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Fee structure groups table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_structure_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_structure_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_structure_groups_tenant ON public.fee_structure_groups;
CREATE POLICY fee_structure_groups_tenant ON public.fee_structure_groups
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_structure_groups TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Fee structure items (vote head amounts per structure)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_structure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  structure_id uuid NOT NULL REFERENCES public.fee_structures (id) ON DELETE CASCADE,
  vote_head_id uuid NOT NULL REFERENCES public.vote_heads (id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (structure_id, vote_head_id)
);

ALTER TABLE public.fee_structure_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_structure_items_tenant ON public.fee_structure_items;
CREATE POLICY fee_structure_items_tenant ON public.fee_structure_items
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_structure_items TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Collections table (fee collection records)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  vote_head_id uuid REFERENCES public.vote_heads (id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  collection_type text NOT NULL DEFAULT 'feeCollection' CHECK (collection_type IN ('feeCollection', 'feeInvoice', 'feeReversal')),
  payment_method text,
  reference_number text,
  academic_year integer,
  term text,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_collections_tenant ON public.fee_collections;
CREATE POLICY fee_collections_tenant ON public.fee_collections
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_collections TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Reversal reasons table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reversal_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  reason text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reversal_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reversal_reasons_tenant ON public.reversal_reasons;
CREATE POLICY reversal_reasons_tenant ON public.reversal_reasons
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reversal_reasons TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Vote head balances (per student)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_head_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  vote_head_id uuid NOT NULL REFERENCES public.vote_heads (id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, vote_head_id)
);

ALTER TABLE public.vote_head_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vote_head_balances_tenant ON public.vote_head_balances;
CREATE POLICY vote_head_balances_tenant ON public.vote_head_balances
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.vote_head_balances TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_vote_heads
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vote_heads()
RETURNS TABLE(
  vote_head_id uuid,
  name text,
  code text,
  category_id uuid,
  category_name text,
  description text,
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
    vh.id AS vote_head_id,
    vh.name,
    vh.code,
    vh.category_id,
    vhc.name AS category_name,
    vh.description,
    vh.is_active
  FROM public.vote_heads vh
  LEFT JOIN public.vote_head_categories vhc ON vhc.id = vh.category_id
  WHERE (v_role = 'service_role' OR vh.tenant_id = v_caller_tenant)
  ORDER BY vhc.name, vh.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: upsert_vote_head
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_vote_head(
  p_name text,
  p_code text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_vote_head_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_vh_id UUID;
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
    RAISE EXCEPTION 'Vote head name is required';
  END IF;

  IF p_vote_head_id IS NOT NULL THEN
    UPDATE public.vote_heads SET
      name = btrim(p_name),
      code = nullif(btrim(coalesce(p_code, '')), ''),
      category_id = p_category_id,
      description = nullif(btrim(coalesce(p_description, '')), '')
    WHERE id = p_vote_head_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_vh_id;
  ELSE
    INSERT INTO public.vote_heads (tenant_id, name, code, category_id, description)
    VALUES (v_caller_tenant, btrim(p_name), nullif(btrim(coalesce(p_code, '')), ''), p_category_id, nullif(btrim(coalesce(p_description, '')), ''))
    RETURNING id INTO v_vh_id;
  END IF;

  RETURN v_vh_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. RPC: get_vote_head_categories
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vote_head_categories()
RETURNS TABLE(
  category_id uuid,
  name text,
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
    vhc.id AS category_id,
    vhc.name,
    vhc.description
  FROM public.vote_head_categories vhc
  WHERE (v_role = 'service_role' OR vhc.tenant_id = v_caller_tenant)
  ORDER BY vhc.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 11. RPC: get_student_vote_head_balances
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_vote_head_balances(p_student_id uuid)
RETURNS TABLE(
  vote_head_id uuid,
  vote_head_name text,
  vote_head_code text,
  category_name text,
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
    vh.id AS vote_head_id,
    vh.name AS vote_head_name,
    vh.code AS vote_head_code,
    vhc.name AS category_name,
    COALESCE(vhb.balance, 0) AS balance
  FROM public.vote_heads vh
  LEFT JOIN public.vote_head_categories vhc ON vhc.id = vh.category_id
  LEFT JOIN public.vote_head_balances vhb ON vhb.vote_head_id = vh.id AND vhb.student_id = p_student_id
  WHERE (v_role = 'service_role' OR vh.tenant_id = v_caller_tenant)
    AND vh.is_active = true
  ORDER BY vhc.name, vh.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 12. RPC: record_fee_collection
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_fee_collection(
  p_student_id uuid,
  p_amount numeric,
  p_collection_type text DEFAULT 'feeCollection',
  p_vote_head_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'cash',
  p_reference_number text DEFAULT NULL,
  p_academic_year integer DEFAULT NULL,
  p_term text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_collection_id UUID;
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

  INSERT INTO public.fee_collections (tenant_id, student_id, vote_head_id, amount, collection_type, payment_method, reference_number, academic_year, term, recorded_by)
  VALUES (v_caller_tenant, p_student_id, p_vote_head_id, p_amount, p_collection_type, p_payment_method, nullif(btrim(coalesce(p_reference_number, '')), ''), p_academic_year, p_term, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END)
  RETURNING id INTO v_collection_id;

  -- Update vote head balance if vote_head_id is provided
  IF p_vote_head_id IS NOT NULL THEN
    INSERT INTO public.vote_head_balances (tenant_id, student_id, vote_head_id, balance)
    VALUES (v_caller_tenant, p_student_id, p_vote_head_id, -p_amount)
    ON CONFLICT (student_id, vote_head_id) DO UPDATE SET
      balance = vote_head_balances.balance - p_amount,
      updated_at = now();
  END IF;

  RETURN v_collection_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 13. RPC: get_fee_collections
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fee_collections(p_student_id uuid DEFAULT NULL, p_limit integer DEFAULT 50)
RETURNS TABLE(
  collection_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  vote_head_name text,
  amount numeric,
  collection_type text,
  payment_method text,
  reference_number text,
  academic_year integer,
  term text,
  recorded_by_name text,
  collected_at timestamptz
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
    fc.id AS collection_id,
    fc.student_id,
    s.full_name AS student_name,
    s.admission_no,
    vh.name AS vote_head_name,
    fc.amount,
    fc.collection_type,
    fc.payment_method,
    fc.reference_number,
    fc.academic_year,
    fc.term,
    p.full_name AS recorded_by_name,
    fc.collected_at
  FROM public.fee_collections fc
  LEFT JOIN public.students s ON s.id = fc.student_id
  LEFT JOIN public.vote_heads vh ON vh.id = fc.vote_head_id
  LEFT JOIN public.profiles p ON p.id = fc.recorded_by
  WHERE (v_role = 'service_role' OR fc.tenant_id = v_caller_tenant)
    AND (p_student_id IS NULL OR fc.student_id = p_student_id)
  ORDER BY fc.collected_at DESC
  LIMIT v_limit;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 14. RPC: get_reversal_reasons
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_reversal_reasons()
RETURNS TABLE(
  reason_id uuid,
  reason text,
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
    rr.id AS reason_id,
    rr.reason,
    rr.is_active
  FROM public.reversal_reasons rr
  WHERE (v_role = 'service_role' OR rr.tenant_id = v_caller_tenant)
  ORDER BY rr.reason;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 15. RPC: get_fee_structure_groups
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fee_structure_groups()
RETURNS TABLE(
  group_id uuid,
  name text,
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
    fsg.id AS group_id,
    fsg.name,
    fsg.description
  FROM public.fee_structure_groups fsg
  WHERE (v_role = 'service_role' OR fsg.tenant_id = v_caller_tenant)
  ORDER BY fsg.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 16. RPC: upsert_fee_structure_group
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_fee_structure_group(
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_group_id UUID;
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
    RAISE EXCEPTION 'Group name is required';
  END IF;

  INSERT INTO public.fee_structure_groups (tenant_id, name, description)
  VALUES (v_caller_tenant, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''))
  RETURNING id INTO v_group_id;

  RETURN v_group_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 17. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_vote_heads() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_vote_head(text, text, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_vote_head_categories() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_vote_head_balances(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_fee_collection(uuid, numeric, text, uuid, text, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fee_collections(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_reversal_reasons() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fee_structure_groups() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_fee_structure_group(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_vote_heads() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_vote_head(text, text, uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_vote_head_categories() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_vote_head_balances(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_fee_collection(uuid, numeric, text, uuid, text, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fee_collections(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_reversal_reasons() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fee_structure_groups() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_fee_structure_group(text, text) TO authenticated, service_role;
