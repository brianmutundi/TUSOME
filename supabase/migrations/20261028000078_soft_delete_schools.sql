create or replace function public.delete_school(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid;
begin
  if public.normalize_role_key(coalesce(public.get_user_permission_profile(auth.uid()) ->> 'role', '')) <> 'super admin' then
    raise exception 'Only platform super admins can delete schools' using errcode = '42501';
  end if;
  select id into v_owner
  from public.profiles
  where tenant_id = p_tenant_id
    and public.normalize_role_key(role) = 'owner'
  limit 1;
  -- soft delete
  update public.tenants set deleted_at = now(), deleted_by = auth.uid() where id = p_tenant_id;
  -- audit event
  insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, after_values)
  values (p_tenant_id, auth.uid(), 'soft_delete_school', 'tenant', p_tenant_id, jsonb_build_object('deleted_at', now()));
  return v_owner;
end;
$function$;

revoke all on function public.delete_school(uuid) from public, anon;
grant execute on function public.delete_school(uuid) to authenticated, service_role;

-- Restore function
create or replace function public.restore_school(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if public.normalize_role_key(coalesce(public.get_user_permission_profile(auth.uid()) ->> 'role', '')) <> 'super admin' then
    raise exception 'Only platform super admins can restore schools' using errcode = '42501';
  end if;
  update public.tenants set deleted_at = null, deleted_by = null where id = p_tenant_id;
  insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, after_values)
  values (p_tenant_id, auth.uid(), 'restore_school', 'tenant', p_tenant_id, jsonb_build_object('restored_at', now()));
end;
$function$;

revoke all on function public.restore_school(uuid) from public, anon;
grant execute on function public.restore_school(uuid) to authenticated, service_role;
create or replace function public.purge_school(p_tenant_id uuid, p_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $func$
begin
  if public.normalize_role_key(coalesce(public.get_user_permission_profile(auth.uid()) ->> 'role', '')) <> 'super admin' then
    raise exception 'Only platform super admins can purge schools' using errcode = '42501';
  end if;
  if p_confirmation <> 'PURGE' then
    raise exception 'Confirmation must be PURGE';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and deleted_at is not null and deleted_at < now() - interval '30 days') then
    raise exception 'School not found or restore window not expired';
  end if;
  insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, after_values)
  values (p_tenant_id, auth.uid(), 'purge_school', 'tenant', p_tenant_id, jsonb_build_object('purged_at', now()));
  delete from public.tenants where id = p_tenant_id;
end;
$func$;

revoke all on function public.purge_school(uuid, text) from public, anon;
grant execute on function public.purge_school(uuid, text) to authenticated, service_role;

create or replace function public.restore_school(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $func$
begin
  if public.normalize_role_key(coalesce(public.get_user_permission_profile(auth.uid()) ->> 'role', '')) <> 'super admin' then
    raise exception 'Only platform super admins can restore schools' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id and deleted_at is not null and deleted_at > now() - interval '30 days') then
    raise exception 'School not found or restore window expired';
  end if;
  update public.tenants set deleted_at = null, deleted_by = null where id = p_tenant_id;
  insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, after_values)
  values (p_tenant_id, auth.uid(), 'restore_school', 'tenant', p_tenant_id, jsonb_build_object('restored_at', now()));
end;
$func$;

revoke all on function public.restore_school(uuid) from public, anon;
grant execute on function public.restore_school(uuid) to authenticated, service_role;

create or replace function public.get_schools()
returns table (id uuid, name text, created_at timestamptz, owner_email text, owner_name text, subscription_status text, subscription_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $func$
begin
  if public.normalize_role_key(coalesce(public.get_user_permission_profile(auth.uid()) ->> 'role', '')) <> 'super admin' then
    raise exception 'Only platform super admins can list schools' using errcode = '42501';
  end if;
  return query
  select t.id, t.name, t.created_at, u.email::text, p.full_name, t.subscription_status, t.subscription_expires_at
  from public.tenants t
  left join public.profiles p on p.tenant_id = t.id and public.normalize_role_key(p.role) = 'owner'
  left join auth.users u on u.id = p.id
  where t.deleted_at is null
  order by t.created_at desc;
end;
$func$;

revoke all on function public.get_schools() from public, anon;
grant execute on function public.get_schools() to authenticated, service_role;

