-- Finance integrity remediation: preserve the one-argument receipt counter API while
-- supporting the two-argument call used by record_fee_payment.
-- The existing counter is tenant-scoped (not year-scoped), so the year is
-- accepted for API compatibility and intentionally does not reset numbering.
create or replace function public.next_receipt_number(
  p_tenant_id uuid,
  p_receipt_year smallint
)
returns text
language sql
volatile
security definer
set search_path = ''
as $function$
  select public.next_receipt_number(p_tenant_id);
$function$;

revoke all on function public.next_receipt_number(uuid, smallint) from public, anon;
grant execute on function public.next_receipt_number(uuid, smallint) to authenticated, service_role;

-- Enforce payment idempotency against concurrent duplicate submissions.
-- This preflight intentionally aborts rather than deleting or merging any
-- historical financial records if duplicate non-null keys already exist.
do $preflight$
begin
  if exists (
    select 1
    from public.fee_payments
    where idempotency_key is not null
    group by tenant_id, idempotency_key
    having count(*) > 1
  ) then
    raise exception 'Cannot add fee payment idempotency constraint: duplicate tenant/idempotency_key values exist. Reconcile them manually before retrying.';
  end if;
end;
$preflight$;

create unique index if not exists fee_payments_tenant_idempotency_unique
  on public.fee_payments (tenant_id, idempotency_key)
  where idempotency_key is not null;
