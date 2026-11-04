-- One source for statement rows: a single internal row builder used by both the
-- staff statement RPC and the public token RPC. Fixes the token path, which
-- previously delegated to get_fee_statement (a JWT-tenant-checked function)
-- from an anonymous context and failed with "Missing tenant claim".
--
-- Tenant scoping is passed explicitly because the caller has already resolved it
-- (from the JWT for staff, from the token row for public links).

drop function if exists public.fee_statement_rows(uuid, uuid, text, integer);

create function public.fee_statement_rows(
  p_tenant_id uuid,
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
  v_student record;
  v_opening numeric := 0;
  v_term_rank integer;
begin
  select * into v_student
  from public.students s
  where s.id = p_student_id and s.tenant_id = p_tenant_id;
  if v_student.id is null then raise exception 'Student not found'; end if;

  v_term_rank := case p_term when 'Term 1' then 1 when 'Term 2' then 2 when 'Term 3' then 3 else null end;

  if p_academic_year is not null or p_term is not null then
    select
      coalesce(sum(fs.amount), 0) - coalesce((
        select sum(fp.amount) from public.fee_payments fp
        where fp.student_id = p_student_id
          and fp.tenant_id = p_tenant_id
          and fp.type = 'payment'
          and (
            (p_academic_year is not null and fp.academic_year is not null and fp.academic_year < p_academic_year)
            or (p_academic_year is not null and fp.academic_year = p_academic_year and p_term is not null and fp.term is not null and
                case fp.term when 'Term 1' then 1 when 'Term 2' then 2 when 'Term 3' then 3 else 0 end < v_term_rank)
          )
      ), 0)
    into v_opening
    from public.fee_structures fs
    where fs.class_id = v_student.class_id
      and fs.tenant_id = p_tenant_id
      and (
        (p_academic_year is not null and fs.academic_year < p_academic_year)
        or (p_academic_year is not null and fs.academic_year = p_academic_year and p_term is not null and
            case fs.term when 'Term 1' then 1 when 'Term 2' then 2 when 'Term 3' then 3 else 0 end < v_term_rank)
      );
  end if;

  return query
  with rows as (
    select 0 as sort_order, null::timestamptz as occurred_at, null::uuid as rid,
           'opening'::text as row_kind,
           'Carried forward'::text as description,
           null::text as term, null::integer as academic_year,
           null::text as receipt_number, null::text as payment_method,
           null::text as paid_by,
           v_opening as amount
    where v_opening <> 0

    union all

    select 1, fs.created_at, fs.id,
           'fee'::text,
           fs.name::text,
           fs.term, fs.academic_year,
           null::text, null::text, null::text,
           fs.amount
    from public.fee_structures fs
    where fs.class_id = v_student.class_id
      and fs.tenant_id = p_tenant_id
      and fs.is_active = true
      and (p_academic_year is null or fs.academic_year = p_academic_year)
      and (p_term is null or fs.term = p_term)

    union all

    select 2, fp.paid_at, fp.id,
           case when fp.type = 'reversal' then 'reversal' else 'payment' end,
           case when fp.type = 'reversal' then 'Reversal' else 'Payment' end,
           fp.term, fp.academic_year,
           r.receipt_number, fp.payment_method, fp.paid_by,
           case when fp.type = 'reversal' then fp.amount else -fp.amount end
    from public.fee_payments fp
    left join public.receipts r on r.payment_id = fp.id
    where fp.student_id = p_student_id
      and fp.tenant_id = p_tenant_id
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

revoke all on function public.fee_statement_rows(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.fee_statement_rows(uuid, uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- get_fee_statement: staff path. Resolves tenant from JWT, checks permission,
-- then delegates row building.
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
  v_role text;
  v_tenant uuid;
  v_student_tenant uuid;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;

  if v_role = 'service_role' then
    select tenant_id into v_student_tenant from public.students where id = p_student_id;
    if v_student_tenant is null then raise exception 'Student not found'; end if;
    v_tenant := v_student_tenant;
  else
    begin v_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_tenant := null; end;
    if v_tenant is null then raise exception 'Missing tenant claim'; end if;
    if not (public.user_has_permission(auth.uid(), v_tenant, 'view-fees')
            or public.user_has_permission(auth.uid(), v_tenant, 'manage-fees')) then
      raise exception 'Access denied: finance permission required' using errcode = '42501';
    end if;
  end if;

  return query
  select * from public.fee_statement_rows(v_tenant, p_student_id, p_term, p_academic_year);
end;
$function$;

revoke all on function public.get_fee_statement(uuid, text, integer) from public, anon;
grant execute on function public.get_fee_statement(uuid, text, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_fee_statement_by_token: public path. The token is the credential, so the
-- tenant comes from the token row and no JWT checks are performed.
-- ---------------------------------------------------------------------------
create or replace function public.get_fee_statement_by_token(p_token text, p_ip text default null)
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
volatile
security definer
set search_path = ''
as $function$
declare
  v_hash text;
  v_row record;
  v_recent int;
begin
  if p_token is null or length(p_token) = 0 then raise exception 'Invalid token'; end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select count(*) into v_recent
  from public.document_token_access_log
  where token_hash = v_hash
    and accessed_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'Rate limit exceeded' using errcode = 'PT429'; end if;
  insert into public.document_token_access_log (token_hash, ip) values (v_hash, p_ip);

  select * into v_row
  from public.document_share_tokens
  where token_hash = v_hash
    and document_type = 'statement'
    and revoked = false
    and expires_at > now();
  if not found then raise exception 'Invalid or expired link'; end if;

  return query
  select * from public.fee_statement_rows(v_row.tenant_id, v_row.document_id, v_row.term, v_row.academic_year);
end;
$function$;

revoke all on function public.get_fee_statement_by_token(text, text) from public, anon;
grant execute on function public.get_fee_statement_by_token(text, text) to anon, authenticated, service_role;
