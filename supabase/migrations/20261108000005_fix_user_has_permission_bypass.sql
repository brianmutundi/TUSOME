-- Remove 'director' from the admin bypass in user_has_permission.
-- Directors hold a limited permission set; they must not auto-pass every
-- permission check (PD-1). Admin/principal/owner/super admin retain bypass.

create or replace function public.user_has_permission(p_user_id uuid, p_tenant_id uuid, p_permission_code text)
returns boolean
language plpgsql
stable
as $function$
declare
  v_me record;
  v_prof jsonb;
begin
  if p_user_id is null or p_tenant_id is null then
    return false;
  end if;

  select p.id, p.role, p.is_active, p.access_revoked
  into v_me
  from public.profiles p
  where p.id = p_user_id
    and p.tenant_id = p_tenant_id;

  if v_me.id is null or not v_me.is_active or v_me.access_revoked then
    return false;
  end if;

  if public.normalize_role_key(v_me.role) in (
    'admin', 'super admin', 'owner', 'principal'
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.tenant_id = p_tenant_id
      and public.normalize_role_key(ur.role_key) in (
        'admin', 'super admin', 'owner', 'principal'
      )
  ) then
    return true;
  end if;

  v_prof := public.get_user_permission_profile(p_user_id);
  return coalesce((v_prof -> 'effective_permissions') ? p_permission_code, false);
end;
$function$;
