CREATE OR REPLACE FUNCTION public.upsert_teacher_profile(
  p_user_id uuid DEFAULT NULL,
  p_full_name text DEFAULT '',
  p_email text DEFAULT '',
  p_phone text DEFAULT NULL,
  p_initials text DEFAULT NULL,
  p_tsc_number text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_employee_number text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_role text DEFAULT 'teacher',
  p_group_names text[] DEFAULT ARRAY[]::text[],
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $function$
DECLARE
  v_caller_tenant UUID;
  v_role TEXT;
  v_target_id UUID;
  v_target_tenant UUID;
  v_clean_name TEXT;
  v_clean_email TEXT;
  v_clean_initials TEXT;
  v_gname TEXT;
  v_gid UUID;
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
    IF NOT (
      public.user_has_permission(auth.uid(), v_caller_tenant, 'add-teachers')
      OR public.user_has_permission(auth.uid(), v_caller_tenant, 'edit-teacher-profile')
    ) THEN
      RAISE EXCEPTION 'Access denied: administrator or teacher-manager permission required';
    END IF;
  END IF;

  v_clean_name := btrim(coalesce(p_full_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Teacher full name is required';
  END IF;

  v_clean_email := lower(btrim(coalesce(p_email, '')));
  IF v_clean_email = '' OR position('@' IN v_clean_email) = 0 THEN
    RAISE EXCEPTION 'Valid email address is required';
  END IF;

  v_clean_initials := nullif(upper(btrim(coalesce(p_initials, ''))), '');
  IF v_clean_initials IS NOT NULL AND char_length(v_clean_initials) > 12 THEN
    RAISE EXCEPTION 'Teacher initials cannot exceed 12 characters';
  END IF;

  IF p_user_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      WHERE p.tenant_id = v_caller_tenant
        AND lower(coalesce(nullif(btrim(p.email), ''), u.email, '')) = v_clean_email
    ) THEN
      RAISE EXCEPTION 'An account with this email already exists';
    END IF;

    v_target_id := gen_random_uuid();
    v_target_tenant := v_caller_tenant;

    INSERT INTO auth.users (id, email)
    VALUES (v_target_id, v_clean_email);

    INSERT INTO public.profiles (
      id, tenant_id, full_name, email, phone, initials, tsc_number,
      national_id, employee_number, gender, role, staff_type, is_active, access_revoked
    )
    VALUES (
      v_target_id,
      v_caller_tenant,
      v_clean_name,
      v_clean_email,
      nullif(btrim(coalesce(p_phone, '')), ''),
      v_clean_initials,
      nullif(btrim(coalesce(p_tsc_number, '')), ''),
      nullif(btrim(coalesce(p_national_id, '')), ''),
      nullif(btrim(coalesce(p_employee_number, '')), ''),
      nullif(btrim(coalesce(p_gender, '')), ''),
      COALESCE(nullif(btrim(coalesce(p_role, '')), ''), 'teacher'),
      'TEACHER',
      coalesce(p_is_active, true),
      false
    );
  ELSE
    SELECT p.tenant_id INTO v_target_tenant
    FROM public.profiles p
    WHERE p.id = p_user_id;

    IF v_target_tenant IS NULL THEN
      RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_role IS DISTINCT FROM 'service_role' AND v_target_tenant <> v_caller_tenant THEN
      RAISE EXCEPTION 'Access denied to account from different tenant';
    END IF;

    -- Prevent self-role-change
    IF v_role IS DISTINCT FROM 'service_role' AND p_user_id = auth.uid() AND p_role IS NOT NULL AND btrim(p_role) <> '' THEN
      IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id AND public.normalize_role_key(p.role) <> public.normalize_role_key(p_role)) THEN
        RAISE EXCEPTION 'Cannot change your own role';
      END IF;
    END IF;

    v_target_id := p_user_id;

    UPDATE public.profiles
    SET
      full_name       = v_clean_name,
      email           = v_clean_email,
      phone           = nullif(btrim(coalesce(p_phone, '')), ''),
      initials        = v_clean_initials,
      tsc_number      = nullif(btrim(coalesce(p_tsc_number, '')), ''),
      national_id     = nullif(btrim(coalesce(p_national_id, '')), ''),
      employee_number = nullif(btrim(coalesce(p_employee_number, '')), ''),
      gender          = nullif(btrim(coalesce(p_gender, '')), ''),
      role            = COALESCE(nullif(btrim(coalesce(p_role, '')), ''), role),
      is_active       = coalesce(p_is_active, is_active)
    WHERE id = v_target_id
      AND tenant_id = v_target_tenant;

    UPDATE auth.users SET email = v_clean_email WHERE id = v_target_id;
  END IF;

  -- Sync group memberships when p_group_names is provided.
  DELETE FROM public.staff_group_members WHERE user_id = v_target_id;

  IF p_group_names IS NOT NULL THEN
    FOREACH v_gname IN ARRAY p_group_names LOOP
      IF btrim(coalesce(v_gname, '')) <> '' THEN
        INSERT INTO public.staff_groups (tenant_id, name, staff_type)
        VALUES (v_target_tenant, btrim(v_gname), 'TEACHER')
        ON CONFLICT (tenant_id, staff_type, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_gid;

        INSERT INTO public.staff_group_members (group_id, user_id)
        VALUES (v_gid, v_target_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_target_id;
END;
$function$;

