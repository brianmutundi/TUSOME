-- Parent notices: replace the broken get_my_notices and harden read receipts.
--
-- Defects found in 20261104000019_parent_portal_rpcs.sql (not edited; fixed forward here):
--   1. get_my_notices selected n.audience, n.is_urgent and n.target_class_id.
--      public.notices has none of them (it has target_audience and notice_type).
--      plpgsql does not check column names at CREATE time, so it deployed and
--      would fail on every call. The portal therefore kept using get_notices,
--      which has no is_published filter and lets parents read drafts.
--   2. mark_notices_read accepted any uuid, including notices of other tenants
--      or drafts.
--   3. parent_notice_reads gave authenticated direct insert/select grants, so a
--      parent could write to it without the RPC.
--
-- Result: get_my_notices returns only published, unexpired notices of the
-- caller's tenant whose audience is all or parents, with a server-side read flag.
-- Notices have no class targeting column, so none is applied.
-- Not run against a database here.

drop function if exists public.get_my_notices(integer, uuid);

create or replace function public.get_my_notices(
  p_limit  integer default 30,
  p_before uuid    default null
)
returns table(
  notice_id       uuid,
  title           text,
  content         text,
  notice_type     text,
  target_audience text,
  published_at    timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz,
  is_read         boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
  v_before timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;
  if v_tenant is null then
    raise exception 'Missing tenant claim';
  end if;

  -- Same caller check as get_my_children: an active parent account in this tenant.
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.tenant_id = v_tenant
      and p.is_active = true
      and p.access_revoked = false
      and public.normalize_role_key(p.role) = 'parent'
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_before is not null then
    select coalesce(n2.published_at, n2.created_at) into v_before
    from public.notices n2
    where n2.id = p_before and n2.tenant_id = v_tenant;
  end if;

  return query
  select
    n.id,
    n.title,
    n.content,
    n.notice_type,
    n.target_audience,
    n.published_at,
    n.expires_at,
    n.created_at,
    exists (
      select 1
      from public.parent_notice_reads r
      where r.parent_id = auth.uid()
        and r.notice_id = n.id
    ) as is_read
  from public.notices n
  where n.tenant_id = v_tenant
    and n.is_published = true
    and (n.expires_at is null or n.expires_at > now())
    and n.target_audience in ('all', 'parents')
    and (v_before is null or coalesce(n.published_at, n.created_at) < v_before)
  order by coalesce(n.published_at, n.created_at) desc, n.id
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$function$;

revoke all on function public.get_my_notices(integer, uuid) from public, anon;
grant execute on function public.get_my_notices(integer, uuid) to authenticated, service_role;

-- Same name and signature as before so existing grants keep working; now it
-- records only notices the caller is actually allowed to see.
create or replace function public.mark_notices_read(p_notice_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;
  if v_tenant is null then
    raise exception 'Missing tenant claim';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.tenant_id = v_tenant
      and p.is_active = true
      and p.access_revoked = false
      and public.normalize_role_key(p.role) = 'parent'
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.parent_notice_reads (tenant_id, parent_id, notice_id)
  select v_tenant, auth.uid(), n.id
  from public.notices n
  where n.id = any (coalesce(p_notice_ids, '{}'::uuid[]))
    and n.tenant_id = v_tenant
    and n.is_published = true
    and n.target_audience in ('all', 'parents')
  on conflict (parent_id, notice_id) do nothing;
end;
$function$;

revoke all on function public.mark_notices_read(uuid[]) from public, anon;
grant execute on function public.mark_notices_read(uuid[]) to authenticated, service_role;

-- Parents reach read receipts only through the RPCs above.
revoke all on public.parent_notice_reads from anon, authenticated;
grant all on public.parent_notice_reads to service_role;

drop policy if exists parent_block on public.parent_notice_reads;
create policy parent_block on public.parent_notice_reads
  as restrictive for all to authenticated
  using ((select not public.is_parent()))
  with check ((select not public.is_parent()));
