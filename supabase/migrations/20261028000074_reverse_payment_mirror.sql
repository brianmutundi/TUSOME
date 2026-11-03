create or replace function public.reverse_payment(
  p_payment_id uuid,
  p_reason text,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_payment record;
  v_reversal_id uuid;
  v_reason text;
  v_alloc record;
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

  -- CREDIT_ALREADY_APPLIED check: if credit from this payment was applied, reject
  if exists (
    select 1 from public.credit_applications ca
    where ca.payment_id = p_payment_id
  ) then
    raise exception 'CREDIT_ALREADY_APPLIED: reverse credit applications first';
  end if;

  -- insert reversal row
  insert into public.fee_payments (tenant_id, student_id, amount, payment_method, reference_number, academic_year, term, notes, recorded_by, idempotency_key, paid_at, type, reverses_payment_id, reversal_reason, source, received_by)
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
    case when v_role is distinct from 'service_role' then auth.uid() else null end
  )
  returning id into v_reversal_id;

  -- mirror allocation rows (negated amounts, same kind and fee item)
  for v_alloc in select * from public.payment_allocations where payment_id = p_payment_id loop
    insert into public.payment_allocations (tenant_id, payment_id, vote_head_id, fee_structure_id, amount, kind)
    values (
      v_payment.tenant_id,
      v_reversal_id,
      v_alloc.vote_head_id,
      v_alloc.fee_structure_id,
      -v_alloc.amount,
      v_alloc.kind
    );
  end loop;

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
