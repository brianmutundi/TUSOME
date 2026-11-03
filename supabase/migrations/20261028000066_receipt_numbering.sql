-- Per-tenant receipt counter for gap-safe, unique receipt numbers
create table if not exists public.receipt_counters (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  last_number integer not null default 0
);

alter table public.receipt_counters enable row level security;

drop policy if exists receipt_counters_tenant on public.receipt_counters;
create policy receipt_counters_tenant on public.receipt_counters
  for all using (tenant_id = public.my_tenant_id())
  with check (tenant_id = public.my_tenant_id());

grant select, insert, update on public.receipt_counters to authenticated, service_role;

create or replace function public.next_receipt_number(p_tenant_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  insert into public.receipt_counters (tenant_id, last_number)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update set last_number = public.receipt_counters.last_number + 1
  returning last_number into v_next;
  return 'RCP-' || lpad(v_next::text, 4, '0');
end;
$$;

revoke all on function public.next_receipt_number(uuid) from public, anon;
grant execute on function public.next_receipt_number(uuid) to authenticated, service_role;

-- Unique receipt number per tenant
alter table public.receipts add constraint receipts_tenant_number_unique unique (tenant_id, receipt_number);
