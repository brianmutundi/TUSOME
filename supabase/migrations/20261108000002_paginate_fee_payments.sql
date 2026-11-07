-- Add offset + total to get_fee_payments so clients can page instead of silently
-- truncating at p_limit. Pattern to replicate for get_cash_book_entries,
-- get_wallet_transactions and get_message_history.

drop function if exists public.get_fee_payments(uuid, integer);
create or replace function public.get_fee_payments(
  p_student_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  payment_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  amount numeric,
  payment_method text,
  reference_number text,
  academic_year integer,
  term text,
  notes text,
  recorded_by_name text,
  paid_by text,
  paid_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_limit int;
  v_offset int;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;
  if v_role is distinct from 'service_role' then
    begin v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_caller_tenant := null; end;
    if v_caller_tenant is null then raise exception 'Missing tenant claim'; end if;
  end if;
  v_limit := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  return query
  select
    fp.id as payment_id,
    fp.student_id,
    s.full_name as student_name,
    s.admission_no,
    fp.amount,
    fp.payment_method,
    fp.reference_number,
    fp.academic_year,
    fp.term,
    fp.notes,
    p.full_name as recorded_by_name,
    fp.paid_by,
    fp.paid_at,
    count(*) over() as total_count
  from public.fee_payments fp
  left join public.students s on s.id = fp.student_id
  left join public.profiles p on p.id = fp.recorded_by
  where (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
    and (p_student_id is null or fp.student_id = p_student_id)
  order by fp.paid_at desc
  offset v_offset
  limit v_limit;
end;
$function$;

revoke all on function public.get_fee_payments(uuid, integer, integer) from public, anon;
grant execute on function public.get_fee_payments(uuid, integer, integer) to authenticated, service_role;
