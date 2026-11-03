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
