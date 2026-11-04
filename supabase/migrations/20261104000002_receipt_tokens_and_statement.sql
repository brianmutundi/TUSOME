-- Receipt share tokens (hashed), rate-limit log, guardian contacts RPC, fee statement RPC.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. receipt_share_tokens (deny-all RLS; access via SECURITY DEFINER RPCs)
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_share_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.receipt_share_tokens enable row level security;

drop policy if exists receipt_share_tokens_none on public.receipt_share_tokens;
create policy receipt_share_tokens_none on public.receipt_share_tokens
  for all using (false) with check (false);

grant select, insert, update, delete on public.receipt_share_tokens to service_role;

-- ---------------------------------------------------------------------------
-- 2. receipt_token_access_log (rate limiting)
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_token_access_log (
  id bigserial primary key,
  token_hash text not null,
  accessed_at timestamptz not null default now(),
  ip text
);

alter table public.receipt_token_access_log enable row level security;

drop policy if exists receipt_token_access_log_none on public.receipt_token_access_log;
create policy receipt_token_access_log_none on public.receipt_token_access_log
  for all using (false) with check (false);

grant select, insert on public.receipt_token_access_log to service_role;

create index if not exists receipt_token_access_log_hash_time_idx
  on public.receipt_token_access_log (token_hash, accessed_at);

-- ---------------------------------------------------------------------------
-- 3. create_receipt_share_token
-- ---------------------------------------------------------------------------
create or replace function public.create_receipt_share_token(
  p_receipt_id uuid,
  p_expires_days integer default 30
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
  v_days integer := greatest(coalesce(p_expires_days, 30), 1);
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if not (public.user_has_permission(v_uid, (select tenant_id from public.receipts where id = p_receipt_id), 'manage-fees')
       or public.user_has_permission(v_uid, (select tenant_id from public.receipts where id = p_receipt_id), 'view-fees')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select tenant_id into v_tenant from public.receipts where id = p_receipt_id;
  if v_tenant is null then raise exception 'Receipt not found'; end if;

  v_token := encode(extensions.gen_random_bytes(8), 'hex'); -- 16 hex chars
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.receipt_share_tokens (tenant_id, receipt_id, token_hash, expires_at)
  values (v_tenant, p_receipt_id, v_hash, now() + (v_days || ' days')::interval);

  return v_token;
end;
$function$;

revoke all on function public.create_receipt_share_token(uuid, integer) from public, anon;
grant execute on function public.create_receipt_share_token(uuid, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. get_receipt_by_token (public, rate-limited 20/hour/token)
-- ---------------------------------------------------------------------------
create or replace function public.get_receipt_by_token(p_token text, p_ip text default null)
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
  v_receipt record;
  v_payment record;
  v_student record;
  v_tenant record;
begin
  if p_token is null or length(p_token) = 0 then
    raise exception 'Invalid token';
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- rate limit
  select count(*) into v_recent
  from public.receipt_token_access_log
  where token_hash = v_hash
    and accessed_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Rate limit exceeded' using errcode = 'P0001';
  end if;
  insert into public.receipt_token_access_log (token_hash, ip) values (v_hash, p_ip);

  select * into v_row
  from public.receipt_share_tokens
  where token_hash = v_hash
    and revoked = false
    and expires_at > now();
  if not found then
    raise exception 'Invalid or expired link';
  end if;

  select * into v_receipt from public.receipts where id = v_row.receipt_id;
  select * into v_payment from public.fee_payments where id = v_receipt.payment_id;
  select * into v_student from public.students where id = v_payment.student_id;
  select * into v_tenant from public.tenants where id = v_row.tenant_id;

  return jsonb_build_object(
    'receipt', jsonb_build_object(
      'id', v_receipt.id,
      'receipt_number', v_receipt.receipt_number,
      'amount_paid', v_receipt.amount_paid,
      'payment_method', v_receipt.payment_method,
      'reference_number', v_receipt.reference_number,
      'paid_at', v_receipt.paid_at
    ),
    'payment', jsonb_build_object(
      'id', v_payment.id,
      'amount', v_payment.amount,
      'payment_method', v_payment.payment_method,
      'reference_number', v_payment.reference_number,
      'academic_year', v_payment.academic_year,
      'term', v_payment.term,
      'paid_by', v_payment.paid_by,
      'paid_at', v_payment.paid_at
    ),
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
    'expires_at', v_row.expires_at
  );
end;
$function$;

revoke all on function public.get_receipt_by_token(text, text) from public, anon;
grant execute on function public.get_receipt_by_token(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. revoke_receipt_share_token
-- ---------------------------------------------------------------------------
create or replace function public.revoke_receipt_share_token(p_token text)
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
  select tenant_id into v_tenant from public.receipt_share_tokens where token_hash = v_hash;
  if v_tenant is null then return false; end if;
  if not (public.user_has_permission(v_uid, v_tenant, 'manage-fees') or public.user_has_permission(v_uid, v_tenant, 'view-fees')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.receipt_share_tokens set revoked = true where token_hash = v_hash;
  return true;
end;
$function$;

revoke all on function public.revoke_receipt_share_token(text) from public, anon;
grant execute on function public.revoke_receipt_share_token(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. get_student_guardian_contacts (permission-checked)
-- ---------------------------------------------------------------------------
create or replace function public.get_student_guardian_contacts(p_student_id uuid)
returns table(
  guardian_name text,
  guardian_phone text,
  relationship text,
  is_primary boolean,
  source text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_student record;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;
  if v_role is distinct from 'service_role' then
    begin v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_caller_tenant := null; end;
    if v_caller_tenant is null then raise exception 'Missing tenant claim'; end if;
    if not (public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees') or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees')) then
      raise exception 'Access denied: finance permission required' using errcode = '42501';
    end if;
  end if;

  select * into v_student from public.students where id = p_student_id
    and (v_role = 'service_role' or tenant_id = v_caller_tenant);
  if v_student.id is null then raise exception 'Student not found'; end if;

  -- linked parents/guardians
  return query
  select
    pp.full_name as guardian_name,
    pp.phone as guardian_phone,
    psl.relationship,
    psl.is_primary,
    'linked'::text as source
  from public.parent_student_links psl
  join public.profiles pp on pp.id = psl.parent_id
  where psl.student_id = p_student_id
    and (v_role = 'service_role' or psl.tenant_id = v_caller_tenant);

  -- student record phones (fallback single guardian)
  if v_student.guardian_name is not null and btrim(v_student.guardian_name) <> '' then
    return query
    select
      v_student.guardian_name::text,
      coalesce(v_student.primary_phone, v_student.primary_phone_2, v_student.secondary_phone, v_student.secondary_phone_2) as guardian_phone,
      coalesce(v_student.guardian_relation, 'guardian')::text,
      true,
      'student_record'::text;
  end if;
end;
$function$;

revoke all on function public.get_student_guardian_contacts(uuid) from public, anon;
grant execute on function public.get_student_guardian_contacts(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. get_fee_statement (opening, billed, payments, reversals, running balance)
-- ---------------------------------------------------------------------------
create or replace function public.get_fee_statement(
  p_student_id uuid,
  p_term text default null,
  p_academic_year integer default null
)
returns table(
  row_kind text,
  description text,
  term text,
  academic_year integer,
  occurred_at timestamptz,
  receipt_number text,
  payment_method text,
  paid_by text,
  amount numeric,
  running_balance numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_student record;
  v_opening numeric := 0;
  v_term_rank integer;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;
  if v_role is distinct from 'service_role' then
    begin v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_caller_tenant := null; end;
    if v_caller_tenant is null then raise exception 'Missing tenant claim'; end if;
    if not (public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees') or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees')) then
      raise exception 'Access denied: finance permission required' using errcode = '42501';
    end if;
  end if;

  select * into v_student from public.students where id = p_student_id
    and (v_role = 'service_role' or tenant_id = v_caller_tenant);
  if v_student.id is null then raise exception 'Student not found'; end if;

  v_term_rank := case p_term when 'Term 1' then 1 when 'Term 2' then 2 when 'Term 3' then 3 else null end;

  -- opening balance = fees - payments for periods before the filter
  if p_academic_year is not null or p_term is not null then
    select coalesce(sum(fs.amount), 0) - coalesce((
      select sum(fp.amount) from public.fee_payments fp
      where fp.student_id = p_student_id
        and (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
        and (fp.type = 'payment')
        and (
          (p_academic_year is not null and fp.academic_year is not null and fp.academic_year < p_academic_year)
          or (p_academic_year is not null and fp.academic_year = p_academic_year and p_term is not null and fp.term is not null and
              case fp.term when 'Term 1' then 1 when 'Term 2' then 2 when 'Term 3' then 3 else 0 end < v_term_rank)
        )
    ), 0) into v_opening
    from public.fee_structures fs
    where fs.class_id = v_student.class_id
      and (v_role = 'service_role' or fs.tenant_id = v_caller_tenant)
      and (
        (p_academic_year is not null and fs.academic_year < p_academic_year)
        or (p_academic_year is not null and fs.academic_year = p_academic_year and p_term is not null and
            case fs.term when 'Term 1' then 1 when 'Term 2' then 2 when 'Term 3' then 3 else 0 end < v_term_rank)
      );
  end if;

  return query
  with rows as (
    -- opening
    select 0 as sort_order, null::timestamptz as occurred_at, null::uuid as rid,
           'opening'::text as row_kind,
           'Carried forward'::text as description,
           null::text as term, null::integer as academic_year,
           null::text as receipt_number, null::text as payment_method,
           null::text as paid_by,
           v_opening as amount
    where v_opening <> 0

    union all

    -- billed fees
    select 1, fs.created_at, fs.id,
           'fee'::text,
           fs.name::text,
           fs.term, fs.academic_year,
           null::text, null::text, null::text,
           fs.amount
    from public.fee_structures fs
    where fs.class_id = v_student.class_id
      and (v_role = 'service_role' or fs.tenant_id = v_caller_tenant)
      and fs.is_active = true
      and (p_academic_year is null or fs.academic_year = p_academic_year)
      and (p_term is null or fs.term = p_term)

    union all

    -- payments & reversals
    select 2, fp.paid_at, fp.id,
           case when fp.type = 'reversal' then 'reversal' else 'payment' end,
           case when fp.type = 'reversal' then 'Reversal' else 'Payment' end,
           fp.term, fp.academic_year,
           r.receipt_number, fp.payment_method, fp.paid_by,
           case when fp.type = 'reversal' then fp.amount else -fp.amount end
    from public.fee_payments fp
    left join public.receipts r on r.payment_id = fp.id
    where fp.student_id = p_student_id
      and (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
      and (p_academic_year is null or fp.academic_year = p_academic_year)
      and (p_term is null or fp.term = p_term)
  ),
  ordered as (
    select r.*,
           row_number() over (order by r.sort_order, r.occurred_at nulls first, r.rid) as rn
    from rows r
  )
  select
    o.row_kind,
    o.description,
    o.term,
    o.academic_year,
    o.occurred_at,
    o.receipt_number,
    o.payment_method,
    o.paid_by,
    o.amount,
    sum(o.amount) over (order by o.rn rows unbounded preceding) as running_balance
  from ordered o
  order by o.rn;
end;
$function$;

revoke all on function public.get_fee_statement(uuid, text, integer) from public, anon;
grant execute on function public.get_fee_statement(uuid, text, integer) to authenticated, service_role;
