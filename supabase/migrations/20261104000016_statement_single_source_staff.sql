-- 20261104000016_statement_single_source_staff.sql
--
-- One source of truth for statement rows: both staff statement entry points now
-- delegate to the internal row builder public.fee_statement_rows (created in
-- 20261104000011_statement_rows_single_source.sql), which the public token RPCs
-- (get_fee_statement_by_token / get_document_by_token) already use.
--
-- Previously get_fee_statement carried a full inline copy of the row logic and
-- get_student_statement carried its own older copy. Both are replaced by thin
-- delegators so the billed/payment/reversal computation exists exactly once.

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
  v_tenant uuid;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;
  if v_role is distinct from 'service_role' then
    begin v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_caller_tenant := null; end;
    if v_caller_tenant is null then raise exception 'Missing tenant claim'; end if;
    if not (public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees') or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees')) then
      raise exception 'Access denied: finance permission required' using errcode = '42501';
    end if;
  end if;

  select s.tenant_id into v_tenant
  from public.students s
  where s.id = p_student_id and (v_role = 'service_role' or s.tenant_id = v_caller_tenant);
  if v_tenant is null then raise exception 'Student not found'; end if;

  return query
  select * from public.fee_statement_rows(v_tenant, p_student_id, p_term, p_academic_year);
end;
$function$;

revoke all on function public.get_fee_statement(uuid, text, integer) from public, anon;
grant execute on function public.get_fee_statement(uuid, text, integer) to authenticated, service_role;

-- Return type changed (legacy payment-rows shape -> unified statement rows), so
-- drop before replace.
drop function if exists public.get_student_statement(uuid, text, integer);

create or replace function public.get_student_statement(
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
  v_tenant uuid;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;
  if v_role is distinct from 'service_role' then
    begin v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_caller_tenant := null; end;
    if v_caller_tenant is null then raise exception 'Missing tenant claim'; end if;
    if not (public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees') or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees')) then
      raise exception 'Access denied: finance permission required' using errcode = '42501';
    end if;
  end if;

  select s.tenant_id into v_tenant
  from public.students s
  where s.id = p_student_id and (v_role = 'service_role' or s.tenant_id = v_caller_tenant);
  if v_tenant is null then raise exception 'Student not found'; end if;

  return query
  select * from public.fee_statement_rows(v_tenant, p_student_id, p_term, p_academic_year);
end;
$function$;

revoke all on function public.get_student_statement(uuid, text, integer) from public, anon;
grant execute on function public.get_student_statement(uuid, text, integer) to authenticated, service_role;
