CREATE OR REPLACE FUNCTION public.update_account_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_role text,
  p_staff_type text,
  p_is_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_target_tenant UUID;
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_role TEXT;
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

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;

    IF p_user_id = auth.uid() AND NOT coalesce(p_is_active, true) THEN
      RAISE EXCEPTION 'Cannot deactivate your own account';
    END IF;

    -- Prevent self-role-change
    IF p_user_id = auth.uid() THEN
      IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id AND public.normalize_role_key(p.role) <> public.normalize_role_key(p_role)) THEN
        RAISE EXCEPTION 'Cannot change your own role';
      END IF;
    END IF;
  END IF;

  SELECT p.tenant_id INTO v_target_tenant
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_target_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to account from different tenant';
  END IF;

  v_clean_name := btrim(coalesce(p_full_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  v_clean_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  IF v_clean_email IS NOT NULL AND position('@' IN v_clean_email) = 0 THEN
    RAISE EXCEPTION 'Valid email address is required';
  END IF;

  v_clean_role := btrim(coalesce(p_role, ''));
  IF v_clean_role = '' THEN
    RAISE EXCEPTION 'Role is required';
  END IF;

  IF p_staff_type IS NULL OR p_staff_type NOT IN ('TEACHER', 'OFFICIAL', 'WORKER') THEN
    RAISE EXCEPTION 'Invalid staff type: must be TEACHER, OFFICIAL or WORKER';
  END IF;

  UPDATE public.profiles
  SET
    full_name  = v_clean_name,
    email      = COALESCE(v_clean_email, email),
    role       = v_clean_role,
    staff_type = p_staff_type,
    is_active  = coalesce(p_is_active, true)
  WHERE id = p_user_id
    AND tenant_id = v_target_tenant;

  IF v_clean_email IS NOT NULL THEN
    UPDATE auth.users SET email = v_clean_email WHERE id = p_user_id;
  END IF;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 14. Section heads (chunk-POC2O2ZL.js: get / upsert / delete)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_section_heads()
RETURNS TABLE(
  section_head_id uuid,
  form_level text,
  user_id uuid,
  user_full_name text,
  user_email text,
  user_role text,
  staff_type text,
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
    sh.id AS section_head_id,
    sh.form_level,
    sh.user_id,
    p.full_name AS user_full_name,
    coalesce(nullif(btrim(p.email), ''), u.email) AS user_email,
    p.role AS user_role,
    coalesce(p.staff_type, 'TEACHER') AS staff_type,
    sh.created_at
  FROM public.section_heads sh
  JOIN public.profiles p ON p.id = sh.user_id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE v_role = 'service_role'
     OR sh.tenant_id = v_caller_tenant
  ORDER BY sh.form_level, sh.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_section_head(
  p_form_level text,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_target_tenant UUID;
  v_id UUID;
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
    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  IF p_form_level IS NULL OR p_form_level NOT IN (
    'PRE_SCHOOL', 'KINDERGARTEN', 'LOWER_PRIMARY', 'UPPER_PRIMARY',
    'PRIMARY', 'JUNIOR_SCHOOL', 'SENIOR_SCHOOL', 'SECONDARY',
    'LOWER_SECONDARY', 'UPPER_SECONDARY', 'O_LEVEL', 'A_LEVEL',
    'COLLEGE', 'DP', 'MYP'
  ) THEN
    RAISE EXCEPTION 'Invalid form level';
  END IF;

  SELECT p.tenant_id INTO v_target_tenant
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_target_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to account from different tenant';
  END IF;

  INSERT INTO public.section_heads (tenant_id, form_level, user_id)
  VALUES (v_caller_tenant, p_form_level, p_user_id)
  ON CONFLICT (tenant_id, form_level) DO UPDATE SET
    user_id = EXCLUDED.user_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_section_head(p_section_head_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_target_tenant UUID;
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

    SELECT EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.tenant_id = v_caller_tenant
        AND me.is_active = true
        AND me.access_revoked = false
        AND public.normalize_role_key(me.role) IN (
          'admin', 'super admin', 'owner', 'principal', 'director'
        )
    ) INTO v_is_admin;

    IF NOT coalesce(v_is_admin, false) THEN
      RAISE EXCEPTION 'Access denied: administrator role required';
    END IF;
  END IF;

  SELECT sh.tenant_id INTO v_target_tenant
  FROM public.section_heads sh
  WHERE sh.id = p_section_head_id;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Section head not found';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_target_tenant <> v_caller_tenant THEN
    RAISE EXCEPTION 'Access denied to section head from different tenant';
  END IF;

  DELETE FROM public.section_heads WHERE id = p_section_head_id;
  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 15. Explicit REVOKE / GRANT on all new functions (no PUBLIC / anon execute)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.normalize_role_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_role_key(text) FROM anon;
REVOKE ALL ON FUNCTION public.default_role_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.default_role_catalog() FROM anon;
REVOKE ALL ON FUNCTION public.get_account_directory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_account_directory() FROM anon;
REVOKE ALL ON FUNCTION public.get_permission_catalogue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_permission_catalogue() FROM anon;
REVOKE ALL ON FUNCTION public.get_roles_with_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_roles_with_permissions() FROM anon;
REVOKE ALL ON FUNCTION public.upsert_custom_role(text, text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_custom_role(text, text, text, text, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.delete_custom_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_custom_role(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_permission_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_permission_profile(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.save_user_permission_overrides(uuid, text[], text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_user_permission_overrides(uuid, text[], text[], text[]) FROM anon;
REVOKE ALL ON FUNCTION public.set_user_access_revoked(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_access_revoked(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.invite_or_create_account(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invite_or_create_account(text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_account_profile(uuid, text, text, text, text, boolean) FROM PUBLIC;
