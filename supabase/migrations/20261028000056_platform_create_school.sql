-- Platform super admins create a school (tenant) and its first owner profile.
-- The auth user is created by the /api/schools route (needs the service role);
-- this function does the tenant + profile inserts in one transaction.

CREATE OR REPLACE FUNCTION public.platform_create_school(
  p_name TEXT,
  p_owner_user_id UUID,
  p_owner_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_profile JSONB;
  v_tenant UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  v_profile := public.get_user_permission_profile(v_uid);
  IF public.normalize_role_key(v_profile ->> 'role') <> 'super admin'
     OR NOT COALESCE((v_profile ->> 'is_active')::boolean, false) THEN
    RAISE EXCEPTION 'Only a platform super admin can create schools' USING ERRCODE = '42501';
  END IF;

  IF btrim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'School name is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_owner_user_id) THEN
    RAISE EXCEPTION 'Owner user not found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_user_id) THEN
    RAISE EXCEPTION 'That user already belongs to a school';
  END IF;

  INSERT INTO public.tenants (name) VALUES (btrim(p_name)) RETURNING id INTO v_tenant;

  INSERT INTO public.profiles (id, tenant_id, full_name, role, is_active)
  VALUES (p_owner_user_id, v_tenant, NULLIF(btrim(COALESCE(p_owner_name, '')), ''), 'owner', true);

  RETURN v_tenant;
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_create_school(TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_create_school(TEXT, UUID, TEXT) TO authenticated, service_role;
