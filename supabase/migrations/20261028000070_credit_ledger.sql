create table if not exists public.credit_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  payment_id uuid references public.fee_payments (id) on delete set null,
  term text,
  academic_year integer,
  amount numeric not null check (amount > 0),
  idempotency_key uuid,
  applied_by uuid references public.profiles (id) on delete set null,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.credit_applications enable row level security;

drop policy if exists credit_applications_tenant on public.credit_applications;
create policy credit_applications_tenant on public.credit_applications
  for all using (tenant_id = public.my_tenant_id())
  with check (tenant_id = public.my_tenant_id());

grant select, insert on public.credit_applications to authenticated, service_role;

create or replace function public.apply_credit(
  p_student_id uuid,
  p_term text,
  p_academic_year integer,
  p_amount numeric,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $func$
declare
  v_caller_tenant uuid;
  v_role text;
  v_student_tenant uuid;
  v_available_credit numeric;
  v_app_id uuid;
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
    raise exception 'Credit amount must be positive';
  end if;

  select coalesce(sum(pa.amount), 0) - coalesce((select sum(ca.amount) from public.credit_applications ca where ca.student_id = p_student_id), 0)
  into v_available_credit
  from public.payment_allocations pa
  join public.fee_payments fp on fp.id = pa.payment_id
  where fp.student_id = p_student_id
    and pa.kind = 'credit';

  if v_available_credit < p_amount then
    raise exception 'Insufficient credit balance';
  end if;

  insert into public.credit_applications (tenant_id, student_id, term, academic_year, amount, idempotency_key, applied_by)
  values (coalesce(v_caller_tenant, v_student_tenant), p_student_id, p_term, p_academic_year, p_amount, p_idempotency_key, case when v_role is distinct from 'service_role' then auth.uid() else null end)
  returning id into v_app_id;

  return v_app_id;
end;
$func$;

revoke all on function public.apply_credit(uuid, text, integer, numeric, uuid) from public, anon;
grant execute on function public.apply_credit(uuid, text, integer, numeric, uuid) to authenticated, service_role;

-- Immutability triggers
create or replace function public.prevent_allocation_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op in ('UPDATE','DELETE','TRUNCATE') then
    raise exception 'Payment allocations are immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_allocations_immutable on public.payment_allocations;
create trigger payment_allocations_immutable
  before update or delete on public.payment_allocations
  for each row execute function public.prevent_allocation_mutation();

create or replace function public.prevent_credit_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op in ('UPDATE','DELETE','TRUNCATE') then
    raise exception 'Credit applications are immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists credit_applications_immutable on public.credit_applications;
create trigger credit_applications_immutable
  before update or delete on public.credit_applications
  for each row execute function public.prevent_credit_mutation();
