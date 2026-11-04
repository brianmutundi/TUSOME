-- Parent-facing finance reads + signed receipt/statement tokens (parent-scoped).
-- Reuses assert_parent_of. Parents never get direct table access.

-- 1. Parent-scoped receipts (with paid_by)
create or replace function public.get_my_child_receipts(p_student_id uuid)
returns table(
  receipt_id uuid,
  receipt_number text,
  amount_paid numeric,
  payment_method text,
  reference_number text,
  paid_at timestamptz,
  paid_by text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.assert_parent_of(p_student_id);
  return query
  select
    r.id as receipt_id,
    r.receipt_number,
    r.amount_paid,
    r.payment_method,
    r.reference_number,
    r.paid_at,
    fp.paid_by
  from public.receipts r
  left join public.fee_payments fp on fp.id = r.payment_id
  where r.tenant_id = v_tenant
    and fp.student_id = p_student_id
  order by r.paid_at desc;
end;
$function$;

revoke all on function public.get_my_child_receipts(uuid) from public, anon;
grant execute on function public.get_my_child_receipts(uuid) to authenticated, service_role;

-- 2. Parent-scoped signed receipt token (30 days)
create or replace function public.create_my_child_receipt_token(p_receipt_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_receipt record;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  select * into v_receipt from public.receipts where id = p_receipt_id;
  if v_receipt.id is null then raise exception 'Receipt not found'; end if;
  -- verify parent owns the student linked to this receipt's payment
  perform public.assert_parent_of((select student_id from public.fee_payments where id = v_receipt.payment_id));

  return public.create_receipt_share_token(p_receipt_id, 30);
end;
$function$;

revoke all on function public.create_my_child_receipt_token(uuid) from public, anon;
grant execute on function public.create_my_child_receipt_token(uuid) to authenticated, service_role;

-- 3. Parent-scoped signed statement token (7 days)
create or replace function public.create_my_child_statement_token(
  p_student_id uuid,
  p_term text default null,
  p_academic_year integer default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  perform public.assert_parent_of(p_student_id);
  return public.create_statement_share_token(p_student_id, p_term, p_academic_year, 7);
end;
$function$;

revoke all on function public.create_my_child_statement_token(uuid, text, integer) from public, anon;
grant execute on function public.create_my_child_statement_token(uuid, text, integer) to authenticated, service_role;
