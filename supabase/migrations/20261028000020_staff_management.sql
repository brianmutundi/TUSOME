-- TUSOME analytics: Zeraki-parity Staff Management
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs) and the disposable test harness. Never applied to
-- production from here.

-- ---------------------------------------------------------------------------
-- 1. RPC: get_staff_directory
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_directory(p_staff_type text DEFAULT NULL)
RETURNS TABLE(
  staff_id uuid,
  full_name text,
  email text,
  role text,
  staff_type text,
  is_active boolean,
  class_count bigint,
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
    p.id AS staff_id,
    p.full_name,
    p.email,
    p.role,
    p.staff_type,
    p.is_active,
    (SELECT COUNT(*) FROM public.teacher_allocations ta WHERE ta.teacher_id = p.id) AS class_count,
    p.created_at
  FROM public.profiles p
  WHERE (v_role = 'service_role' OR p.tenant_id = v_caller_tenant)
    AND (p_staff_type IS NULL OR p.staff_type = p_staff_type)
  ORDER BY p.full_name;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. RPC: upsert_staff_profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_staff_profile(
  p_full_name text,
  p_email text DEFAULT NULL,
  p_role text DEFAULT 'teacher',
  p_staff_type text DEFAULT 'TEACHER',
  p_is_active boolean DEFAULT true,
  p_staff_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_staff_id UUID;
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

  IF btrim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF p_staff_id IS NOT NULL THEN
    UPDATE public.profiles SET
      full_name = btrim(p_full_name),
      email = nullif(btrim(coalesce(p_email, '')), ''),
      role = p_role,
      staff_type = p_staff_type,
      is_active = p_is_active
    WHERE id = p_staff_id AND (v_role = 'service_role' OR tenant_id = v_caller_tenant)
    RETURNING id INTO v_staff_id;
  ELSE
    INSERT INTO public.profiles (tenant_id, full_name, email, role, staff_type, is_active)
    VALUES (v_caller_tenant, btrim(p_full_name), nullif(btrim(coalesce(p_email, '')), ''), p_role, p_staff_type, p_is_active)
    RETURNING id INTO v_staff_id;
  END IF;

  RETURN v_staff_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Explicit REVOKE / GRANT
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_staff_directory(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_staff_profile(text, text, text, text, boolean, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_staff_directory(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_staff_profile(text, text, text, text, boolean, uuid) TO authenticated, service_role;
