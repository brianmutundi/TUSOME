create or replace function public.get_finance_overview(
  p_academic_year integer default null,
  p_term text default null,
  p_class_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_charges numeric := 0;
  v_collected numeric := 0;
  v_waivers numeric := 0;
  v_reversals numeric := 0;
  v_outstanding numeric := 0;
  v_rate numeric := 0;
  v_learners int := 0;
  v_fully_paid int := 0;
  v_in_arrears int := 0;
  v_in_credit int := 0;
  v_payments_count int := 0;
  v_receipts_unmatched int := 0;
  v_by_class jsonb := '[]'::jsonb;
  v_monthly jsonb := '[]'::jsonb;
  v_by_method jsonb := '[]'::jsonb;
  v_largest jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
begin
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;

  if v_role is distinct from 'service_role' then
    begin
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    exception when others then
      v_caller_tenant := null;
    end;
    if v_caller_tenant is null then
      raise exception 'Missing tenant claim';
    end if;
    if not (public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees') or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees')) then
      raise exception 'Access denied: finance permission required' using errcode = '42501';
    end if;
  end if;

  select coalesce(sum(fs.amount * s.cnt), 0) into v_charges
  from public.fee_structures fs
  cross join lateral (select count(*) as cnt from public.students s where s.class_id = fs.class_id and (v_role = 'service_role' or s.tenant_id = v_caller_tenant)) s
  where (v_role = 'service_role' or fs.tenant_id = v_caller_tenant)
    and fs.is_active = true
    and (p_class_id is null or fs.class_id = p_class_id)
    and (p_academic_year is null or fs.academic_year = p_academic_year)
    and (p_term is null or fs.term = p_term);

  select coalesce(sum(fc.amount), 0), count(*) into v_collected, v_payments_count
  from public.fee_collections fc
  left join public.students s on s.id = fc.student_id
  where (v_role = 'service_role' or fc.tenant_id = v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and (p_academic_year is null or fc.academic_year = p_academic_year)
    and (p_term is null or fc.term = p_term);

  select coalesce(sum(pa.amount), 0) into v_waivers
  from public.payment_allocations pa
  join public.fee_payments fp on fp.id = pa.payment_id
  left join public.students s on s.id = fp.student_id
  where (v_role = 'service_role' or pa.tenant_id = v_caller_tenant)
    and pa.kind = 'credit'
    and (p_class_id is null or s.class_id = p_class_id)
    and (p_academic_year is null or fp.academic_year = p_academic_year)
    and (p_term is null or fp.term = p_term);

  select coalesce(sum(fc.amount), 0) into v_reversals
  from public.fee_collections fc
  left join public.students s on s.id = fc.student_id
  where (v_role = 'service_role' or fc.tenant_id = v_caller_tenant)
    and fc.collection_type = 'feeReversal'
    and (p_class_id is null or s.class_id = p_class_id)
    and (p_academic_year is null or fc.academic_year = p_academic_year)
    and (p_term is null or fc.term = p_term);

  v_outstanding := v_charges - v_collected - v_waivers + v_reversals;

  if v_charges > 0 then
    v_rate := round((v_collected / v_charges) * 100, 2);
  end if;

  select count(distinct s.id) into v_learners
  from public.students s
  join public.fee_structures fs on fs.class_id = s.class_id
  where (v_role = 'service_role' or s.tenant_id = v_caller_tenant)
    and fs.is_active = true
    and (p_class_id is null or s.class_id = p_class_id)
    and (p_academic_year is null or fs.academic_year = p_academic_year)
    and (p_term is null or fs.term = p_term);

  select count(*) into v_fully_paid
  from public.students s
  where (v_role = 'service_role' or s.tenant_id = v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and (
      coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id = s.class_id and fs.is_active = true and (p_academic_year is null or fs.academic_year = p_academic_year) and (p_term is null or fs.term = p_term)), 0)
      - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id = s.id and (p_academic_year is null or fp.academic_year = p_academic_year) and (p_term is null or fp.term = p_term)), 0)
    ) = 0;

  select count(*) into v_in_arrears
  from public.students s
  where (v_role = 'service_role' or s.tenant_id = v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and (
      coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id = s.class_id and fs.is_active = true and (p_academic_year is null or fs.academic_year = p_academic_year) and (p_term is null or fs.term = p_term)), 0)
      - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id = s.id and (p_academic_year is null or fp.academic_year = p_academic_year) and (p_term is null or fp.term = p_term)), 0)
    ) > 0;

  select count(*) into v_in_credit
  from public.students s
  where (v_role = 'service_role' or s.tenant_id = v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and (
      coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id = s.class_id and fs.is_active = true and (p_academic_year is null or fs.academic_year = p_academic_year) and (p_term is null or fs.term = p_term)), 0)
      - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id = s.id and (p_academic_year is null or fp.academic_year = p_academic_year) and (p_term is null or fp.term = p_term)), 0)
    ) < 0;

  select count(*) into v_receipts_unmatched
  from public.receipts r
  where (v_role = 'service_role' or r.tenant_id = v_caller_tenant)
    and r.invoice_id is null
    and (p_class_id is null or exists (select 1 from public.students s where s.id = (select student_id from public.fee_payments fp where fp.id = r.payment_id) and s.class_id = p_class_id));

  select coalesce(jsonb_agg(jsonb_build_object(
    'class_name', class_name,
    'learners', learners,
    'billed', billed,
    'collected', collected,
    'waivers', waivers,
    'outstanding', outstanding,
    'rate', case when billed > 0 then round((collected / billed) * 100, 2) else 0 end
  ) order by class_name), '[]'::jsonb)
  into v_by_class
  from (
    select
      c.name as class_name,
      count(distinct s.id) as learners,
      coalesce(sum(distinct fs.amount * (select count(*) from public.students s2 where s2.class_id = c.id)), 0) as billed,
      coalesce((select sum(fc.amount) from public.fee_collections fc join public.students s2 on s2.id = fc.student_id where s2.class_id = c.id and (p_academic_year is null or fc.academic_year = p_academic_year) and (p_term is null or fc.term = p_term)), 0) as collected,
      0::numeric as waivers,
      coalesce(sum(distinct fs.amount * (select count(*) from public.students s2 where s2.class_id = c.id)), 0) - coalesce((select sum(fc.amount) from public.fee_collections fc join public.students s2 on s2.id = fc.student_id where s2.class_id = c.id and (p_academic_year is null or fc.academic_year = p_academic_year) and (p_term is null or fc.term = p_term)), 0) as outstanding
    from public.classes c
    join public.students s on s.class_id = c.id
    left join public.fee_structures fs on fs.class_id = c.id and fs.is_active = true and (p_academic_year is null or fs.academic_year = p_academic_year) and (p_term is null or fs.term = p_term)
    where (v_role = 'service_role' or c.tenant_id = v_caller_tenant)
      and (p_class_id is null or c.id = p_class_id)
    group by c.id, c.name
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('month', month, 'total', total) order by month), '[]'::jsonb)
  into v_monthly
  from (
    select extract(month from fc.collected_at)::int as month, sum(fc.amount) as total
    from public.fee_collections fc
    left join public.students s on s.id = fc.student_id
    where (v_role = 'service_role' or fc.tenant_id = v_caller_tenant)
      and (p_class_id is null or s.class_id = p_class_id)
      and (p_academic_year is null or fc.academic_year = p_academic_year)
      and (p_term is null or fc.term = p_term)
    group by extract(month from fc.collected_at)::int
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('method', payment_method, 'total', total, 'percentage', case when v_collected > 0 then round((total / v_collected) * 100, 2) else 0 end) order by total desc), '[]'::jsonb)
  into v_by_method
  from (
    select fc.payment_method, sum(fc.amount) as total
    from public.fee_collections fc
    left join public.students s on s.id = fc.student_id
    where (v_role = 'service_role' or fc.tenant_id = v_caller_tenant)
      and (p_class_id is null or s.class_id = p_class_id)
      and (p_academic_year is null or fc.academic_year = p_academic_year)
      and (p_term is null or fc.term = p_term)
    group by fc.payment_method
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('student_id', student_id, 'name', student_name, 'admission_no', admission_no, 'class_name', class_name, 'balance', balance) order by balance desc), '[]'::jsonb)
  into v_largest
  from (
    select s.id as student_id, s.full_name as student_name, s.admission_no, c.name as class_name,
      (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id = s.class_id and fs.is_active = true and (p_academic_year is null or fs.academic_year = p_academic_year) and (p_term is null or fs.term = p_term)), 0)
       - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id = s.id and (p_academic_year is null or fp.academic_year = p_academic_year) and (p_term is null or fp.term = p_term)), 0)) as balance
    from public.students s
    left join public.classes c on c.id = s.class_id
    where (v_role = 'service_role' or s.tenant_id = v_caller_tenant)
      and (p_class_id is null or s.class_id = p_class_id)
    order by balance desc
    limit 5
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('receipt_number', receipt_number, 'amount', amount_paid, 'student_name', student_name, 'date', paid_at) order by paid_at desc), '[]'::jsonb)
  into v_recent
  from (
    select r.receipt_number, r.amount_paid, s.full_name as student_name, r.paid_at
    from public.receipts r
    left join public.fee_payments fp on fp.id = r.payment_id
    left join public.students s on s.id = fp.student_id
    where (v_role = 'service_role' or r.tenant_id = v_caller_tenant)
    order by r.paid_at desc
    limit 5
  ) x;

  return jsonb_build_object(
    'charges', v_charges,
    'collected', v_collected,
    'waivers', v_waivers,
    'reversals', v_reversals,
    'outstanding', v_outstanding,
    'collection_rate', v_rate,
    'learners_billed', v_learners,
    'fully_paid', v_fully_paid,
    'in_arrears', v_in_arrears,
    'in_credit', v_in_credit,
    'payments_received', v_payments_count,
    'receipts_unmatched', v_receipts_unmatched,
    'by_class', v_by_class,
    'monthly_collected', v_monthly,
    'by_method', v_by_method,
    'largest_balances', v_largest,
    'recent_payments', v_recent
  );
end;
$function$;

grant execute on function public.get_finance_overview(integer, text, uuid) to authenticated, service_role;
