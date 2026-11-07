-- PD-1: permission-based gating for role/permission management writes.
-- Replaces the role-name allowlist with a check on the permission code,
-- so a role that does not hold can-manage-user-permissions (e.g. director)
-- cannot grant permissions it does not itself possess.

create or replace function public.effective_permission_codes(p_user_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_prof jsonb;
begin
  if p_user_id is null then
    return array[]::text[];
  end if;
  v_prof := public.get_user_permission_profile(p_user_id);
  return coalesce(
    (select array_agg(x) from jsonb_array_elements_text(v_prof -> 'effective_permissions') as t(x)),
    array[]::text[]
  );
end;
$function$;

revoke all on function public.effective_permission_codes(uuid) from public, anon;
grant execute on function public.effective_permission_codes(uuid) to authenticated, service_role;

-- role_permissions write policy
drop policy if exists role_permissions_tenant_write on public.role_permissions;
create policy role_permissions_tenant_write on public.role_permissions
  for all
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and r.tenant_id = public.my_tenant_id()
    )
    and 'can-manage-user-permissions' = any(public.effective_permission_codes(auth.uid()))
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and r.tenant_id = public.my_tenant_id()
    )
    and 'can-manage-user-permissions' = any(public.effective_permission_codes(auth.uid()))
  );

-- user_permissions write policy
drop policy if exists user_permissions_tenant_write on public.user_permissions;
create policy user_permissions_tenant_write on public.user_permissions
  for all
  using (
    tenant_id = public.my_tenant_id()
    and 'can-manage-user-permissions' = any(public.effective_permission_codes(auth.uid()))
  )
  with check (
    tenant_id = public.my_tenant_id()
    and 'can-manage-user-permissions' = any(public.effective_permission_codes(auth.uid()))
  );
