-- Teacher scoping tests: unallocated teachers are denied at the DB layer.
-- Runs as the RLS-enforcing authenticated role; rolls back.
-- Usage: supabase db query --linked -f supabase/tests/teacher_scoping.sql

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"26bfc651-325a-454b-8de4-a703a41c71eb","tenant_id":"951758c7-2646-47b6-91c9-33b2699b7313"}', true);

create temporary table teacher_scoping_results(name text, passed boolean, detail text) on commit drop;

do $$
declare
  v_teacher constant uuid := '26bfc651-325a-454b-8de4-a703a41c71eb';
  v_exam constant uuid := '8889d0f3-6573-45e6-a9d7-5429b9905798';
  v_class constant uuid := '15fe9a08-8505-4ec5-b4a2-924ac7df534f';
  v_subject constant uuid := '1f9b2e52-e98e-40a5-bb57-023e26a38150';
begin
  insert into teacher_scoping_results
  values ('teacher_has_allocation = false for unallocated class/subject',
          not public.teacher_has_allocation(v_teacher, v_class, v_subject), '');

  begin
    perform public.get_exam_mark_entry_roster(v_exam, v_subject, v_class, null);
    insert into teacher_scoping_results values ('roster denies unallocated teacher', false, 'no exception raised');
  exception when others then
    insert into teacher_scoping_results values ('roster denies unallocated teacher',
      sqlerrm like 'Access denied: not allocated%', sqlstate || ': ' || left(sqlerrm, 80));
  end;

  begin
    perform public.save_exam_subject_marks(v_exam, v_subject, '[]'::jsonb);
    insert into teacher_scoping_results values ('save marks denies unallocated teacher', false, 'no exception raised');
  exception when others then
    insert into teacher_scoping_results values ('save marks denies unallocated teacher',
      sqlerrm like 'Access denied: not allocated%', sqlstate || ': ' || left(sqlerrm, 80));
  end;
end $$;

select
  (select json_agg(json_build_object('name', name, 'passed', passed, 'detail', detail)) from teacher_scoping_results) as results,
  case when bool_and(passed) then 'TEACHER_SCOPING: ALL PASS' else 'TEACHER_SCOPING: FAILURES' end as summary
from teacher_scoping_results;

rollback;
