-- Restore get_fee_statement (app code still depends on it). Full unification
-- (extending get_student_statement) is deferred.
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
      and (v_role = 'service_role' or fs.tenant_id = v_caller_tenant)
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

-- Restore get_fee_statement_by_token
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
  v_student uuid;
  v_term text;
  v_year integer;
begin
  if p_token is null or length(p_token) = 0 then raise exception 'Invalid token'; end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select count(*) into v_recent
  from public.document_token_access_log
  where token_hash = v_hash
    and accessed_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'Rate limit exceeded' using errcode = 'P0001'; end if;
  insert into public.document_token_access_log (token_hash, ip) values (v_hash, p_ip);

  select * into v_row
  from public.document_share_tokens
  where token_hash = v_hash
    and document_type = 'statement'
    and revoked = false
    and expires_at > now();
  if not found then raise exception 'Invalid or expired link'; end if;

  v_student := v_row.document_id;
  v_term := v_row.term;
  v_year := v_row.academic_year;

  return query
  select * from public.get_fee_statement(v_student, v_term, v_year);
end;
$function$;

revoke all on function public.get_fee_statement_by_token(text, text) from public, anon;
grant execute on function public.get_fee_statement_by_token(text, text) to anon, authenticated, service_role;
