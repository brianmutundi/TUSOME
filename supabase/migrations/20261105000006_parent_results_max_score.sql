-- get_my_child_results now returns max_score so the portal does not assume
-- every mark is out of 100.
--
-- Marks scale check: public.marks has paper_id -> public.subject_papers, whose
-- max_marks defaults to 100. Marks with no paper (the common case) are treated
-- as out of 100, matching get_shared_report, which also reads marks.score as a
-- percentage. Only papers with a different max_marks change the scale.
--
-- Also requires the can_view_academics right, which sponsor links do not hold
-- by default (20261104000018). The previous version only checked the link.
-- Not run against a database here.

drop function if exists public.get_my_child_results(uuid);

create or replace function public.get_my_child_results(p_student_id uuid)
returns table(
  exam_id       uuid,
  exam_name     text,
  term          text,
  academic_year integer,
  subject_name  text,
  score         numeric,
  max_score     numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_academics');

  return query
  select
    e.id,
    e.name,
    e.term,
    e.academic_year,
    sj.name,
    m.score,
    coalesce(sp.max_marks, 100)
  from public.marks m
  join public.exams e on e.id = m.exam_id and e.tenant_id = v_tenant
  join public.subjects sj on sj.id = m.subject_id
  left join public.subject_papers sp on sp.id = m.paper_id and sp.tenant_id = v_tenant
  where m.student_id = p_student_id
    and m.tenant_id = v_tenant
    and e.status = 'published'
  order by e.academic_year desc nulls last, e.created_at desc, sj.name;
end;
$function$;

revoke all on function public.get_my_child_results(uuid) from public, anon;
grant execute on function public.get_my_child_results(uuid) to authenticated, service_role;
