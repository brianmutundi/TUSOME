-- Add allocations support to record_fee_payment via a new overload
-- First drop the old 9-arg version
drop function if exists public.record_fee_payment(uuid, numeric, text, text, integer, text, text, uuid, date);

create or replace function public.record_fee_payment(
  p_student_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_reference_number text default null,
  p_academic_year integer default null,
  p_term text default null,
  p_notes text default null,
  p_idempotency_key uuid default null,
  p_payment_date date default null,
  p_allocations jsonb default null
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
  v_payment_id uuid;
  v_existing_id uuid;
  v_existing_amount numeric;
  v_existing_method text;
  v_existing_ref text;
  v_existing_student uuid;
  v_student_tenant uuid;
  v_payment_date date;
  v_alloc jsonb;
  v_alloc_total numeric := 0;
  v_alloc_item jsonb;
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

  select tenant_id into v_student_tenant
  from public.students
  where id = p_student_id;

  if v_student_tenant is null then
    raise exception 'Student not found';
  end if;
  if v_role is distinct from 'service_role' and v_student_tenant <> v_caller_tenant then
    raise exception 'Access denied: student from different tenant';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;
  if p_amount > 100000000 then
    raise exception 'Payment amount exceeds maximum';
  end if;
  if p_amount <> round(p_amount, 2) then
    raise exception 'Payment amount must have at most 2 decimal places';
  end if;

  if p_payment_method not in ('cash', 'mpesa', 'bank', 'cheque', 'other') then
    raise exception 'Invalid payment method';
  end if;

  if p_term is not null and p_term not in ('Term 1', 'Term 2', 'Term 3') then
    raise exception 'Invalid term';
  end if;

  if p_academic_year is not null and (p_academic_year < 2000 or p_academic_year > extract(year from current_date)::int + 1) then
    raise exception 'Invalid academic year';
  end if;

  v_payment_date := coalesce(p_payment_date, current_date);
  if v_payment_date > current_date then
    raise exception 'Payment date cannot be in the future';
  end if;

  -- idempotency check
  if p_idempotency_key is not null then
    select id, amount, payment_method, reference_number, student_id
    into v_existing_id, v_existing_amount, v_existing_method, v_existing_ref, v_existing_student
    from public.fee_payments
    where tenant_id = coalesce(v_caller_tenant, v_student_tenant)
      and idempotency_key = p_idempotency_key;
    if v_existing_id is not null then
      if v_existing_student <> p_student_id or v_existing_amount <> p_amount or v_existing_method <> p_payment_method or coalesce(v_existing_ref, '') <> coalesce(nullif(btrim(coalesce(p_reference_number, '')), ''), '') then
        raise exception 'Idempotency key conflict: different payload';
      end if;
      return v_existing_id;
    end if;
  end if;

  -- duplicate reference check
  if p_reference_number is not null and btrim(p_reference_number) <> '' then
    if exists (
      select 1 from public.fee_payments
      where tenant_id = coalesce(v_caller_tenant, v_student_tenant)
        and reference_number = btrim(p_reference_number)
        and payment_method = p_payment_method
    ) then
      raise exception 'Duplicate reference number for this payment method';
    end if;
  end if;

  -- validate allocations sum
  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array' then
    for v_alloc in select * from jsonb_array_elements(p_allocations) loop
      v_alloc_total := v_alloc_total + coalesce((v_alloc ->> 'amount')::numeric, 0);
    end loop;
    if v_alloc_total <> p_amount then
      raise exception 'Allocations must sum to payment amount';
    end if;
  end if;

  -- create payment
  insert into public.fee_payments (tenant_id, student_id, amount, payment_method, reference_number, academic_year, term, notes, recorded_by, idempotency_key, paid_at)
  values (
    coalesce(v_caller_tenant, v_student_tenant),
    p_student_id,
    p_amount,
    p_payment_method,
    nullif(btrim(coalesce(p_reference_number, '')), ''),
    p_academic_year,
    p_term,
    nullif(btrim(coalesce(p_notes, '')), ''),
    case when v_role is distinct from 'service_role' then auth.uid() else null end,
    p_idempotency_key,
    v_payment_date::timestamptz
  )
  returning id into v_payment_id;

  -- create allocations
  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array' then
    for v_alloc in select * from jsonb_array_elements(p_allocations) loop
      insert into public.payment_allocations (tenant_id, payment_id, vote_head_id, fee_structure_id, amount)
      values (
        coalesce(v_caller_tenant, v_student_tenant),
        v_payment_id,
        nullif(v_alloc ->> 'vote_head_id', '')::uuid,
        nullif(v_alloc ->> 'fee_structure_id', '')::uuid,
        (v_alloc ->> 'amount')::numeric
      );
    end loop;
  end if;

  -- audit event
  insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, after_values)
  values (
    coalesce(v_caller_tenant, v_student_tenant),
    case when v_role is distinct from 'service_role' then auth.uid() else null end,
    'record_payment',
    'fee_payment',
    v_payment_id,
    jsonb_build_object('amount', p_amount, 'method', p_payment_method, 'student_id', p_student_id, 'idempotency_key', p_idempotency_key, 'allocations', p_allocations)
  );

  return v_payment_id;
end;
$function$;

revoke all on function public.record_fee_payment(uuid, numeric, text, text, integer, text, text, uuid, date, jsonb) from public, anon;
grant execute on function public.record_fee_payment(uuid, numeric, text, text, integer, text, text, uuid, date, jsonb) to authenticated, service_role;
