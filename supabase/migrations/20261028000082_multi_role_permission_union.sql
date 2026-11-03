-- Batch 3 completion: effective permissions = UNION of primary role + user_roles.
-- Also fixes rls_auto_enable search_path to ''.

alter function public.rls_auto_enable() set search_path = '';

-- Resolve the permission set for one role in one tenant (custom tenant role wins,
-- otherwise built-in catalog). SECURITY INVOKER: reads only catalog/role tables.
create or replace function public.role_permissions_for(p_tenant_id uuid, p_role_key text)
returns text[]
language sql
stable
as $function$
  select coalesce(
    (
      select case
        when r.id is not null and (r.permissions_customized or b.role_key is null) then
          (select array_agg(rp.permission_code order by rp.permission_code)
           from public.role_permissions rp
           join public.permissions pm on pm.code = rp.permission_code
           where rp.role_id = r.id)
        when b.role_key is not null then b.default_permissions
        else null
      end
      from (select public.normalize_role_key(p_role_key) as rk) k
      left join public.roles r on r.tenant_id = p_tenant_id and r."key" = k.rk
      left join public.default_role_catalog() b on b.role_key = k.rk
    ),
    array[]::text[]
  );
$function$;

create or replace function public.get_user_permission_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_target record;
  v_role_key text;
  v_role_perms text[];
  v_granted text[];
  v_denied text[];
  v_effective text[];
begin
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;

  if v_role is distinct from 'service_role' then
    begin
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    exception when others then
      v_caller_tenant := null;
    end;

    if v_caller_tenant is null then
      raise exception 'Missing tenant claim';
    end if;
  end if;

  select
    p.id,
    p.tenant_id,
    p.full_name,
    coalesce(nullif(btrim(p.email), ''), u.email) as email,
    p.role,
    coalesce(
      p.staff_type,
      case
        when public.normalize_role_key(p.role) = 'teacher' then 'TEACHER'
        when public.normalize_role_key(p.role) in ('worker', 'secretary', 'messenger', 'librarian') then 'WORKER'
        else 'OFFICIAL'
      end
    ) as staff_type,
    p.is_active,
    p.access_revoked
  into v_target
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id;

  if v_target.id is null then
    raise exception 'Account not found';
  end if;

  if v_role is distinct from 'service_role' and v_target.tenant_id <> v_caller_tenant then
    raise exception 'Access denied to account from different tenant';
  end if;

  v_role_key := public.normalize_role_key(v_target.role);

  -- UNION of primary role permissions and every additional role in user_roles.
  select coalesce(array_agg(distinct perm order by perm), array[]::text[])
  into v_role_perms
  from (
    select unnest(public.role_permissions_for(v_target.tenant_id, v_role_key)) as perm
    union
    select unnest(public.role_permissions_for(v_target.tenant_id, ur.role_key)) as perm
    from public.user_roles ur
    where ur.user_id = v_target.id
      and ur.tenant_id = v_target.tenant_id
  ) s;

  v_role_perms := coalesce(v_role_perms, array[]::text[]);

  select
    coalesce(array_agg(up.permission_code order by up.permission_code) filter (where up.effect = 'GRANT'), array[]::text[]),
    coalesce(array_agg(up.permission_code order by up.permission_code) filter (where up.effect = 'DENY'),  array[]::text[])
  into v_granted, v_denied
  from public.user_permissions up
  where up.user_id = v_target.id
    and up.tenant_id = v_target.tenant_id;

  if v_target.access_revoked or not v_target.is_active then
    v_effective := array[]::text[];
  else
    select coalesce(array_agg(pm.code order by pm.sort_order, pm.code), array[]::text[])
    into v_effective
    from public.permissions pm
    where (pm.code = any(v_role_perms) or pm.code = any(v_granted))
      and not (pm.code = any(v_denied));
  end if;

  return jsonb_build_object(
    'account_id',            v_target.id,
    'full_name',             v_target.full_name,
    'email',                 v_target.email,
    'role',                  v_target.role,
    'staff_type',            v_target.staff_type,
    'is_active',             v_target.is_active,
    'access_revoked',        v_target.access_revoked,
    'role_permissions',      to_jsonb(v_role_perms),
    'granted_overrides',     to_jsonb(v_granted),
    'denied_overrides',      to_jsonb(v_denied),
    'effective_permissions', to_jsonb(v_effective)
  );
end;
$function$;

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

  -- Admin bypass applies if ANY assigned role (primary or junction) is admin-level.
  if public.normalize_role_key(v_me.role) in (
    'admin', 'super admin', 'owner', 'principal', 'director'
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.tenant_id = p_tenant_id
      and public.normalize_role_key(ur.role_key) in (
        'admin', 'super admin', 'owner', 'principal', 'director'
      )
  ) then
    return true;
  end if;

  v_prof := public.get_user_permission_profile(p_user_id);
  return coalesce((v_prof -> 'effective_permissions') ? p_permission_code, false);
end;
$function$;
