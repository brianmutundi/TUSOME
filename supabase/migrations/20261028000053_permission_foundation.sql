-- 20261028000053_permission_foundation.sql
--
-- Audit findings B, C and F (see CONTINUATION_AUDIT.md).
--
-- 1. assert_permission(): reusable guard for RPCs. Raises unless the caller
--    holds the permission. service_role skips the check.
-- 2. get_my_permissions(): the caller's own effective permissions, so the
--    client can gate navigation and buttons. Needs no permission itself.
-- 3. link_parent_student(): now requires 'edit-student-profile', and checks
--    that the student and the parent profile both belong to the caller's
--    tenant and that the profile has the parent role.
-- 4. audit_events: direct INSERT by signed-in users is removed. Rows can only
--    be written through log_audit_event (SECURITY DEFINER), which already
--    takes the actor from auth.uid().
--
-- Not run against a database here. Run the SQL tests before applying.

-- ---------------------------------------------------------------------------
-- 1. assert_permission
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_permission(p_permission text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_role TEXT;
  v_caller_tenant UUID;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role = 'service_role' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;

  IF v_caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF NOT public.user_has_permission(auth.uid(), v_caller_tenant, p_permission) THEN
    RAISE EXCEPTION 'Access denied: permission % required', p_permission;
  END IF;

  RETURN v_caller_tenant;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_permission(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. get_my_permissions
-- ---------------------------------------------------------------------------
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

  v_profile := public.get_user_permission_profile(v_uid);

  v_is_admin := public.normalize_role_key(v_profile ->> 'role') IN (
    'admin', 'super admin', 'owner', 'principal', 'director'
  ) AND COALESCE((v_profile ->> 'is_active')::boolean, false)
    AND NOT COALESCE((v_profile ->> 'access_revoked')::boolean, true);

  -- Admin-type roles pass every check in user_has_permission, so report the
  -- whole catalogue for them. Everyone else gets the computed list.
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

-- ---------------------------------------------------------------------------
-- 3. link_parent_student
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_parent_student(
  p_parent_id uuid,
  p_student_id uuid,
  p_relationship text DEFAULT 'parent',
  p_is_primary boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_tenant UUID;
  v_parent_role TEXT;
  v_link_id UUID;
BEGIN
  BEGIN
    v_role := auth.role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  v_caller_tenant := public.assert_permission('edit-student-profile');

  IF v_role = 'service_role' THEN
    SELECT s.tenant_id INTO v_tenant FROM public.students s WHERE s.id = p_student_id;
  ELSE
    v_tenant := v_caller_tenant;
  END IF;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Missing tenant claim';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = p_student_id AND s.tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  SELECT p.role INTO v_parent_role
  FROM public.profiles p
  WHERE p.id = p_parent_id AND p.tenant_id = v_tenant;

  IF v_parent_role IS NULL THEN
    RAISE EXCEPTION 'Parent account not found';
  END IF;

  IF public.normalize_role_key(v_parent_role) <> 'parent' THEN
    RAISE EXCEPTION 'Account is not a parent account';
  END IF;

  INSERT INTO public.parent_student_links (tenant_id, parent_id, student_id, relationship, is_primary)
  VALUES (v_tenant, p_parent_id, p_student_id, p_relationship, p_is_primary)
  ON CONFLICT (parent_id, student_id) DO UPDATE SET
    relationship = EXCLUDED.relationship,
    is_primary = EXCLUDED.is_primary
  RETURNING id INTO v_link_id;

  RETURN v_link_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_parent_student(uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_parent_student(uuid, uuid, text, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. audit_events: writes only through log_audit_event
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
REVOKE INSERT ON public.audit_events FROM authenticated;
