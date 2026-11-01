-- TUSOME analytics: Fee Waiver Approval Workflow (P2)
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Fee waivers table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices (id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  supporting_reference text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_waivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_waivers_tenant ON public.fee_waivers;
CREATE POLICY fee_waivers_tenant ON public.fee_waivers
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.fee_waivers TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. RPC: submit_fee_waiver
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_fee_waiver(
  p_student_id uuid,
  p_amount numeric,
  p_reason text,
  p_invoice_id uuid DEFAULT NULL,
  p_supporting_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_waiver_id UUID;
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
    RAISE EXCEPTION 'Waiver amount must be positive';
  END IF;

  IF btrim(coalesce(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Waiver reason is required';
  END IF;

  INSERT INTO public.fee_waivers (tenant_id, student_id, invoice_id, amount, reason, supporting_reference, requested_by)
  VALUES (v_caller_tenant, p_student_id, p_invoice_id, p_amount, btrim(p_reason), nullif(btrim(coalesce(p_supporting_reference, '')), ''), auth.uid())
  RETURNING id INTO v_waiver_id;

  -- Log audit event
  PERFORM public.log_audit_event('submit', 'fee_waiver', v_waiver_id, NULL, jsonb_build_object('student_id', p_student_id, 'amount', p_amount, 'reason', p_reason), p_reason);

  RETURN v_waiver_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. RPC: approve_fee_waiver
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_fee_waiver(
  p_waiver_id uuid,
  p_review_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_waiver RECORD;
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

  -- Get waiver with row lock to prevent concurrent approval
  SELECT * INTO v_waiver
  FROM public.fee_waivers
  WHERE id = p_waiver_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_waiver IS NULL THEN
    RAISE EXCEPTION 'Waiver not found';
  END IF;

  IF v_waiver.status != 'pending' THEN
    RAISE EXCEPTION 'Waiver is not pending (current status: %)', v_waiver.status;
  END IF;

  -- Separation of duties: requester cannot approve their own
  IF v_waiver.requested_by = auth.uid() AND v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Cannot approve your own waiver request';
  END IF;

  -- Check permission
  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'approve-fee-waiver') THEN
      RAISE EXCEPTION 'Access denied: approve-fee-waiver permission required';
    END IF;
  END IF;

  -- Update status
  UPDATE public.fee_waivers SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = nullif(btrim(coalesce(p_review_notes, '')), ''),
    applied_at = now(),
    updated_at = now()
  WHERE id = p_waiver_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Waiver approval failed (concurrent modification?)';
  END IF;

  -- Apply the waiver as a fee collection with negative amount (credit)
  PERFORM public.record_fee_collection(
    v_waiver.student_id,
    -v_waiver.amount,
    'feeReversal',
    NULL,
    'waiver',
    'WAIVER-' || v_waiver.id::text,
    NULL,
    NULL
  );

  -- Log audit event
  PERFORM public.log_audit_event('approve', 'fee_waiver', p_waiver_id, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'approved', 'amount', v_waiver.amount), p_review_notes);

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: reject_fee_waiver
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_fee_waiver(
  p_waiver_id uuid,
  p_review_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_waiver RECORD;
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

  SELECT * INTO v_waiver
  FROM public.fee_waivers
  WHERE id = p_waiver_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_waiver IS NULL THEN
    RAISE EXCEPTION 'Waiver not found';
  END IF;

  IF v_waiver.status != 'pending' THEN
    RAISE EXCEPTION 'Waiver is not pending (current status: %)', v_waiver.status;
  END IF;

  UPDATE public.fee_waivers SET
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = nullif(btrim(coalesce(p_review_notes, '')), ''),
    updated_at = now()
  WHERE id = p_waiver_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Waiver rejection failed (concurrent modification?)';
  END IF;

  -- Log audit event
  PERFORM public.log_audit_event('reject', 'fee_waiver', p_waiver_id, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'rejected'), p_review_notes);

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: cancel_fee_waiver
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_fee_waiver(p_waiver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_waiver RECORD;
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

  SELECT * INTO v_waiver
  FROM public.fee_waivers
  WHERE id = p_waiver_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
  FOR UPDATE;

  IF v_waiver IS NULL THEN
    RAISE EXCEPTION 'Waiver not found';
  END IF;

  IF v_waiver.status != 'pending' THEN
    RAISE EXCEPTION 'Can only cancel pending waivers (current status: %)', v_waiver.status;
  END IF;

  -- Only requester or admin can cancel
  IF v_waiver.requested_by != auth.uid() AND v_role IS DISTINCT FROM 'service_role' THEN
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'approve-fee-waiver') THEN
      RAISE EXCEPTION 'Access denied: cannot cancel another user waiver';
    END IF;
  END IF;

  UPDATE public.fee_waivers SET
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_waiver_id
    AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Waiver cancellation failed (concurrent modification?)';
  END IF;

  -- Log audit event
  PERFORM public.log_audit_event('cancel', 'fee_waiver', p_waiver_id, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'cancelled'));

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_fee_waivers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fee_waivers(p_status text DEFAULT NULL, p_student_id uuid DEFAULT NULL)
RETURNS TABLE(
  waiver_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  invoice_id uuid,
  amount numeric,
  reason text,
  supporting_reference text,
  status text,
  requested_by_name text,
  requested_at timestamptz,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_notes text,
  applied_at timestamptz
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
    fw.id AS waiver_id,
    fw.student_id,
    s.full_name AS student_name,
    s.admission_no,
    fw.invoice_id,
    fw.amount,
    fw.reason,
    fw.supporting_reference,
    fw.status,
    rq.full_name AS requested_by_name,
    fw.requested_at,
    rv.full_name AS reviewed_by_name,
    fw.reviewed_at,
    fw.review_notes,
    fw.applied_at
  FROM public.fee_waivers fw
  LEFT JOIN public.students s ON s.id = fw.student_id
  LEFT JOIN public.profiles rq ON rq.id = fw.requested_by
  LEFT JOIN public.profiles rv ON rv.id = fw.reviewed_by
  WHERE (v_role = 'service_role' OR fw.tenant_id = v_caller_tenant)
    AND (p_status IS NULL OR fw.status = p_status)
    AND (p_student_id IS NULL OR fw.student_id = p_student_id)
  ORDER BY fw.requested_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.submit_fee_waiver(uuid, numeric, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_fee_waiver(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_fee_waiver(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_fee_waiver(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fee_waivers(text, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_fee_waiver(uuid, numeric, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_fee_waiver(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_fee_waiver(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_fee_waiver(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fee_waivers(text, uuid) TO authenticated, service_role;
