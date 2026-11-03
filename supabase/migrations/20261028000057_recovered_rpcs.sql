-- get_fee_balances
CREATE OR REPLACE FUNCTION public.get_fee_balances(p_search text DEFAULT NULL::text, p_class_id uuid DEFAULT NULL::uuid, p_term text DEFAULT NULL::text, p_academic_year integer DEFAULT NULL::integer, p_balance_filter text DEFAULT 'all'::text, p_min_balance numeric DEFAULT NULL::numeric, p_max_balance numeric DEFAULT NULL::numeric, p_sort_by text DEFAULT 'admission_no'::text, p_sort_dir text DEFAULT 'asc'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
      (p_balance_filter = 'paid' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) = 0) or
      (p_balance_filter = 'outstanding' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) > 0) or
      (p_balance_filter = 'above5000' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) > 5000) or
      (p_balance_filter = 'above10000' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) > 10000) or
      (p_balance_filter = 'custom' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) >= coalesce(p_min_balance,0) and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) <= coalesce(p_max_balance,999999999))
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
      coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0) as total_paid,
      (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) as balance
    from public.students s
    left join public.classes c on c.id = s.class_id
    where (v_role='service_role' or s.tenant_id=v_caller_tenant)
      and (p_search is null or p_search='' or s.full_name ilike '%'||p_search||'%' or s.admission_no ilike '%'||p_search||'%')
      and (p_class_id is null or s.class_id = p_class_id)
      and (
        p_balance_filter = 'all' or
        (p_balance_filter = 'paid' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) = 0) or
        (p_balance_filter = 'outstanding' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) > 0) or
        (p_balance_filter = 'above5000' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) > 5000) or
        (p_balance_filter = 'above10000' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) > 10000) or
        (p_balance_filter = 'custom' and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) >= coalesce(p_min_balance,0) and (coalesce((select sum(fs.amount) from public.fee_structures fs where fs.class_id=s.class_id and fs.is_active=true and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.student_id=s.id and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0)) <= coalesce(p_max_balance,999999999))
      )
    order by
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
      'total_paid', coalesce((select sum(fp.amount) from public.fee_payments fp join public.students s on s.id=fp.student_id where (v_role='service_role' or fp.tenant_id=v_caller_tenant) and (p_class_id is null or s.class_id=p_class_id) and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0),
      'outstanding', coalesce((select sum(fs.amount) from public.fee_structures fs join public.students s on s.class_id=fs.class_id where (v_role='service_role' or fs.tenant_id=v_caller_tenant) and fs.is_active=true and (p_class_id is null or s.class_id=p_class_id) and (p_academic_year is null or fs.academic_year=p_academic_year) and (p_term is null or fs.term=p_term)),0) - coalesce((select sum(fp.amount) from public.fee_payments fp join public.students s on s.id=fp.student_id where (v_role='service_role' or fp.tenant_id=v_caller_tenant) and (p_class_id is null or s.class_id=p_class_id) and (p_academic_year is null or fp.academic_year=p_academic_year) and (p_term is null or fp.term=p_term)),0),
      'total_learners', v_total
    )
  );
end;
$function$


-- get_finance_summary
CREATE OR REPLACE FUNCTION public.get_finance_summary(p_class_id uuid DEFAULT NULL::uuid, p_academic_year integer DEFAULT NULL::integer, p_term text DEFAULT NULL::text, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_collected numeric := 0;
  v_invoice_total numeric := 0;
  v_outstanding numeric := 0;
  v_invoice_count int := 0;
  v_collection_count int := 0;
  v_payment_methods jsonb := '[]'::jsonb;
  v_by_class jsonb := '[]'::jsonb;
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
  end if;

  select coalesce(sum(fc.amount),0), count(*) into v_collected, v_collection_count
  from public.fee_collections fc
  left join public.students s on s.id = fc.student_id
  where (v_role='service_role' or fc.tenant_id=v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and (p_academic_year is null or fc.academic_year = p_academic_year)
    and (p_term is null or fc.term = p_term)
    and (p_start_date is null or fc.collected_at >= p_start_date)
    and (p_end_date is null or fc.collected_at <= p_end_date);

  select coalesce(sum(i.total_amount),0), count(*) into v_invoice_total, v_invoice_count
  from public.invoices i
  left join public.students s on s.id = i.student_id
  where (v_role='service_role' or i.tenant_id=v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and i.status not in ('cancelled','void');

  select coalesce(sum(i.total_amount),0) into v_outstanding
  from public.invoices i
  left join public.students s on s.id = i.student_id
  where (v_role='service_role' or i.tenant_id=v_caller_tenant)
    and (p_class_id is null or s.class_id = p_class_id)
    and i.status not in ('cancelled','void','paid');

  select coalesce(jsonb_agg(jsonb_build_object('method', payment_method, 'total', total)), '[]'::jsonb)
  into v_payment_methods
  from (
    select fc.payment_method, sum(fc.amount) as total
    from public.fee_collections fc
    left join public.students s on s.id = fc.student_id
    where (v_role='service_role' or fc.tenant_id=v_caller_tenant)
      and (p_class_id is null or s.class_id = p_class_id)
      and (p_academic_year is null or fc.academic_year = p_academic_year)
      and (p_term is null or fc.term = p_term)
      and (p_start_date is null or fc.collected_at >= p_start_date)
      and (p_end_date is null or fc.collected_at <= p_end_date)
    group by fc.payment_method
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('class', class_name, 'total', total)), '[]'::jsonb)
  into v_by_class
  from (
    select c.name as class_name, sum(fc.amount) as total
    from public.fee_collections fc
    join public.students s on s.id = fc.student_id
    left join public.classes c on c.id = s.class_id
    where (v_role='service_role' or fc.tenant_id=v_caller_tenant)
      and (p_class_id is null or s.class_id = p_class_id)
      and (p_academic_year is null or fc.academic_year = p_academic_year)
      and (p_term is null or fc.term = p_term)
      and (p_start_date is null or fc.collected_at >= p_start_date)
      and (p_end_date is null or fc.collected_at <= p_end_date)
    group by c.name
  ) x;

  return jsonb_build_object(
    'collected', v_collected,
    'collection_count', v_collection_count,
    'invoice_total', v_invoice_total,
    'invoice_count', v_invoice_count,
    'outstanding', v_outstanding,
    'payment_methods', v_payment_methods,
    'by_class', v_by_class
  );
end;
$function$


-- get_schools
CREATE OR REPLACE FUNCTION public.get_schools()
 RETURNS TABLE(id uuid, name text, created_at timestamp with time zone, owner_email text, owner_name text, subscription_status text, subscription_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if public.normalize_role_key(coalesce(public.get_user_permission_profile(auth.uid()) ->> 'role', '')) <> 'super admin' then
    raise exception 'Only platform super admins can list schools' using errcode = '42501';
  end if;
  return query
  select t.id, t.name, t.created_at,
         u.email::text,
         p.full_name,
         t.subscription_status,
         t.subscription_expires_at
  from public.tenants t
  left join public.profiles p
    on p.tenant_id = t.id
   and public.normalize_role_key(p.role) = 'owner'
  left join auth.users u on u.id = p.id
  where coalesce(t.is_platform, false) = false
  order by t.created_at desc;
end;
$function$


-- delete_school
CREATE OR REPLACE FUNCTION public.delete_school(p_tenant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner uuid;
begin
  if public.normalize_role_key(coalesce(public.get_user_permission_profile(auth.uid()) ->> 'role', '')) <> 'super admin' then
    raise exception 'Only platform super admins can delete schools' using errcode = '42501';
  end if;
  select id into v_owner
  from public.profiles
  where tenant_id = p_tenant_id
    and public.normalize_role_key(role) = 'owner'
  limit 1;
  delete from public.tenants where id = p_tenant_id;
  return v_owner;
end;
$function$


-- delete_class
CREATE OR REPLACE FUNCTION public.delete_class(p_class_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_caller_tenant uuid;
  v_role text;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;
  if v_role is distinct from 'service_role' then
    begin v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_caller_tenant := null; end;
    if v_caller_tenant is null then raise exception 'Missing tenant claim'; end if;
    if not exists (select 1 from public.classes where id=p_class_id and tenant_id=v_caller_tenant) then
      raise exception 'Class not found' using errcode='404';
    end if;
    if not (public.user_has_permission(auth.uid(), v_caller_tenant, 'delete-classes') or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-classes')) then
      raise exception 'Not authorized' using errcode='42501';
    end if;
  end if;
  delete from public.classes where id = p_class_id;
end;
$function$


-- delete_stream
CREATE OR REPLACE FUNCTION public.delete_stream(p_stream_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_caller_tenant uuid;
  v_role text;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;
  if v_role is distinct from 'service_role' then
    begin v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_caller_tenant := null; end;
    if v_caller_tenant is null then raise exception 'Missing tenant claim'; end if;
    if not exists (select 1 from public.streams where id=p_stream_id and tenant_id=v_caller_tenant) then
      raise exception 'Stream not found' using errcode='404';
    end if;
    if not (public.user_has_permission(auth.uid(), v_caller_tenant, 'delete-classes') or public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-classes')) then
      raise exception 'Not authorized' using errcode='42501';
    end if;
  end if;
  delete from public.streams where id = p_stream_id;
end;
$function$


-- create_report_share_token
CREATE OR REPLACE FUNCTION public.create_report_share_token(p_student_id uuid, p_exam_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_token text;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if public.normalize_role_key(coalesce(public.get_user_permission_profile(v_uid) ->> 'role', '')) not in ('super admin','admin','owner','principal','director') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null then raise exception 'Student not found'; end if;
  if not exists (select 1 from public.exams where id = p_exam_id and tenant_id = v_tenant) then
    raise exception 'Exam not found';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  insert into public.report_share_tokens (token, tenant_id, student_id, exam_id, expires_at)
  values (v_token, v_tenant, p_student_id, p_exam_id, now() + interval '30 days');
  return v_token;
end;
$function$


-- get_shared_report
CREATE OR REPLACE FUNCTION public.get_shared_report(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row record;
  v_student jsonb;
  v_school jsonb;
  v_exam jsonb;
  v_subjects jsonb;
  v_overall numeric;
begin
  select * into v_row from public.report_share_tokens where token = p_token and expires_at > now();
  if not found then
    raise exception 'Invalid or expired link';
  end if;

  select jsonb_build_object(
    'id', s.id, 'admission_no', s.admission_no, 'name', s.full_name,
    'class', (select name from public.classes where id = s.class_id),
    'stream', (select name from public.streams where id = s.stream_id),
    'academic_year', null, 'gender', s.gender
  ) into v_student
  from public.students s where s.id = v_row.student_id;

  select jsonb_build_object('name', t.name) into v_school
  from public.tenants t where t.id = v_row.tenant_id;

  select jsonb_build_object('id', e.id, 'name', e.name, 'term', e.term, 'year', e.academic_year, 'assessment_component', e.assessment_component)
  into v_exam
  from public.exams e where e.id = v_row.exam_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject_id', sub.id, 'subject_name', sub.name, 'subject_code', sub.code,
    'score', m.score, 'percentage', m.score,
    'grade', (select code from public.grading_configuration_levels gcl join public.grading_configurations gc on gc.id=gcl.config_id where gc.tenant_id=v_row.tenant_id and gc.active=true and m.score between gcl.min_percent and gcl.max_percent limit 1)
  ) order by sub.name), '[]'::jsonb)
  into v_subjects
  from public.marks m
  join public.subjects sub on sub.id = m.subject_id
  where m.exam_id = v_row.exam_id and m.student_id = v_row.student_id;

  select avg(m.score) into v_overall from public.marks m where m.exam_id = v_row.exam_id and m.student_id = v_row.student_id;

  return jsonb_build_object(
    'student', v_student,
    'school', v_school,
    'exam', v_exam,
    'subjects', v_subjects,
    'overall', jsonb_build_object('mean', v_overall, 'mean_percentage', v_overall, 'total_score', v_overall, 'subjects_count', jsonb_array_length(v_subjects)),
    'position', null
  );
end;
$function$


-- update_school_subscription
CREATE OR REPLACE FUNCTION public.update_school_subscription(p_tenant_id uuid, p_status text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.normalize_role_key(coalesce(public.get_user_permission_profile(auth.uid()) ->> 'role', '')) <> 'super admin' then
    raise exception 'Only platform super admins can manage subscriptions' using errcode = '42501';
  end if;
  if p_status not in ('active', 'trial', 'suspended', 'expired') then
    raise exception 'Invalid subscription status';
  end if;
  update public.tenants
  set subscription_status = p_status,
      subscription_expires_at = p_expires_at
  where id = p_tenant_id;
  if not found then
    raise exception 'School not found';
  end if;
end;
$function$


