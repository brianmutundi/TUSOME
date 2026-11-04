-- Statement share tokens (hashed, 7-day default, revocable, rate-limited).
create table if not exists public.statement_share_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  term text,
  academic_year integer,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.statement_share_tokens enable row level security;

drop policy if exists statement_share_tokens_none on public.statement_share_tokens;
create policy statement_share_tokens_none on public.statement_share_tokens
  for all using (false) with check (false);

grant select, insert, update, delete on public.statement_share_tokens to service_role;

-- create_statement_share_token
create or replace function public.create_statement_share_token(
  p_student_id uuid,
  p_term text default null,
  p_academic_year integer default null,
  p_expires_days integer default 7
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_token text;
  v_hash text;
  v_days integer := greatest(coalesce(p_expires_days, 7), 1);
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null then raise exception 'Student not found'; end if;
  if not (public.user_has_permission(v_uid, v_tenant, 'manage-fees') or public.user_has_permission(v_uid, v_tenant, 'view-fees')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_token := encode(extensions.gen_random_bytes(8), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.statement_share_tokens (tenant_id, student_id, term, academic_year, token_hash, expires_at)
  values (v_tenant, p_student_id, p_term, p_academic_year, v_hash, now() + (v_days || ' days')::interval);

  return v_token;
end;
$function$;

revoke all on function public.create_statement_share_token(uuid, text, integer, integer) from public, anon;
grant execute on function public.create_statement_share_token(uuid, text, integer, integer) to authenticated, service_role;

-- get_statement_by_token
create or replace function public.get_statement_by_token(p_token text, p_ip text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_hash text;
  v_row record;
  v_recent int;
  v_student record;
  v_tenant record;
  v_term text;
  v_year integer;
begin
  if p_token is null or length(p_token) = 0 then
    raise exception 'Invalid token';
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select count(*) into v_recent
  from public.receipt_token_access_log
  where token_hash = v_hash
    and accessed_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Rate limit exceeded' using errcode = 'P0001';
  end if;
  insert into public.receipt_token_access_log (token_hash, ip) values (v_hash, p_ip);

  select * into v_row
  from public.statement_share_tokens
  where token_hash = v_hash
    and revoked = false
    and expires_at > now();
  if not found then
    raise exception 'Invalid or expired link';
  end if;

  select * into v_student from public.students where id = v_row.student_id;
  select * into v_tenant from public.tenants where id = v_row.tenant_id;

  v_term := v_row.term;
  v_year := v_row.academic_year;

  return jsonb_build_object(
    'student', jsonb_build_object(
      'id', v_student.id,
      'full_name', v_student.full_name,
      'admission_no', v_student.admission_no,
      'class_name', (select name from public.classes where id = v_student.class_id)
    ),
    'school', jsonb_build_object(
      'name', v_tenant.name,
      'logo_url', v_tenant.logo_url,
      'motto', v_tenant.motto,
      'county', v_tenant.county,
      'region', v_tenant.region,
      'country', v_tenant.country,
      'contact_phone', v_tenant.contact_phone,
      'contact_email', v_tenant.contact_email
    ),
    'term', v_term,
    'academic_year', v_year,
    'expires_at', v_row.expires_at
  );
end;
$function$;

revoke all on function public.get_statement_by_token(text, text) from public, anon;
grant execute on function public.get_statement_by_token(text, text) to anon, authenticated, service_role;

-- revoke_statement_share_token
create or replace function public.revoke_statement_share_token(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_tenant uuid;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select tenant_id into v_tenant from public.statement_share_tokens where token_hash = v_hash;
  if v_tenant is null then return false; end if;
  if not (public.user_has_permission(v_uid, v_tenant, 'manage-fees') or public.user_has_permission(v_uid, v_tenant, 'view-fees')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.statement_share_tokens set revoked = true where token_hash = v_hash;
  return true;
end;
$function$;

revoke all on function public.revoke_statement_share_token(text) from public, anon;
grant execute on function public.revoke_statement_share_token(text) to authenticated, service_role;
