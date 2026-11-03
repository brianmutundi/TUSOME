-- Fix infinite recursion in profiles RLS admin policies.
-- The policies referenced public.profiles inside their own USING/WITH CHECK.
-- Replace the self-referencing subquery with a SECURITY DEFINER helper.

create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.tenant_id = public.my_tenant_id()
      and me.is_active = true
      and me.access_revoked = false
      and public.normalize_role_key(me.role) in (
        'admin', 'super admin', 'owner', 'principal', 'director'
      )
  );
$function$;

revoke all on function public.is_tenant_admin() from public, anon;
grant execute on function public.is_tenant_admin() to authenticated, service_role;

drop policy if exists profiles_admin_insert on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_admin_delete on public.profiles;

create policy profiles_admin_insert on public.profiles
  for insert with check (tenant_id = public.my_tenant_id() and public.is_tenant_admin());

create policy profiles_admin_update on public.profiles
  for update using (tenant_id = public.my_tenant_id() and public.is_tenant_admin())
  with check (tenant_id = public.my_tenant_id() and public.is_tenant_admin());

create policy profiles_admin_delete on public.profiles
  for delete using (tenant_id = public.my_tenant_id() and public.is_tenant_admin());
