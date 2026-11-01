-- TUSOME analytics: Zeraki-parity Counselling
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. Counselling sessions table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counselling_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students (id) ON DELETE SET NULL,
  counsellor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  session_date timestamptz NOT NULL DEFAULT now(),
  session_type text NOT NULL DEFAULT 'individual' CHECK (session_type IN ('individual', 'group', 'family', 'crisis')),
  topic text,
  notes text,
  outcome text,
  follow_up_date date,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.counselling_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS counselling_sessions_tenant ON public.counselling_sessions;
CREATE POLICY counselling_sessions_tenant ON public.counselling_sessions
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.counselling_sessions TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Counselling referrals table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counselling_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  referred_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reason text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'resolved', 'closed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.counselling_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS counselling_referrals_tenant ON public.counselling_referrals;
CREATE POLICY counselling_referrals_tenant ON public.counselling_referrals
  FOR ALL
  USING (tenant_id = public.my_tenant_id())
  WITH CHECK (tenant_id = public.my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.counselling_referrals TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_counselling_sessions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_counselling_sessions(p_student_id uuid DEFAULT NULL)
RETURNS TABLE(
  session_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  counsellor_name text,
  session_date timestamptz,
  session_type text,
  topic text,
  notes text,
  outcome text,
  follow_up_date date,
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
    cs.id AS session_id,
    cs.student_id,
    s.full_name AS student_name,
    s.admission_no,
    p.full_name AS counsellor_name,
    cs.session_date,
    cs.session_type,
    cs.topic,
    cs.notes,
    cs.outcome,
    cs.follow_up_date,
    cs.status
  FROM public.counselling_sessions cs
  LEFT JOIN public.students s ON s.id = cs.student_id
  LEFT JOIN public.profiles p ON p.id = cs.counsellor_id
  WHERE (v_role = 'service_role' OR cs.tenant_id = v_caller_tenant)
    AND (p_student_id IS NULL OR cs.student_id = p_student_id)
  ORDER BY cs.session_date DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_counselling_session
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_counselling_session(
  p_student_id uuid DEFAULT NULL,
  p_session_type text DEFAULT 'individual',
  p_topic text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_session_date timestamptz DEFAULT now(),
  p_outcome text DEFAULT NULL,
  p_follow_up_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_session_id UUID;
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

  INSERT INTO public.counselling_sessions (tenant_id, student_id, counsellor_id, session_type, topic, notes, session_date, outcome, follow_up_date)
  VALUES (v_caller_tenant, p_student_id, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END, p_session_type, nullif(btrim(coalesce(p_topic, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''), p_session_date, nullif(btrim(coalesce(p_outcome, '')), ''), p_follow_up_date)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_counselling_referrals
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_counselling_referrals(p_student_id uuid DEFAULT NULL)
RETURNS TABLE(
  referral_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  referred_by_name text,
  reason text,
  urgency text,
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
    cr.id AS referral_id,
    cr.student_id,
    s.full_name AS student_name,
    s.admission_no,
    p.full_name AS referred_by_name,
    cr.reason,
    cr.urgency,
    cr.status,
    cr.notes,
    cr.created_at
  FROM public.counselling_referrals cr
  LEFT JOIN public.students s ON s.id = cr.student_id
  LEFT JOIN public.profiles p ON p.id = cr.referred_by
  WHERE (v_role = 'service_role' OR cr.tenant_id = v_caller_tenant)
    AND (p_student_id IS NULL OR cr.student_id = p_student_id)
  ORDER BY cr.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: create_counselling_referral
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_counselling_referral(
  p_student_id uuid,
  p_reason text,
  p_urgency text DEFAULT 'normal',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_referral_id UUID;
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

  IF btrim(coalesce(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Referral reason is required';
  END IF;

  INSERT INTO public.counselling_referrals (tenant_id, student_id, referred_by, reason, urgency, notes)
  VALUES (v_caller_tenant, p_student_id, CASE WHEN v_role IS DISTINCT FROM 'service_role' THEN auth.uid() ELSE NULL END, btrim(p_reason), p_urgency, nullif(btrim(coalesce(p_notes, '')), ''))
  RETURNING id INTO v_referral_id;

  RETURN v_referral_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_counselling_sessions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_counselling_session(uuid, text, text, text, timestamptz, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_counselling_referrals(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_counselling_referral(uuid, text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_counselling_sessions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_counselling_session(uuid, text, text, text, timestamptz, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_counselling_referrals(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_counselling_referral(uuid, text, text, text) TO authenticated, service_role;
