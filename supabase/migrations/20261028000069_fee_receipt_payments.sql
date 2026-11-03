-- Add missing columns to fee_payments (additive, no destructive changes)
alter table public.fee_payments add column if not exists type text not null default 'payment' check (type in ('payment','reversal'));
alter table public.fee_payments add column if not exists mpesa_ref text;
alter table public.fee_payments add column if not exists bank_ref text;
alter table public.fee_payments add column if not exists balance_after_minor numeric;
alter table public.fee_payments add column if not exists reverses_payment_id uuid references public.fee_payments (id);
alter table public.fee_payments add column if not exists reversal_reason text;
alter table public.fee_payments add column if not exists source text not null default 'staff' check (source in ('staff','parent_portal'));
alter table public.fee_payments add column if not exists received_by uuid references public.profiles (id) on delete set null;

-- Unique constraints
create unique index if not exists fee_payments_mpesa_ref_unique on public.fee_payments (tenant_id, mpesa_ref) where mpesa_ref is not null;
create unique index if not exists fee_payments_reverses_unique on public.fee_payments (reverses_payment_id) where type = 'reversal';

-- Immutability trigger
create or replace function public.prevent_payment_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception 'Payments are immutable. Use reversal instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists fee_payments_immutable on public.fee_payments;
create trigger fee_payments_immutable
  before update or delete on public.fee_payments
  for each row execute function public.prevent_payment_mutation();

-- Reverse payment function
create or replace function public.reverse_payment(
  p_payment_id uuid,
  p_reason text,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_payment record;
  v_reversal_id uuid;
  v_reason text;
begin
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;

  begin
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_caller_tenant := null;
  end;

  if v_role is distinct from 'service_role' then
    if v_caller_tenant is null then
      raise exception 'Missing tenant claim';
    end if;
    if not public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees') then
      raise exception 'Access denied: manage-fees permission required';
    end if;
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 10 then
    raise exception 'Reversal reason must be at least 10 characters';
  end if;

  select * into v_payment
  from public.fee_payments
  where id = p_payment_id
    and (v_role = 'service_role' or tenant_id = v_caller_tenant);

  if v_payment.id is null then
    raise exception 'Payment not found';
  end if;

  if v_payment.type = 'reversal' then
    raise exception 'Cannot reverse a reversal';
  end if;

  if exists (select 1 from public.fee_payments where reverses_payment_id = p_payment_id) then
    raise exception 'Payment already reversed';
  end if;

  -- insert reversal row
  insert into public.fee_payments (tenant_id, student_id, amount, payment_method, reference_number, academic_year, term, notes, recorded_by, idempotency_key, paid_at, type, reverses_payment_id, reversal_reason, source, received_by, balance_after_minor)
  values (
    v_payment.tenant_id,
    v_payment.student_id,
    v_payment.amount,
    v_payment.payment_method,
    v_payment.reference_number,
    v_payment.academic_year,
    v_payment.term,
    'Reversal: ' || v_reason,
    case when v_role is distinct from 'service_role' then auth.uid() else null end,
    p_idempotency_key,
    current_date::timestamptz,
    'reversal',
    p_payment_id,
    v_reason,
    'staff',
    case when v_role is distinct from 'service_role' then auth.uid() else null end,
    v_payment.balance_after_minor
  )
  returning id into v_reversal_id;

  -- audit event
  insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, after_values)
  values (
    v_payment.tenant_id,
    case when v_role is distinct from 'service_role' then auth.uid() else null end,
    'reverse_payment',
    'fee_payment',
    v_reversal_id,
    jsonb_build_object('reverses', p_payment_id, 'reason', v_reason, 'amount', v_payment.amount)
  );

  return v_reversal_id;
end;
$function$;

revoke all on function public.reverse_payment(uuid, text, uuid) from public, anon;
grant execute on function public.reverse_payment(uuid, text, uuid) to authenticated, service_role;
