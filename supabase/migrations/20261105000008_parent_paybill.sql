-- Parent M-Pesa paybill instructions (slice 3, phase A: instructions only).
--
-- No paybill field exists in any earlier migration. The only per-school settings
-- row in the repository is public.tenants (school profile, 20261028000012), so the
-- paybill number is added there as one nullable column. If the real database keeps
-- school settings elsewhere, move this column and the two reads below.
--
-- Parents cannot read tenants directly, so get_my_child_paybill is the parent entry
-- point: assert_parent_of(student, 'can_view_fees') then it returns the school's paybill and the
-- child's admission number as the account number. Both come from rows in the
-- caller's own tenant. No STK push, no Daraja, no payment is initiated here.
--
-- Staff set the number through set_school_paybill (permission edit-school-profile,
-- same as update_school_profile). update_school_profile and get_school_profile are
-- left untouched (fix forward, no edits to old migrations).
-- Columns used: tenants.id/name/mpesa_paybill, students.id/tenant_id/admission_no
-- (admission_no is already used by get_my_children). Not run against a database here.

alter table public.tenants
  add column if not exists mpesa_paybill text;

alter table public.tenants
  drop constraint if exists tenants_mpesa_paybill_format;
alter table public.tenants
  add constraint tenants_mpesa_paybill_format
  check (mpesa_paybill is null or mpesa_paybill ~ '^[0-9]{5,7}$');

create or replace function public.get_my_child_paybill(p_student_id uuid)
returns table(
  paybill_number text,
  account_number text,
  school_name    text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_fees');

  return query
  select
    t.mpesa_paybill   as paybill_number,
    s.admission_no    as account_number,
    t.name            as school_name
  from public.students s
  join public.tenants t on t.id = s.tenant_id
  where s.id = p_student_id
    and s.tenant_id = v_tenant;
end;
$function$;

revoke all on function public.get_my_child_paybill(uuid) from public, anon;
grant execute on function public.get_my_child_paybill(uuid) to authenticated, service_role;

create or replace function public.get_school_paybill()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_paybill       text;
begin
  begin
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_caller_tenant := null;
  end;
  if v_caller_tenant is null then
    raise exception 'Missing tenant claim';
  end if;
  if not public.user_has_permission(auth.uid(), v_caller_tenant, 'edit-school-profile') then
    raise exception 'Access denied: edit-school-profile permission required' using errcode = '42501';
  end if;

  select t.mpesa_paybill into v_paybill
  from public.tenants t
  where t.id = v_caller_tenant;

  return v_paybill;
end;
$function$;

revoke all on function public.get_school_paybill() from public, anon;
grant execute on function public.get_school_paybill() to authenticated, service_role;

create or replace function public.set_school_paybill(p_paybill text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_clean         text;
begin
  begin
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_caller_tenant := null;
  end;
  if v_caller_tenant is null then
    raise exception 'Missing tenant claim';
  end if;
  if not public.user_has_permission(auth.uid(), v_caller_tenant, 'edit-school-profile') then
    raise exception 'Access denied: edit-school-profile permission required' using errcode = '42501';
  end if;

  -- Empty input clears the number.
  v_clean := nullif(regexp_replace(coalesce(p_paybill, ''), '\s', '', 'g'), '');
  if v_clean is not null and v_clean !~ '^[0-9]{5,7}$' then
    raise exception 'Paybill must be 5 to 7 digits';
  end if;

  update public.tenants t
  set mpesa_paybill = v_clean
  where t.id = v_caller_tenant;

  return v_clean;
end;
$function$;

revoke all on function public.set_school_paybill(text) from public, anon;
grant execute on function public.set_school_paybill(text) to authenticated, service_role;
