create or replace function public.get_student_statement(
  p_student_id uuid,
  p_term text default null,
  p_academic_year integer default null
)
returns table(
  payment_id uuid,
  receipt_number text,
  payment_date date,
  amount numeric,
  payment_method text,
  reference_number text,
  type text,
  running_balance numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller_tenant uuid;
  v_role text;
  v_total_fees numeric;
  v_running numeric;
begin
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;

  if v_role is distinct from 'service_role' then
    begin
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    exception when others then
      v_caller_tenant := null;
    end;
    if v_caller_tenant is null then
      raise exception 'Missing tenant claim';
    end if;
    if not public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees') and not public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees') then
      raise exception 'Access denied: finance permission required';
    end if;
  end if;

  -- total fees for the student
  select coalesce(sum(fs.amount), 0) into v_total_fees
  from public.fee_structures fs
  join public.students s on s.class_id = fs.class_id
  where s.id = p_student_id
    and (v_role = 'service_role' or fs.tenant_id = v_caller_tenant)
    and (p_academic_year is null or fs.academic_year = p_academic_year)
    and (p_term is null or fs.term = p_term);

  v_running := v_total_fees;

  return query
  select
    fp.id as payment_id,
    r.receipt_number,
    fp.paid_at::date as payment_date,
    fp.amount,
    fp.payment_method,
    fp.reference_number,
    fp.type,
    (v_running - sum(case when fp.type = 'payment' then fp.amount else -fp.amount end) over (order by fp.paid_at, fp.id)) as running_balance
  from public.fee_payments fp
  left join public.receipts r on r.payment_id = fp.id
  where fp.student_id = p_student_id
    and (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
    and (p_academic_year is null or fp.academic_year = p_academic_year)
    and (p_term is null or fp.term = p_term)
  order by fp.paid_at, fp.id;
end;
$$;

revoke all on function public.get_student_statement(uuid, text, integer) from public, anon;
grant execute on function public.get_student_statement(uuid, text, integer) to authenticated, service_role;
