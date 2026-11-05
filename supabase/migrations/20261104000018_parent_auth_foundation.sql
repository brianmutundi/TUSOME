-- 20261104000018_parent_auth_foundation.sql
--
-- Parent Portal Phase 1 — Auth foundation
--
-- 1. tenants.code  — short slug for school login form
-- 2. profiles.language_pref  — 'en' | 'sw'
-- 3. parent_student_links extended:
--      revoked_at, can_view_academics, can_view_fees,
--      can_view_attendance, can_view_health, can_message_school
-- 4. assert_parent_of extended to accept optional p_right
-- 5. get_tenant_by_code  — anon-safe RPC (name, logo, colors only)
-- 6. parent_login_rate_limit  — per-phone brute-force tracking
-- 7. parent_access_requests  — "can't sign in?" form submissions
-- 8. parent_notice_reads  — read receipts for notices
-- 9. parent_consent_records  — ODPC first-login consent log

-- ---------------------------------------------------------------------------
-- 1. tenants.code
-- ---------------------------------------------------------------------------
alter table public.tenants add column if not exists code text unique;
alter table public.tenants add column if not exists logo_url text;
alter table public.tenants add column if not exists primary_color text;

-- ---------------------------------------------------------------------------
-- 2. profiles.language_pref
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists language_pref text not null default 'en'
  check (language_pref in ('en', 'sw'));

alter table public.profiles
  add column if not exists individual_override boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. parent_student_links extensions
-- ---------------------------------------------------------------------------
alter table public.parent_student_links
  add column if not exists revoked_at timestamptz,
  add column if not exists can_view_academics boolean not null default true,
  add column if not exists can_view_fees boolean not null default true,
  add column if not exists can_view_attendance boolean not null default true,
  add column if not exists can_view_health boolean not null default true,
  add column if not exists can_message_school boolean not null default true;

-- Sponsors get fees only by default; apply retroactively.
update public.parent_student_links
set
  can_view_academics = false,
  can_view_attendance = false,
  can_view_health = false,
  can_message_school = false
where relationship = 'sponsor'
  and can_view_academics = true; -- only if still at default

-- ---------------------------------------------------------------------------
-- 4. assert_parent_of — extended with optional right check
-- ---------------------------------------------------------------------------
drop function if exists public.assert_parent_of(uuid);

create or replace function public.assert_parent_of(
  p_student_id uuid,
  p_right      text default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_role            text;
  v_caller_tenant   uuid;
  v_student_tenant  uuid;
  v_link            record;
begin
  select s.tenant_id into v_student_tenant
  from public.students s where s.id = p_student_id;

  if v_student_tenant is null then
    raise exception 'Student not found';
  end if;

  begin v_role := auth.role(); exception when others then v_role := null; end;

  if v_role = 'service_role' then
    return v_student_tenant;
  end if;

  begin
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_caller_tenant := null;
  end;

  if v_caller_tenant is null then
    raise exception 'Missing tenant claim';
  end if;

  if v_student_tenant <> v_caller_tenant then
    raise exception 'Student not found';
  end if;

  select psl.*
  into v_link
  from public.parent_student_links psl
  join public.profiles p on p.id = psl.parent_id
  where psl.parent_id    = auth.uid()
    and psl.student_id   = p_student_id
    and psl.tenant_id    = v_caller_tenant
    and psl.revoked_at   is null
    and p.tenant_id      = v_caller_tenant
    and p.is_active      = true
    and p.access_revoked = false
    and public.normalize_role_key(p.role) = 'parent'
  limit 1;

  if not found then
    raise exception 'Student not found';
  end if;

  if p_right is not null then
    if p_right = 'can_view_academics'  and not v_link.can_view_academics  then
      raise exception 'Access denied' using errcode = '42501';
    end if;
    if p_right = 'can_view_fees'       and not v_link.can_view_fees       then
      raise exception 'Access denied' using errcode = '42501';
    end if;
    if p_right = 'can_view_attendance' and not v_link.can_view_attendance then
      raise exception 'Access denied' using errcode = '42501';
    end if;
    if p_right = 'can_view_health'     and not v_link.can_view_health     then
      raise exception 'Access denied' using errcode = '42501';
    end if;
    if p_right = 'can_message_school'  and not v_link.can_message_school  then
      raise exception 'Access denied' using errcode = '42501';
    end if;
  end if;

  return v_student_tenant;
end;
$function$;

revoke all on function public.assert_parent_of(uuid, text) from public, anon;
grant execute on function public.assert_parent_of(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. get_tenant_by_code — anon-safe, returns only display fields
-- ---------------------------------------------------------------------------
create or replace function public.get_tenant_by_code(p_code text)
returns table(
  tenant_id     uuid,
  tenant_name   text,
  logo_url      text,
  primary_color text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  return query
  select
    t.id,
    t.name,
    t.logo_url,
    t.primary_color
  from public.tenants t
  where t.code = lower(trim(p_code))
    and coalesce(t.deleted_at::text, '') = ''
  limit 1;
end;
$function$;

revoke all on function public.get_tenant_by_code(text) from public;
grant execute on function public.get_tenant_by_code(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. parent_login_rate_limit
-- ---------------------------------------------------------------------------
create table if not exists public.parent_login_rate_limit (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  phone        text not null,
  failed_at    timestamptz not null default now(),
  locked_until timestamptz
);

create index if not exists parent_login_rate_limit_phone_idx
  on public.parent_login_rate_limit (tenant_id, phone, failed_at);

alter table public.parent_login_rate_limit enable row level security;

drop policy if exists parent_login_rate_limit_service on public.parent_login_rate_limit;
create policy parent_login_rate_limit_service on public.parent_login_rate_limit
  for all using (true) with check (true);
-- Only service_role touches this table (via server action).
revoke all on public.parent_login_rate_limit from public, anon, authenticated;
grant all on public.parent_login_rate_limit to service_role;

-- ---------------------------------------------------------------------------
-- 7. parent_access_requests
-- ---------------------------------------------------------------------------
create table if not exists public.parent_access_requests (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid references public.tenants(id) on delete cascade,
  requester_name   text not null,
  admission_no     text,
  phone            text,
  message          text,
  ip               text,
  status           text not null default 'pending'
                   check (status in ('pending', 'resolved', 'dismissed')),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles(id)
);

create index if not exists parent_access_requests_tenant_idx
  on public.parent_access_requests (tenant_id, status, created_at desc);

alter table public.parent_access_requests enable row level security;

-- Staff with access-students can see requests for their tenant.
drop policy if exists parent_access_requests_staff on public.parent_access_requests;
create policy parent_access_requests_staff on public.parent_access_requests
  for select using (tenant_id = public.my_tenant_id());

-- Service role only for insert (rate-limited server action).
grant select on public.parent_access_requests to authenticated;
grant all    on public.parent_access_requests to service_role;

-- ---------------------------------------------------------------------------
-- 8. parent_notice_reads
-- ---------------------------------------------------------------------------
create table if not exists public.parent_notice_reads (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  notice_id uuid not null,  -- references notices.id; no FK to avoid circular dep
  read_at   timestamptz not null default now(),
  unique (parent_id, notice_id)
);

alter table public.parent_notice_reads enable row level security;

drop policy if exists parent_notice_reads_own on public.parent_notice_reads;
create policy parent_notice_reads_own on public.parent_notice_reads
  for all
  using  (parent_id = auth.uid())
  with check (parent_id = auth.uid());

grant select, insert, update on public.parent_notice_reads to authenticated;
grant all                     on public.parent_notice_reads to service_role;

-- ---------------------------------------------------------------------------
-- 9. parent_consent_records
-- ---------------------------------------------------------------------------
create table if not exists public.parent_consent_records (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references public.profiles(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  version    text not null,          -- e.g. '2026-11-04'
  accepted_at timestamptz not null default now(),
  ip         text,
  unique (parent_id, version)
);

alter table public.parent_consent_records enable row level security;

drop policy if exists parent_consent_records_own on public.parent_consent_records;
create policy parent_consent_records_own on public.parent_consent_records
  for all
  using  (parent_id = auth.uid())
  with check (parent_id = auth.uid());

grant select, insert on public.parent_consent_records to authenticated;
grant all            on public.parent_consent_records to service_role;
