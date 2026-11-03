-- Finance navigation/report consolidation.
-- Historical fee_collections, invoices, pledges and receipts remain untouched.
-- Current finance metrics now derive from the authoritative fee_payments ledger.

create or replace function public.get_finance_overview(
  p_academic_year integer default null,
  p_term text default null,
  p_class_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
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

  select coalesce(sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end), 0), count(*) filter (where coalesce(fp.type, 'payment') = 'payment') into v_collected, v_payments_count
  from public.fee_payments fp
  left join public.students s on s.id = fp.student_id
  where (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and (p_academic_year is null or fp.academic_year = p_academic_year)
    and (p_term is null or fp.term = p_term);

  -- Only approved and applied fee waivers reduce the outstanding liability.
  select coalesce(sum(fw.amount), 0) into v_waivers
  from public.fee_waivers fw
  left join public.students s on s.id = fw.student_id and s.tenant_id = fw.tenant_id
  where (v_role = 'service_role' or fw.tenant_id = v_caller_tenant)
    and fw.status = 'approved'
    and fw.applied_at is not null
    and (p_class_id is null or s.class_id = p_class_id);

  select coalesce(sum(fp.amount), 0) into v_reversals
  from public.fee_payments fp
  left join public.students s on s.id = fp.student_id
  where (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
    and fp.type = 'reversal'
    and (p_class_id is null or s.class_id = p_class_id)
    and (p_academic_year is null or fp.academic_year = p_academic_year)
    and (p_term is null or fp.term = p_term);

  v_outstanding := v_charges - v_collected - v_waivers;

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
      - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id = s.id and (p_academic_year is null or fp.academic_year = p_academic_year) and (p_term is null or fp.term = p_term)), 0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id = s.id and fw.tenant_id = s.tenant_id and fw.status = 'approved' and fw.applied_at is not null), 0)
    ) = 0;

  select count(*) into v_in_arrears
  from public.students s
  where (v_role = 'service_role' or s.tenant_id = v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and (
      coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id = s.class_id and fs.is_active = true and (p_academic_year is null or fs.academic_year = p_academic_year) and (p_term is null or fs.term = p_term)), 0)
      - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id = s.id and (p_academic_year is null or fp.academic_year = p_academic_year) and (p_term is null or fp.term = p_term)), 0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id = s.id and fw.tenant_id = s.tenant_id and fw.status = 'approved' and fw.applied_at is not null), 0)
    ) > 0;

  select count(*) into v_in_credit
  from public.students s
  where (v_role = 'service_role' or s.tenant_id = v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and (
      coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id = s.class_id and fs.is_active = true and (p_academic_year is null or fs.academic_year = p_academic_year) and (p_term is null or fs.term = p_term)), 0)
      - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id = s.id and (p_academic_year is null or fp.academic_year = p_academic_year) and (p_term is null or fp.term = p_term)), 0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id = s.id and fw.tenant_id = s.tenant_id and fw.status = 'approved' and fw.applied_at is not null), 0)
    ) < 0;

  select count(*) into v_receipts_unmatched
  from public.receipts r
  where (v_role = 'service_role' or r.tenant_id = v_caller_tenant)
    and r.invoice_id is null
    and r.payment_id is null
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
      coalesce((
        select sum(fs.amount)
        from public.fee_structures fs
        where fs.class_id = c.id
          and fs.tenant_id = c.tenant_id
          and fs.is_active = true
          and (p_academic_year is null or fs.academic_year = p_academic_year)
          and (p_term is null or fs.term = p_term)
      ), 0) * count(distinct s.id) as billed,
      coalesce((
        select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end)
        from public.fee_payments fp
        join public.students s2 on s2.id = fp.student_id and s2.tenant_id = fp.tenant_id
        where s2.class_id = c.id
          and fp.tenant_id = c.tenant_id
          and (p_academic_year is null or fp.academic_year = p_academic_year)
          and (p_term is null or fp.term = p_term)
      ), 0) as collected,
      coalesce((
        select sum(fw.amount)
        from public.fee_waivers fw
        join public.students sw on sw.id = fw.student_id and sw.tenant_id = fw.tenant_id
        where sw.class_id = c.id
          and fw.tenant_id = c.tenant_id
          and fw.status = 'approved'
          and fw.applied_at is not null
      ), 0) as waivers,
      (
        coalesce((
          select sum(fs.amount)
          from public.fee_structures fs
          where fs.class_id = c.id
            and fs.tenant_id = c.tenant_id
            and fs.is_active = true
            and (p_academic_year is null or fs.academic_year = p_academic_year)
            and (p_term is null or fs.term = p_term)
        ), 0) * count(distinct s.id)
      ) - coalesce((
        select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end)
        from public.fee_payments fp
        join public.students s2 on s2.id = fp.student_id and s2.tenant_id = fp.tenant_id
        where s2.class_id = c.id
          and fp.tenant_id = c.tenant_id
          and (p_academic_year is null or fp.academic_year = p_academic_year)
          and (p_term is null or fp.term = p_term)
      ), 0) - coalesce((
        select sum(fw.amount)
        from public.fee_waivers fw
        join public.students sw on sw.id = fw.student_id and sw.tenant_id = fw.tenant_id
        where sw.class_id = c.id
          and fw.tenant_id = c.tenant_id
          and fw.status = 'approved'
          and fw.applied_at is not null
      ), 0) as outstanding
    from public.classes c
    join public.students s on s.class_id = c.id and s.tenant_id = c.tenant_id
    where (v_role = 'service_role' or c.tenant_id = v_caller_tenant)
      and (p_class_id is null or c.id = p_class_id)
    group by c.id, c.name, c.tenant_id
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('month', month, 'total', total) order by month), '[]'::jsonb)
  into v_monthly
  from (
    select extract(month from fp.paid_at)::int as month, sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) as total
    from public.fee_payments fp
    left join public.students s on s.id = fp.student_id
    where (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
      and (p_class_id is null or s.class_id = p_class_id)
      and (p_academic_year is null or fp.academic_year = p_academic_year)
      and (p_term is null or fp.term = p_term)
    group by extract(month from fp.paid_at)::int
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('method', payment_method, 'total', total, 'percentage', case when v_collected > 0 then round((total / v_collected) * 100, 2) else 0 end) order by total desc), '[]'::jsonb)
  into v_by_method
  from (
    select fp.payment_method, sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) as total
    from public.fee_payments fp
    left join public.students s on s.id = fp.student_id
    where (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
      and (p_class_id is null or s.class_id = p_class_id)
      and (p_academic_year is null or fp.academic_year = p_academic_year)
      and (p_term is null or fp.term = p_term)
    group by fp.payment_method
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('student_id', student_id, 'name', student_name, 'admission_no', admission_no, 'class_name', class_name, 'balance', balance) order by balance desc), '[]'::jsonb)
  into v_largest
  from (
    select s.id as student_id, s.full_name as student_name, s.admission_no, c.name as class_name,
      (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id = s.class_id and fs.is_active = true and (p_academic_year is null or fs.academic_year = p_academic_year) and (p_term is null or fs.term = p_term)), 0)
       - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id = s.id and (p_academic_year is null or fp.academic_year = p_academic_year) and (p_term is null or fp.term = p_term)), 0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id = s.id and fw.tenant_id = s.tenant_id and fw.status = 'approved' and fw.applied_at is not null), 0)) as balance
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

create or replace function public.get_fee_ledger_report(
  p_student_id uuid default null,
  p_limit integer default 500
)
returns table (
  payment_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  amount numeric,
  payment_method text,
  reference_number text,
  academic_year integer,
  term text,
  notes text,
  recorded_by_name text,
  paid_at timestamptz,
  entry_type text,
  reversal_reason text,
  receipt_id uuid,
  receipt_number text
)
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_limit integer;
begin
  v_role := auth.role();
  if v_role is distinct from 'service_role' then
    begin
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    exception when others then
      v_caller_tenant := null;
    end;
    if v_caller_tenant is null then
      raise exception 'Missing tenant claim';
    end if;
    if not (
      public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees')
      or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees')
    ) then
      raise exception 'Access denied: finance permission required' using errcode = '42501';
    end if;
  end if;

  v_limit := least(greatest(coalesce(p_limit, 500), 1), 1000);

  return query
  select
    fp.id,
    fp.student_id,
    s.full_name,
    s.admission_no,
    case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end,
    fp.payment_method,
    fp.reference_number,
    fp.academic_year,
    fp.term,
    fp.notes,
    p.full_name,
    fp.paid_at,
    coalesce(fp.type, 'payment'),
    fp.reversal_reason,
    r.receipt_id,
    r.receipt_number
  from public.fee_payments fp
  left join public.students s on s.id = fp.student_id and s.tenant_id = fp.tenant_id
  left join public.profiles p on p.id = fp.recorded_by
  left join lateral (
    select rc.id as receipt_id, rc.receipt_number
    from public.receipts rc
    where rc.payment_id = fp.id and rc.tenant_id = fp.tenant_id
    order by rc.paid_at desc
    limit 1
  ) r on true
  where (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
    and (p_student_id is null or fp.student_id = p_student_id)
  order by fp.paid_at desc, fp.created_at desc
  limit v_limit;
end;
$function$;

revoke all on function public.get_fee_ledger_report(uuid, integer) from public, anon;
grant execute on function public.get_fee_ledger_report(uuid, integer) to authenticated, service_role;

-- Keep student pledges tenant-bound and permission-checked when surfaced in
-- the selected student's finance workflow.
create or replace function public.get_fee_pledges(p_student_id uuid default null)
returns table (
  pledge_id uuid,
  student_id uuid,
  student_name text,
  admission_no text,
  pledged_amount numeric,
  paid_amount numeric,
  remaining_amount numeric,
  due_date date,
  status text,
  notes text,
  created_at timestamptz
)
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
begin
  v_role := auth.role();
  if v_role is distinct from 'service_role' then
    begin
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    exception when others then
      v_caller_tenant := null;
    end;
    if v_caller_tenant is null then
      raise exception 'Missing tenant claim';
    end if;
    if not (
      public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees')
      or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees')
    ) then
      raise exception 'Access denied: finance permission required' using errcode = '42501';
    end if;
  end if;

  return query
  select
    fp.id,
    fp.student_id,
    st.full_name,
    st.admission_no,
    fp.pledged_amount,
    fp.paid_amount,
    fp.pledged_amount - fp.paid_amount,
    fp.due_date,
    fp.status,
    fp.notes,
    fp.created_at
  from public.fee_pledges fp
  join public.students st on st.id = fp.student_id and st.tenant_id = fp.tenant_id
  where (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
    and (p_student_id is null or fp.student_id = p_student_id)
  order by fp.created_at desc;
end;
$function$;

create or replace function public.create_fee_pledge(
  p_student_id uuid,
  p_pledged_amount numeric,
  p_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_student_tenant uuid;
  v_tenant_id uuid;
  v_role text;
  v_pledge_id uuid;
begin
  v_role := auth.role();
  if v_role is distinct from 'service_role' then
    begin
      v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
    exception when others then
      v_caller_tenant := null;
    end;
    if v_caller_tenant is null then
      raise exception 'Missing tenant claim';
    end if;
    if not public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees') then
      raise exception 'Access denied: manage-fees permission required' using errcode = '42501';
    end if;
  end if;

  select st.tenant_id into v_student_tenant
  from public.students st
  where st.id = p_student_id;

  if v_student_tenant is null then
    raise exception 'Student not found';
  end if;
  if v_role is distinct from 'service_role' and v_student_tenant <> v_caller_tenant then
    raise exception 'Access denied: student from different tenant' using errcode = '42501';
  end if;
  if p_pledged_amount is null or p_pledged_amount <= 0 then
    raise exception 'Pledged amount must be positive';
  end if;

  v_tenant_id := coalesce(v_caller_tenant, v_student_tenant);
  insert into public.fee_pledges (tenant_id, student_id, pledged_amount, due_date, notes, created_by)
  values (
    v_tenant_id,
    p_student_id,
    p_pledged_amount,
    p_due_date,
    nullif(btrim(coalesce(p_notes, '')), ''),
    case when v_role is distinct from 'service_role' then auth.uid() else null end
  )
  returning id into v_pledge_id;

  return v_pledge_id;
end;
$function$;

revoke all on function public.get_fee_pledges(uuid) from public, anon;
revoke all on function public.create_fee_pledge(uuid, numeric, date, text) from public, anon;
grant execute on function public.get_fee_pledges(uuid) to authenticated, service_role;
grant execute on function public.create_fee_pledge(uuid, numeric, date, text) to authenticated, service_role;
