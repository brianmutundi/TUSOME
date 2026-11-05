-- Fix daily_attendance column name (attendance_date, not date).
create or replace function public.get_my_child_attendance(
  p_student_id    uuid,
  p_academic_year integer default null,
  p_term          text    default null
)
returns table(status text, days bigint)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
  v_period record;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_attendance');

  if p_academic_year is null then
    select ct.academic_year, ct.term into v_period
    from public.get_current_term(v_tenant) ct;
  else
    v_period.academic_year := p_academic_year;
    v_period.term          := p_term;
  end if;

  return query
  select da.status, count(*)::bigint as days
  from public.daily_attendance da
  where da.student_id = p_student_id
    and da.tenant_id  = v_tenant
    and extract(year from da.attendance_date)::integer = coalesce(v_period.academic_year, extract(year from current_date)::integer)
  group by da.status
  order by da.status;

  perform public.log_parent_access(p_student_id, 'attendance');
end;
$function$;

create or replace function public.get_my_child_absences(
  p_student_id    uuid,
  p_academic_year integer default null,
  p_term          text    default null
)
returns table(absence_date date, status text, reason text)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
  v_period record;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_attendance');

  if p_academic_year is null then
    select ct.academic_year, ct.term into v_period
    from public.get_current_term(v_tenant) ct;
  else
    v_period.academic_year := p_academic_year;
    v_period.term          := p_term;
  end if;

  return query
  select
    da.attendance_date,
    da.status,
    da.absence_reason
  from public.daily_attendance da
  where da.student_id = p_student_id
    and da.tenant_id  = v_tenant
    and da.status     <> 'present'
    and extract(year from da.attendance_date)::integer = coalesce(v_period.academic_year, extract(year from current_date)::integer)
  order by da.attendance_date desc
  limit 200;
end;
$function$;

revoke all on function public.get_my_child_attendance(uuid, integer, text) from public, anon;
grant execute on function public.get_my_child_attendance(uuid, integer, text) to authenticated, service_role;
revoke all on function public.get_my_child_absences(uuid, integer, text) from public, anon;
grant execute on function public.get_my_child_absences(uuid, integer, text) to authenticated, service_role;
