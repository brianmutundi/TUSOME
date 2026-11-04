-- Parent-portal finance: read the authoritative ledger, not the legacy archive.
--
-- Two defects found during the finance browser pass and fixed here:
--
--   1. get_my_child_payments read public.fee_collections (the read-only legacy
--      archive) for the parent's payment history. The parent must see the
--      authoritative ledger (fee_payments, of which reversals are separate
--      linked rows). fee_collections stays an archive and is never merged in.
--
--   2. get_my_child_fees returned only rows from public.vote_head_balances,
--      which is empty for learners who paid through the fee_payments ledger, so
--      the parent portal showed "No fee balances recorded" even while the child
--      owed a real outstanding balance. Balances now come from the same ledger
--      charge model the staff statement uses: fee_structures - net ledger
--      payments - approved waivers.

create or replace function public.get_my_child_payments(
  p_student_id uuid,
  p_limit integer DEFAULT 50
)
returns table(
  collection_id uuid,
  amount numeric,
  payment_method text,
  reference_number text,
  term text,
  academic_year integer,
  collected_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.assert_parent_of(p_student_id);

  return query
  select
    fp.id,
    fp.amount,
    fp.payment_method,
    fp.reference_number,
    fp.term,
    fp.academic_year,
    fp.paid_at
  from public.fee_payments fp
  where fp.student_id = p_student_id
    and fp.tenant_id = v_tenant
    and coalesce(fp.type, 'payment') = 'payment'
  order by fp.paid_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$function$;

revoke all on function public.get_my_child_payments(uuid, integer) from public, anon;
grant execute on function public.get_my_child_payments(uuid, integer) to authenticated, service_role;

create or replace function public.get_my_child_fees(p_student_id uuid)
returns table(vote_head_id uuid, vote_head_name text, balance numeric)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
  v_period record;
begin
  v_tenant := public.assert_parent_of(p_student_id);

  select td.academic_year, td.term into v_period
  from public.term_dates td
  where td.tenant_id = v_tenant
  order by
    case
      when current_date between td.opening_date and td.closing_date then 0
      when td.opening_date <= current_date then 1
      else 2
    end,
    td.opening_date asc
  limit 1;

  if v_period.academic_year is null then
    return;
  end if;

  return query
  select
    fs.id,
    fs.name,
    fs.amount - coalesce(vnet.paid_net, 0) - coalesce(vwaived.waived, 0) as balance
  from public.fee_structures fs
  join public.students s
    on s.class_id = fs.class_id
   and s.tenant_id = fs.tenant_id
  cross join lateral (
    select coalesce(sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end), 0) as paid_net
    from public.fee_payments fp
    where fp.student_id = s.id
      and fp.tenant_id = s.tenant_id
      and (fs.academic_year is null or fp.academic_year = fs.academic_year)
      and (fs.term is null or fp.term = fs.term)
  ) vnet
  cross join lateral (
    select coalesce(sum(fw.amount), 0) as waived
    from public.fee_waivers fw
    where fw.student_id = s.id
      and fw.tenant_id = s.tenant_id
      and fw.status = 'approved'
      and fw.applied_at is not null
  ) vwaived
  where s.id = p_student_id
    and fs.is_active = true
    and fs.academic_year = v_period.academic_year
    and fs.term = v_period.term;
end;
$function$;

revoke all on function public.get_my_child_fees(uuid) from public, anon;
grant execute on function public.get_my_child_fees(uuid) to authenticated, service_role;
