-- Expose payment_id (and paid_by via fee_payments) on get_receipts so the
-- client can link a receipt to its payment and create share tokens.
drop function if exists public.get_receipts(uuid);
create or replace function public.get_receipts(p_invoice_id uuid default null)
returns table(
  receipt_id uuid,
  invoice_id uuid,
  invoice_number text,
  receipt_number text,
  amount_paid numeric,
  payment_method text,
  reference_number text,
  paid_at timestamptz,
  recorded_by_name text,
  payment_id uuid,
  paid_by text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;
  if v_role is distinct from 'service_role' then
    begin v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_caller_tenant := null; end;
    if v_caller_tenant is null then raise exception 'Missing tenant claim'; end if;
  end if;

  return query
  select
    r.id as receipt_id,
    r.invoice_id,
    i.invoice_number,
    r.receipt_number,
    r.amount_paid,
    r.payment_method,
    r.reference_number,
    r.paid_at,
    p.full_name as recorded_by_name,
    r.payment_id,
    fp.paid_by
  from public.receipts r
  left join public.invoices i on i.id = r.invoice_id
  left join public.profiles p on p.id = r.recorded_by
  left join public.fee_payments fp on fp.id = r.payment_id
  where (v_role = 'service_role' or r.tenant_id = v_caller_tenant)
    and (p_invoice_id is null or r.invoice_id = p_invoice_id)
  order by r.paid_at desc;
end;
$function$;

revoke all on function public.get_receipts(uuid) from public, anon;
grant execute on function public.get_receipts(uuid) to authenticated, service_role;
