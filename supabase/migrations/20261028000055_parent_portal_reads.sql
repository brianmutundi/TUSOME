-- 20261028000055_parent_portal_reads.sql
--
-- Parent-facing reads. A parent sees only students linked to them in
-- parent_student_links. Access comes from the link, never from a staff
-- permission.
--
-- 1. profiles.phone, plus set_my_phone() so a parent can save the M-Pesa
--    number (stored as 2547XXXXXXXX or 2541XXXXXXXX).
-- 2. assert_parent_of(student_id): guard used by every parent read.
-- 3. get_my_children(), get_my_child_fees(), get_my_child_payments(),
--    get_my_child_results(), get_my_child_attendance().
--
-- The parent functions are SECURITY DEFINER because section 4 blocks parents
-- from reading tables directly. Each one checks the parent-student link first
-- (assert_parent_of) and filters by the verified tenant and student.
--
-- 4. Parents are blocked from direct table access with one RESTRICTIVE policy
--    per table, so the RPCs above are their only data path. Existing
--    tenant-only policies stay as they are for staff.
--
-- Results show only exams with status 'published'.
-- Fee balance: vote_head_balances.balance is the amount still owed
-- (record_fee_collection subtracts each payment from it).
-- Not run against a database here.

-- ---------------------------------------------------------------------------
-- 1. phone
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.normalize_ke_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_digits TEXT;
BEGIN
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  IF v_digits ~ '^0[17][0-9]{8}$' THEN
    v_digits := '254' || substr(v_digits, 2);
  ELSIF v_digits ~ '^[17][0-9]{8}$' THEN
    v_digits := '254' || v_digits;
  END IF;
  IF v_digits ~ '^254[17][0-9]{8}$' THEN
    RETURN v_digits;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_phone TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  v_phone := public.normalize_ke_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Enter a valid Kenyan phone number, for example 0712345678';
  END IF;

  UPDATE public.profiles SET phone = v_phone WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_phone;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. assert_parent_of
--    Returns the tenant. Raises unless the caller is an active parent account
--    linked to the student in the caller's tenant. service_role skips checks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_parent_of(p_student_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role TEXT;
  v_caller_tenant UUID;
  v_student_tenant UUID;
BEGIN
  SELECT s.tenant_id INTO v_student_tenant
  FROM public.students s WHERE s.id = p_student_id;

  IF v_student_tenant IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role = 'service_role' THEN
    RETURN v_student_tenant;
  END IF;

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF v_student_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.parent_student_links psl
    JOIN public.profiles p ON p.id = psl.parent_id
    WHERE psl.parent_id = auth.uid()
      AND psl.student_id = p_student_id
      AND psl.tenant_id = v_caller_tenant
      AND p.tenant_id = v_caller_tenant
      AND p.is_active = true
      AND p.access_revoked = false
      AND public.normalize_role_key(p.role) = 'parent'
  ) THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  RETURN v_student_tenant;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3a. get_my_children
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_children()
RETURNS TABLE(
  student_id uuid,
  full_name text,
  admission_no text,
  class_name text,
  relationship text,
  is_primary boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_tenant UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.full_name,
    s.admission_no,
    c.name,
    psl.relationship,
    psl.is_primary
  FROM public.parent_student_links psl
  JOIN public.profiles p ON p.id = psl.parent_id
  JOIN public.students s ON s.id = psl.student_id AND s.tenant_id = v_caller_tenant
  LEFT JOIN public.classes c ON c.id = s.class_id
  WHERE psl.parent_id = auth.uid()
    AND psl.tenant_id = v_caller_tenant
    AND p.tenant_id = v_caller_tenant
    AND p.is_active = true
    AND p.access_revoked = false
    AND public.normalize_role_key(p.role) = 'parent'
  ORDER BY psl.is_primary DESC, s.full_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3b. get_my_child_fees: balance per vote head
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_child_fees(p_student_id uuid)
RETURNS TABLE(
  vote_head_id uuid,
  vote_head_name text,
  balance numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant UUID;
BEGIN
  v_tenant := public.assert_parent_of(p_student_id);

  RETURN QUERY
  SELECT vhb.vote_head_id, vh.name, vhb.balance
  FROM public.vote_head_balances vhb
  JOIN public.vote_heads vh ON vh.id = vhb.vote_head_id
  WHERE vhb.student_id = p_student_id
    AND vhb.tenant_id = v_tenant
  ORDER BY vh.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3c. get_my_child_payments: recent payments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_child_payments(p_student_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(
  collection_id uuid,
  amount numeric,
  payment_method text,
  reference_number text,
  term text,
  academic_year integer,
  collected_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant UUID;
BEGIN
  v_tenant := public.assert_parent_of(p_student_id);

  RETURN QUERY
  SELECT fc.id, fc.amount, fc.payment_method, fc.reference_number,
         fc.term, fc.academic_year, fc.collected_at
  FROM public.fee_collections fc
  WHERE fc.student_id = p_student_id
    AND fc.tenant_id = v_tenant
    AND fc.collection_type = 'feeCollection'
  ORDER BY fc.collected_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 50), 200));
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3d. get_my_child_results: published exams only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_child_results(p_student_id uuid)
RETURNS TABLE(
  exam_id uuid,
  exam_name text,
  term text,
  academic_year integer,
  subject_name text,
  score numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant UUID;
BEGIN
  v_tenant := public.assert_parent_of(p_student_id);

  RETURN QUERY
  SELECT e.id, e.name, e.term, e.academic_year, sj.name, m.score
  FROM public.marks m
  JOIN public.exams e ON e.id = m.exam_id AND e.tenant_id = v_tenant
  JOIN public.subjects sj ON sj.id = m.subject_id
  WHERE m.student_id = p_student_id
    AND m.tenant_id = v_tenant
    AND e.status = 'published'
  ORDER BY e.academic_year DESC NULLS LAST, e.created_at DESC, sj.name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3e. get_my_child_attendance: counts per status for one year
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_child_attendance(p_student_id uuid, p_academic_year integer DEFAULT NULL)
RETURNS TABLE(
  status text,
  days bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant UUID;
  v_year INTEGER;
BEGIN
  v_tenant := public.assert_parent_of(p_student_id);
  v_year := coalesce(p_academic_year, extract(year FROM now())::integer);

  RETURN QUERY
  SELECT ar.status, count(*)
  FROM public.attendance_records ar
  WHERE ar.student_id = p_student_id
    AND ar.tenant_id = v_tenant
    AND ar.academic_year = v_year
  GROUP BY ar.status
  ORDER BY ar.status;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_my_phone(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_parent_of(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_children() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_child_fees(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_child_payments(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_child_results(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_child_attendance(uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.normalize_ke_phone(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_my_phone(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_parent_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_children() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_child_fees(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_child_payments(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_child_results(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_child_attendance(uuid, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Block parents from direct table access
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_parent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND public.normalize_role_key(p.role) = 'parent'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_parent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_parent() TO authenticated, service_role;

DO $block$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT pol.tablename
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename NOT IN ('profiles', 'parent_student_links', 'tenants')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS parent_block ON public.%I', r.tablename);
    EXECUTE format(
      'CREATE POLICY parent_block ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT NOT public.is_parent())) WITH CHECK ((SELECT NOT public.is_parent()))',
      r.tablename
    );
  END LOOP;
END
$block$;

-- profiles: a parent can read only their own row and cannot write.
DROP POLICY IF EXISTS parent_block_select ON public.profiles;
CREATE POLICY parent_block_select ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT NOT public.is_parent()) OR id = auth.uid());
DROP POLICY IF EXISTS parent_block_write ON public.profiles;
CREATE POLICY parent_block_write ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT NOT public.is_parent())) WITH CHECK ((SELECT NOT public.is_parent()));

-- parent_student_links: a parent can read only their own links and cannot write.
DROP POLICY IF EXISTS parent_block_select ON public.parent_student_links;
CREATE POLICY parent_block_select ON public.parent_student_links AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT NOT public.is_parent()) OR parent_id = auth.uid());
DROP POLICY IF EXISTS parent_block_write ON public.parent_student_links;
CREATE POLICY parent_block_write ON public.parent_student_links AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT NOT public.is_parent())) WITH CHECK ((SELECT NOT public.is_parent()));

-- get_my_permissions: parents hold no staff permissions. Return early so the
-- function does not read tables parents cannot see.
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_uid UUID;
  v_caller_tenant UUID;
  v_profile JSONB;
  v_is_admin BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF public.is_parent() THEN
    RETURN jsonb_build_object(
      'user_id', v_uid,
      'role', 'parent',
      'is_admin', false,
      'permissions', '[]'::jsonb
    );
  END IF;

  v_profile := public.get_user_permission_profile(v_uid);

  v_is_admin := public.normalize_role_key(v_profile ->> 'role') IN (
    'admin', 'super admin', 'owner', 'principal', 'director'
  ) AND COALESCE((v_profile ->> 'is_active')::boolean, false)
    AND NOT COALESCE((v_profile ->> 'access_revoked')::boolean, true);

  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'user_id', v_uid,
      'role', v_profile ->> 'role',
      'is_admin', true,
      'permissions', (SELECT COALESCE(jsonb_agg(code ORDER BY sort_order, code), '[]'::jsonb) FROM public.permissions)
    );
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_uid,
    'role', v_profile ->> 'role',
    'is_admin', false,
    'permissions', COALESCE(v_profile -> 'effective_permissions', '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated, service_role;
