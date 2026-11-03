-- Reconcile fee balance RPCs with reversals and complete numeric sorting.
-- Reversal rows store a positive amount with type='reversal'; subtract them
-- from the original payments when computing net paid amounts.
create or replace function public.get_fee_balances(
  p_search text default null,
  p_class_id uuid default null,
  p_term text default null,
  p_academic_year integer default null,
  p_balance_filter text default 'all',
  p_min_balance numeric default null,
  p_max_balance numeric default null,
  p_sort_by text default 'admission_no',
  p_sort_dir text default 'asc',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_offset int;
  v_total int;
  v_total_pages int;
  v_rows jsonb;
  v_page int;
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

  v_page := greatest(coalesce(p_page, 1), 1);
  v_offset := (v_page - 1) * greatest(coalesce(p_page_size, 25), 1);

  -- total count
  select count(*) into v_total
  from public.students s
  where (v_role='service_role' or s.tenant_id=v_caller_tenant)
    and (p_search is null or p_search='' or s.full_name ilike '%'||p_search||'%' or s.admission_no ilike '%'||p_search||'%')
    and (p_class_id is null or s.class_id = p_class_id)
    and (
      p_balance_filter = 'all' or
      (p_balance_filter = 'paid' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) = 0) or
      (p_balance_filter = 'outstanding' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) > 0) or
      (p_balance_filter = 'above5000' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) > 5000) or
      (p_balance_filter = 'above10000' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) > 10000) or
      (p_balance_filter = 'custom' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) >= coalesce(p_min_balance,0) and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) <= coalesce(p_max_balance,999999999))
    );

  v_total_pages := ceil(v_total::numeric / greatest(coalesce(p_page_size,25),1));
  if (v_total > 0 and v_page > v_total_pages) then
    v_page := v_total_pages;
    v_offset := (v_page - 1) * greatest(coalesce(p_page_size,25),1);
  end if;

  -- rows
  select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) into v_rows
  from (
    select
      s.id as student_id,
      s.admission_no,
      s.full_name as student_name,
      c.name as class_name,
      coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) as total_fees,
      coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) as total_paid,
      (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) as balance
    from public.students s
    left join public.classes c on c.id = s.class_id
    where (v_role='service_role' or s.tenant_id=v_caller_tenant)
      and (p_search is null or p_search='' or s.full_name ilike '%'||p_search||'%' or s.admission_no ilike '%'||p_search||'%')
      and (p_class_id is null or s.class_id = p_class_id)
      and (
        p_balance_filter = 'all' or
        (p_balance_filter = 'paid' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) = 0) or
        (p_balance_filter = 'outstanding' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) > 0) or
        (p_balance_filter = 'above5000' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) > 5000) or
        (p_balance_filter = 'above10000' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) > 10000) or
        (p_balance_filter = 'custom' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) >= coalesce(p_min_balance,0) and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw where fw.student_id=s.id and fw.tenant_id=s.tenant_id and fw.status='approved' and fw.applied_at is not null),0)) <= coalesce(p_max_balance,999999999))
      )
    order by
      case when p_sort_dir='asc' and p_sort_by='total_fees' then total_fees end asc,
      case when p_sort_dir='desc' and p_sort_by='total_fees' then total_fees end desc,
      case when p_sort_dir='asc' and p_sort_by='total_paid' then total_paid end asc,
      case when p_sort_dir='desc' and p_sort_by='total_paid' then total_paid end desc,
      case when p_sort_dir='asc' and p_sort_by='balance' then balance end asc,
      case when p_sort_dir='desc' and p_sort_by='balance' then balance end desc,
      case when p_sort_dir='asc' then
        case p_sort_by
          when 'admission_no' then s.admission_no
          when 'student_name' then s.full_name
          when 'class_name' then c.name
          else s.admission_no
        end
      end asc,
      case when p_sort_dir='desc' then
        case p_sort_by
          when 'admission_no' then s.admission_no
          when 'student_name' then s.full_name
          when 'class_name' then c.name
          else s.admission_no
        end
      end desc
    limit greatest(coalesce(p_page_size,25),1)
    offset v_offset
  ) r;

  return jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', v_total,
    'page', v_page,
    'page_size', greatest(coalesce(p_page_size,25),1),
    'summary', jsonb_build_object(
      'total_fees', coalesce((select sum(fs.amount) from public.fee_structures fs join public.students s on s.class_id=fs.class_id where (v_role='service_role' or fs.tenant_id=v_caller_tenant) and fs.is_active=true and (p_class_id is null or s.class_id=p_class_id) and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0),
      'total_paid', coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp join public.students s on s.id=fp.student_id where (v_role='service_role' or fp.tenant_id=v_caller_tenant) and (p_class_id is null or s.class_id=p_class_id) and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0),
      'outstanding', coalesce((select sum(fs.amount) from public.fee_structures fs join public.students s on s.class_id=fs.class_id where (v_role='service_role' or fs.tenant_id=v_caller_tenant) and fs.is_active=true and (p_class_id is null or s.class_id=p_class_id) and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end) from public.fee_payments fp join public.students s on s.id=fp.student_id where (v_role='service_role' or fp.tenant_id=v_caller_tenant) and (p_class_id is null or s.class_id=p_class_id) and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) - coalesce((select sum(fw.amount) from public.fee_waivers fw join public.students sw on sw.id=fw.student_id and sw.tenant_id=fw.tenant_id where (v_role='service_role' or fw.tenant_id=v_caller_tenant) and fw.status='approved' and fw.applied_at is not null and (p_class_id is null or sw.class_id=p_class_id)),0),
      'total_learners', v_total
    )
  );
end;
$function$;

grant execute on function public.get_fee_balances(text, uuid, text, integer, text, numeric, numeric, text, text, integer, integer) to authenticated, service_role;

create or replace function public.get_student_fee_balance(p_student_id uuid, p_academic_year integer default null, p_term text default null)
returns jsonb
language plpgsql
stable
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_total_fees numeric;
  v_total_paid numeric;
  v_total_waivers numeric;
  v_balance numeric;
  v_student_name text;
  v_admission_no text;
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
    if not (
      public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees')
      or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees')
    ) then
      raise exception 'Access denied: finance permission required' using errcode = '42501';
    end if;
  end if;

  select s.full_name, s.admission_no into v_student_name, v_admission_no
  from public.students s
  where s.id = p_student_id
    and (v_role = 'service_role' or s.tenant_id = v_caller_tenant);

  select coalesce(sum(fs.amount), 0) into v_total_fees
  from public.fee_structures fs
  join public.students s on s.class_id = fs.class_id
  where s.id = p_student_id
    and (v_role = 'service_role' or fs.tenant_id = v_caller_tenant)
    and fs.is_active = true
    and (p_academic_year is null or fs.academic_year = p_academic_year)
    and (p_term is null or fs.term = p_term);

  select coalesce(sum(case when coalesce(fp.type, 'payment') = 'reversal' then -fp.amount else fp.amount end), 0) into v_total_paid
  from public.fee_payments fp
  where (v_role = 'service_role' or fp.tenant_id = v_caller_tenant)
    and fp.student_id = p_student_id
    and (p_academic_year is null or fp.academic_year = p_academic_year)
    and (p_term is null or fp.term = p_term);

  select coalesce(sum(fw.amount), 0) into v_total_waivers
  from public.fee_waivers fw
  where fw.student_id = p_student_id
    and (v_role = 'service_role' or fw.tenant_id = v_caller_tenant)
    and fw.status = 'approved'
    and fw.applied_at is not null;

  v_balance := v_total_fees - v_total_paid - v_total_waivers;

  return jsonb_build_object(
    'student_id', p_student_id,
    'student_name', v_student_name,
    'admission_no', v_admission_no,
    'total_fees', v_total_fees,
    'total_paid', v_total_paid,
    'balance', v_balance
  );
end;
$function$;

revoke all on function public.get_student_fee_balance(uuid, integer, text) from public, anon;
grant execute on function public.get_student_fee_balance(uuid, integer, text) to authenticated, service_role;
