-- Parent messages: the class-teacher lookup now uses the CURRENT academic year (CONTINUATION item 6).
-- Before: the latest academic_year on file for the class (so a school that had not re-assigned for
-- a new year kept its old class teachers). Now: the calendar year in Nairobi, matching how the rest
-- of the portal picks the year. If no class teacher is assigned for the current year the lookup
-- returns nobody, so a "class teacher" thread falls back to admin, as it already does for a class
-- with no class teacher at all. Schools must therefore re-assign class teachers each January.
create or replace function public.parent_msg_class_teachers(
  p_tenant uuid,
  p_class  uuid,
  p_stream uuid
)
returns table(teacher_id uuid)
language sql
stable
set search_path = ''
as $function$
  select distinct cta.teacher_id as teacher_id
  from public.class_teacher_assignments cta
  join public.profiles tp
    on tp.id = cta.teacher_id and tp.tenant_id = p_tenant
  where cta.tenant_id = p_tenant
    and cta.class_id = p_class
    and (cta.stream_id is null or cta.stream_id = p_stream)
    and tp.is_active
    and not coalesce(tp.access_revoked, false)
    and cta.academic_year = extract(year from (now() at time zone 'Africa/Nairobi'))::integer
$function$;

revoke all on function public.parent_msg_class_teachers(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.parent_msg_class_teachers(uuid, uuid, uuid) to service_role;
