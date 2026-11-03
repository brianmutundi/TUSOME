-- Allocation sum constraint trigger (deferred)
create or replace function public.check_allocation_sum()
returns trigger
language plpgsql
as $$
declare
  v_payment_amount numeric;
  v_alloc_sum numeric;
  v_payment_type text;
  v_expected numeric;
begin
  select amount, type into v_payment_amount, v_payment_type
  from public.fee_payments where id = coalesce(new.payment_id, old.payment_id);

  if v_payment_type = 'payment' then
    v_expected := v_payment_amount;
  elsif v_payment_type = 'reversal' then
    v_expected := -v_payment_amount;
  else
    v_expected := v_payment_amount;
  end if;

  select coalesce(sum(amount), 0) into v_alloc_sum
  from public.payment_allocations
  where payment_id = coalesce(new.payment_id, old.payment_id);

  if v_alloc_sum <> v_expected then
    raise exception 'Allocations (%) must sum to payment amount (%)', v_alloc_sum, v_expected;
  end if;
  return new;
end;
$$;

drop trigger if exists allocation_sum_check on public.payment_allocations;
create constraint trigger allocation_sum_check
  after insert or update or delete on public.payment_allocations
  deferrable initially deferred
  for each row
  execute function public.check_allocation_sum();

-- Truncate protection
create or replace function public.prevent_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception 'TRUNCATE is not allowed on this table.';
  return null;
end;
$$;

drop trigger if exists fee_payments_no_truncate on public.fee_payments;
create trigger fee_payments_no_truncate
  before truncate on public.fee_payments
  for each statement execute function public.prevent_truncate();

drop trigger if exists payment_allocations_no_truncate on public.payment_allocations;
create trigger payment_allocations_no_truncate
  before truncate on public.payment_allocations
  for each statement execute function public.prevent_truncate();

drop trigger if exists credit_applications_no_truncate on public.credit_applications;
create trigger credit_applications_no_truncate
  before truncate on public.credit_applications
  for each statement execute function public.prevent_truncate();

drop trigger if exists audit_events_no_truncate on public.audit_events;
create trigger audit_events_no_truncate
  before truncate on public.audit_events
  for each statement execute function public.prevent_truncate();
