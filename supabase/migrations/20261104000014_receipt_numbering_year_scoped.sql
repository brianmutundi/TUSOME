-- Receipt numbering: one year-scoped counter per tenant, format RCP-{YY}-{000000}.
--
-- The live database had already advanced to this format while the repository
-- only carried the older tenant-wide RCP-0001 counter. This migration makes the
-- repository match the live, revenue-facing format and restores both function
-- signatures after the counter table was reshaped:
--
--   next_receipt_number(uuid, smallint)  -- used by record_fee_payment
--   next_receipt_number(uuid)            -- kept for API compatibility
--
-- Sequencing stays gap-safe and collision-free: a single atomic upsert on
-- (tenant_id, year) holds the row lock for the duration of the transaction, and
-- receipts still carry UNIQUE (tenant_id, receipt_number).
--
-- Historical receipt numbers are never rewritten. The existing counter row
-- (tenant 951758c7..., year 2026, last_number 29) is preserved as-is, so the
-- next receipt issued is RCP-26-000030.

-- ---------------------------------------------------------------------------
-- Counter table: tenant-wide -> (tenant, year)
-- ---------------------------------------------------------------------------
alter table public.receipt_counters
  add column if not exists year smallint not null
    default (extract(year from current_date))::smallint;

-- Replace the tenant-only primary key with (tenant_id, year). Dropping a
-- primary key does not touch rows; the unique index is rebuilt in place.
alter table public.receipt_counters
  drop constraint if exists receipt_counters_pkey;

alter table public.receipt_counters
  add constraint receipt_counters_pkey primary key (tenant_id, year);

alter table public.receipt_counters
  drop constraint if exists receipt_counters_last_number_nonnegative;
alter table public.receipt_counters
  add constraint receipt_counters_last_number_nonnegative check (last_number >= 0);

-- The counter is incremented only by the SECURITY DEFINER function below. Staff
-- may read it for support purposes but must not be able to advance it.
drop policy if exists receipt_counters_tenant on public.receipt_counters;
create policy receipt_counters_tenant_select on public.receipt_counters
  for select using (tenant_id = public.my_tenant_id());

revoke all on public.receipt_counters from public, anon, authenticated;
grant select on public.receipt_counters to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- next_receipt_number(tenant, year) -> RCP-YY-NNNNNN
-- ---------------------------------------------------------------------------
drop function if exists public.next_receipt_number(uuid, smallint);

create function public.next_receipt_number(
  p_tenant_id uuid,
  p_receipt_year smallint
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_year smallint := coalesce(p_receipt_year, (extract(year from current_date))::smallint);
  v_next integer;
begin
  if p_tenant_id is null then
    raise exception 'Tenant is required for receipt numbering';
  end if;

  insert into public.receipt_counters as rc (tenant_id, year, last_number)
  values (p_tenant_id, v_year, 1)
  on conflict (tenant_id, year) do update
    set last_number = rc.last_number + 1
  returning rc.last_number into v_next;

  return 'RCP-'
    || lpad((v_year % 100)::text, 2, '0')
    || '-'
    || lpad(v_next::text, 6, '0');
end;
$function$;

revoke all on function public.next_receipt_number(uuid, smallint) from public, anon;
grant execute on function public.next_receipt_number(uuid, smallint) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- next_receipt_number(tenant) -> current calendar year
-- ---------------------------------------------------------------------------
drop function if exists public.next_receipt_number(uuid);

create function public.next_receipt_number(p_tenant_id uuid)
returns text
language sql
volatile
security definer
set search_path = ''
as $function$
  select public.next_receipt_number(
    p_tenant_id,
    (extract(year from current_date))::smallint
  );
$function$;

revoke all on function public.next_receipt_number(uuid) from public, anon;
grant execute on function public.next_receipt_number(uuid) to authenticated, service_role;
