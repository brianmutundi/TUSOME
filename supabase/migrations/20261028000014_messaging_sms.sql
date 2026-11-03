-- TUSOME analytics: Zeraki-parity Messaging & SMS
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.
--
-- Zeraki bundle evidence
-- ----------------------
-- 1. Messaging routes (chunk-M5SZJUTK.js, chunk-53TTHA3L.js, chunk-4K4S5TZH.js):
--      * /main/messages/inbox          (permission: "access-messages")
--      * /main/messages/compose        (permission: "compose-send-sms")
--      * /main/messages/buy            (permission: "purchase-sms")
--      * /main/messages/track          (permission: "track-sms-usage")
--      * /main/messages/opt-outs       (permission: "compose-send-sms")
-- 2. Compose form (chunk-4K4S5TZH.js):
--      * Recipients: allParents, allStaff, allTeachers, specificClasses,
--        specificStaff, specificStudents, specificTeachers, alumni, others
--      * Message types: text, examResults, feeInfo, graduationClass, sendCredentials
--      * Can key in phone numbers or upload from spreadsheet
--      * Shows message count and credit cost
-- 3. Buy credits (chunk-6ECF2RX3.js):
--      * M-Pesa STK push, paybill, purchase history, receipts
-- 4. Track usage (chunk-XF5XTFOS.js):
--      * Message groups with delivery status (delivered, pending, failed, duplicate)
--      * Resend failed messages
--      * Filter by status

-- ---------------------------------------------------------------------------
-- 1. Message log table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN (
    'all_parents', 'all_teachers', 'all_staff', 'specific_classes',
    'specific_teachers', 'specific_staff', 'specific_students', 'alumni', 'others', 'keyed_in'
  )),
  recipient_ids uuid[] DEFAULT ARRAY[]::uuid[],
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN (
    'text', 'exam_results', 'fee_info', 'graduation_class', 'credentials'
  )),
  subject text,
  message_body text NOT NULL,
  phone_numbers text[] DEFAULT ARRAY[]::text[],
  recipient_count integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'sent', 'delivered', 'failed', 'partial'
  )),
  exam_id uuid REFERENCES public.exams (id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_log_tenant ON public.message_log;
CREATE POLICY message_log_tenant ON public.message_log
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_log TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC: log_message
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_message(
  p_recipient_type text,
  p_recipient_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_message_type text DEFAULT 'text',
  p_subject text DEFAULT NULL,
  p_message_body text DEFAULT '',
  p_phone_numbers text[] DEFAULT ARRAY[]::text[],
  p_recipient_count integer DEFAULT 0,
  p_credits_used integer DEFAULT 0,
  p_exam_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_message_id UUID;
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
    IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, 'compose-send-sms') THEN
      RAISE EXCEPTION 'Access denied: compose-send-sms permission required';
    END IF;
  END IF;

  IF p_recipient_type NOT IN (
    'all_parents', 'all_teachers', 'all_staff', 'specific_classes',
    'specific_teachers', 'specific_staff', 'specific_students', 'alumni', 'others', 'keyed_in'
  ) THEN
    RAISE EXCEPTION 'Invalid recipient type';
  END IF;

  IF p_message_type NOT IN ('text', 'exam_results', 'fee_info', 'graduation_class', 'credentials') THEN
    RAISE EXCEPTION 'Invalid message type';
  END IF;

  IF btrim(coalesce(p_message_body, '')) = '' THEN
    RAISE EXCEPTION 'Message body is required';
  END IF;

  INSERT INTO public.message_log (
    tenant_id, sender_id, recipient_type, recipient_ids, message_type,
    subject, message_body, phone_numbers, recipient_count, credits_used,
    status, exam_id, sent_at
  )
  VALUES (
    v_caller_tenant,
    CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END,
    p_recipient_type,
    COALESCE(p_recipient_ids, ARRAY[]::uuid[]),
    p_message_type,
    nullif(btrim(coalesce(p_subject, '')), ''),
    btrim(p_message_body),
    COALESCE(p_phone_numbers, ARRAY[]::text[]),
    COALESCE(p_recipient_count, 0),
    COALESCE(p_credits_used, 0),
    'sent',
    p_exam_id,
    now()
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_message_history
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_message_history(p_limit integer DEFAULT 50)
RETURNS TABLE(
  message_id uuid,
  recipient_type text,
  message_type text,
  subject text,
  message_body text,
  recipient_count integer,
  credits_used integer,
  status text,
  exam_id uuid,
  exam_name text,
  sent_at timestamptz,
  created_at timestamptz,
  sender_name text
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
    ml.id AS message_id,
    ml.recipient_type,
    ml.message_type,
    ml.subject,
    ml.message_body,
    ml.recipient_count,
    ml.credits_used,
    ml.status,
    ml.exam_id,
    e.name AS exam_name,
    ml.sent_at,
    ml.created_at,
    p.full_name AS sender_name
  FROM public.message_log ml
  LEFT JOIN public.exams e ON e.id = ml.exam_id
  LEFT JOIN public.profiles p ON p.id = ml.sender_id
  WHERE v_role = 'service_role' OR ml.tenant_id = v_caller_tenant
  ORDER BY ml.created_at DESC
  LIMIT v_limit;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: get_message_recipients (students/parents/teachers/staff for a school)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_message_recipients()
RETURNS jsonb
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

  RETURN jsonb_build_object(
    'students', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.full_name,
            'admission_no', s.admission_no,
            'class_name', c.name,
            'stream_name', st.name,
            'gender', s.gender
          ) ORDER BY s.full_name, s.admission_no
        )
        FROM public.students s
        LEFT JOIN public.classes c ON c.id = s.class_id
        LEFT JOIN public.streams st ON st.id = s.stream_id
        WHERE v_role = 'service_role' OR s.tenant_id = v_caller_tenant
      ),
      '[]'::jsonb
    ),
    'teachers', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.full_name,
            'role', p.role,
            'staff_type', p.staff_type
          ) ORDER BY p.full_name
        )
        FROM public.profiles p
        WHERE (v_role = 'service_role' OR p.tenant_id = v_caller_tenant)
          AND COALESCE(p.staff_type, 'OFFICIAL') IN ('TEACHER', 'OFFICIAL')
      ),
      '[]'::jsonb
    ),
    'classes', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', c.id, 'name', c.name)
          ORDER BY c.name
        )
        FROM public.classes c
        WHERE v_role = 'service_role' OR c.tenant_id = v_caller_tenant
      ),
      '[]'::jsonb
    ),
    'streams', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', s.id, 'class_id', s.class_id, 'name', s.name)
          ORDER BY s.name
        )
        FROM public.streams s
        WHERE v_role = 'service_role' OR s.tenant_id = v_caller_tenant
      ),
      '[]'::jsonb
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. SMS Gateway: get_pending_sms (for companion Android app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pending_sms()
RETURNS TABLE(
  message_id uuid,
  phone_numbers text[],
  message_body text,
  recipient_count integer,
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
    ml.id AS message_id,
    ml.phone_numbers,
    ml.message_body,
    ml.recipient_count,
    ml.created_at
  FROM public.message_log ml
  WHERE (v_role = 'service_role' OR ml.tenant_id = v_caller_tenant)
    AND ml.status = 'queued'
  ORDER BY ml.created_at ASC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. SMS Gateway: update_sms_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_sms_status(
  p_message_id uuid,
  p_status text
)
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

  IF p_status NOT IN ('queued', 'sent', 'delivered', 'failed', 'partial') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.message_log
  SET status = p_status,
      sent_at = CASE WHEN p_status IN ('sent', 'delivered') AND sent_at IS NULL THEN now() ELSE sent_at END
  WHERE id = p_message_id
    AND tenant_id = v_caller_tenant;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. SMS Gateway: get_sms_gateway_config
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sms_gateway_config()
RETURNS jsonb
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

  RETURN jsonb_build_object(
    'tenant_id', v_caller_tenant,
    'gateway_type', 'device_sim',
    'description', 'SMS sent via Android device SIM using SmsManager API',
    'companion_app', 'Multi SMS Sender (MSS) by crazy.pradeep',
    'mechanism', 'Android SmsManager.sendTextMessage() via device SIM card',
    'required_permissions', jsonb_build_array('android.permission.SEND_SMS', 'android.permission.READ_SMS'),
    'supports_dual_sim', true,
    'supports_delivery_tracking', true,
    'max_batch_size', 100
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Explicit REVOKE / GRANT (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.log_message(text, uuid[], text, text, text, text[], integer, integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_message_history(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_message_recipients() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_pending_sms() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_sms_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sms_gateway_config() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.log_message(text, uuid[], text, text, text, text[], integer, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_message_history(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_message_recipients() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_sms() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_sms_status(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sms_gateway_config() TO authenticated, service_role;
