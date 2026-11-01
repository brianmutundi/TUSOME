-- End-to-end Exam -> Marks -> Publish -> Reports pipeline tests.
--
-- Run against a LOCAL / DISPOSABLE database only, after
-- 20261028000007_exam_to_reports_pipeline.sql has been applied:
--
--   npm run db:test
--   -- or --
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/exam_to_reports_pipeline.sql
--
-- Expect: ALL EXAM PIPELINE CHECKS PASSED
--
-- Everything runs in one transaction and is rolled back.
begin;

-- ---------------------------------------------------------------------------
-- 0. Grants and function properties (SECURITY INVOKER, no anon EXECUTE)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  fn_list text[] := array[
    'get_exam_setup_options',
    'get_exam_pipeline_overview',
    'create_exam',
    'get_exam_mark_entry_roster',
    'save_exam_subject_marks',
    'get_exam_publish_readiness',
    'set_exam_lifecycle_status'
  ];
begin
  if (select count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = any(fn_list)) <> 7 then
    raise exception 'FAIL grants: expected 7 exam pipeline functions';
  end if;

  for r in
    select p.oid, p.proname, p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(fn_list)
  loop
    if r.prosecdef then
      raise exception 'FAIL security: % is SECURITY DEFINER', r.proname;
    end if;
    if has_function_privilege('anon', r.oid, 'EXECUTE') then
      raise exception 'FAIL grants: anon can execute %', r.proname;
    end if;
    if not has_function_privilege('authenticated', r.oid, 'EXECUTE') then
      raise exception 'FAIL grants: authenticated cannot execute %', r.proname;
    end if;
    if not has_function_privilege('service_role', r.oid, 'EXECUTE') then
      raise exception 'FAIL grants: service_role cannot execute %', r.proname;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into tenants (id, name) values
  ('f0000000-0000-0000-0000-0000000000a1', 'Pipeline School A'),
  ('f0000000-0000-0000-0000-0000000000b1', 'Pipeline School B');

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-0000000000f1', 'admin@pipeline-a.local'),
  ('f0000000-0000-0000-0000-0000000000f2', 'teacher@pipeline-a.local'),
  ('f0000000-0000-0000-0000-0000000000f3', 'admin@pipeline-b.local');

insert into profiles (id, tenant_id, full_name, role, is_active) values
  ('f0000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-0000000000a1', 'Pipeline Admin A',   'admin',   true),
  ('f0000000-0000-0000-0000-0000000000f2', 'f0000000-0000-0000-0000-0000000000a1', 'Pipeline Teacher A', 'teacher', true),
  ('f0000000-0000-0000-0000-0000000000f3', 'f0000000-0000-0000-0000-0000000000b1', 'Pipeline Admin B',   'admin',   true);

insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('fc000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000a1', '4', true, 'default');

insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('fc000000-0000-0000-0000-0000000000a1', 'EE', 80, 100,   4, 'Exceeding Expectations',   'EE', 0),
  ('fc000000-0000-0000-0000-0000000000a1', 'ME', 60, 79.99, 3, 'Meeting Expectations',     'ME', 1),
  ('fc000000-0000-0000-0000-0000000000a1', 'AE', 30, 59.99, 2, 'Approaching Expectations', 'AE', 2),
  ('fc000000-0000-0000-0000-0000000000a1', 'BE', 0,  29.99, 1, 'Below Expectations',       'BE', 3);

insert into classes (id, tenant_id, name) values
  ('f1000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000a1', 'Grade 7'),
  ('f1000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-0000000000b1', 'Grade 7 B');

insert into streams (id, tenant_id, class_id, name) values
  ('f2000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-0000000000a1', 'East');

insert into subjects (id, tenant_id, name, code) values
  ('f3000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000a1', 'Mathematics', 'MAT'),
  ('f3000000-0000-0000-0000-0000000000a2', 'f0000000-0000-0000-0000-0000000000a1', 'English',     'ENG');

insert into students (id, tenant_id, admission_no, full_name, class_id, stream_id, gender) values
  ('f5000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000a1', 'ADM-101', 'Amina Flow', 'f1000000-0000-0000-0000-0000000000a1', 'f2000000-0000-0000-0000-0000000000a1', 'Female'),
  ('f5000000-0000-0000-0000-0000000000a2', 'f0000000-0000-0000-0000-0000000000a1', 'ADM-102', 'Brian Flow', 'f1000000-0000-0000-0000-0000000000a1', 'f2000000-0000-0000-0000-0000000000a1', 'Male');

insert into student_enrollments (tenant_id, student_id, academic_year, class_id, stream_id) values
  ('f0000000-0000-0000-0000-0000000000a1', 'f5000000-0000-0000-0000-0000000000a1', 2026, 'f1000000-0000-0000-0000-0000000000a1', 'f2000000-0000-0000-0000-0000000000a1'),
  ('f0000000-0000-0000-0000-0000000000a1', 'f5000000-0000-0000-0000-0000000000a2', 2026, 'f1000000-0000-0000-0000-0000000000a1', 'f2000000-0000-0000-0000-0000000000a1');

-- Baseline published exam in Term 1 so get_most_improved has a previous exam to compare against!
insert into exams (id, tenant_id, name, term, academic_year, assessment_component, status, created_at) values
  ('f4000000-0000-0000-0000-0000000000a0', 'f0000000-0000-0000-0000-0000000000a1', 'Term 1 Opener 2026', 'Term 1', 2026, 'mid_term', 'published', '2026-02-01T08:00:00Z');

insert into exam_classes (exam_id, class_id) values
  ('f4000000-0000-0000-0000-0000000000a0', 'f1000000-0000-0000-0000-0000000000a1');

alter table public.marks disable trigger user;
insert into marks (tenant_id, exam_id, student_id, subject_id, score) values
  ('f0000000-0000-0000-0000-0000000000a1', 'f4000000-0000-0000-0000-0000000000a0', 'f5000000-0000-0000-0000-0000000000a1', 'f3000000-0000-0000-0000-0000000000a1', 60),
  ('f0000000-0000-0000-0000-0000000000a1', 'f4000000-0000-0000-0000-0000000000a0', 'f5000000-0000-0000-0000-0000000000a2', 'f3000000-0000-0000-0000-0000000000a1', 50);
alter table public.marks enable trigger user;

-- ---------------------------------------------------------------------------
-- 1. End-to-end flow: Create (Draft) -> Enter Marks -> Publish -> Reports -> Reopen
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"f0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"f0000000-0000-0000-0000-0000000000a1"}',
  true
);

do $$
declare
  v_exam_id uuid;
  v_overview record;
  v_saved int;
  v_roster record;
  v_ready record;
  v_perf record;
  v_imp record;
  v_report json;
begin
  -- Stage A: Admin creates a draft exam for Grade 7.
  v_exam_id := public.create_exam(
    'Term 2 End-Term 2026',
    'Term 2',
    2026,
    'end_term',
    array['f1000000-0000-0000-0000-0000000000a1'::uuid]
  );

  select * into v_overview
  from public.get_exam_pipeline_overview()
  where exam_id = v_exam_id;

  if v_overview.status <> 'draft'
     or v_overview.enrolled_students <> 2
     or v_overview.students_with_marks <> 0 then
    raise exception 'FAIL Stage A create_exam overview: %', v_overview;
  end if;

  -- Cannot publish an exam with zero marks.
  begin
    perform public.set_exam_lifecycle_status(v_exam_id, 'published');
    raise exception 'FAIL empty exam publish allowed';
  exception when others then
    if sqlerrm = 'FAIL empty exam publish allowed' then raise; end if;
    if sqlerrm <> 'Cannot publish exam: no marks have been entered' then
      raise exception 'FAIL empty exam publish message: %', sqlerrm;
    end if;
  end;

  -- While draft, report RPCs reject it.
  begin
    perform count(*) from public.get_class_performance(v_exam_id);
    raise exception 'FAIL draft exam allowed in get_class_performance';
  exception when others then
    if sqlerrm = 'FAIL draft exam allowed in get_class_performance' then raise; end if;
    if sqlerrm <> 'Exam is not published' then
      raise exception 'FAIL draft exam message: %', sqlerrm;
    end if;
  end;

  -- Stage B: Teacher keys in marks for Mathematics and English.
  perform set_config(
    'request.jwt.claims',
    '{"sub":"f0000000-0000-0000-0000-0000000000f2","role":"authenticated","tenant_id":"f0000000-0000-0000-0000-0000000000a1"}',
    true
  );

  v_saved := public.save_exam_subject_marks(
    v_exam_id,
    'f3000000-0000-0000-0000-0000000000a1',
    '[
      {"student_id": "f5000000-0000-0000-0000-0000000000a1", "score": 90},
      {"student_id": "f5000000-0000-0000-0000-0000000000a2", "score": 70}
    ]'::jsonb
  );
  if v_saved <> 2 then
    raise exception 'FAIL save_exam_subject_marks count: expected 2, got %', v_saved;
  end if;

  v_saved := public.save_exam_subject_marks(
    v_exam_id,
    'f3000000-0000-0000-0000-0000000000a2',
    '[
      {"student_id": "f5000000-0000-0000-0000-0000000000a1", "score": 80},
      {"student_id": "f5000000-0000-0000-0000-0000000000a2", "score": 50}
    ]'::jsonb
  );

  -- Check mark entry roster preview grade resolution.
  select * into v_roster
  from public.get_exam_mark_entry_roster(v_exam_id, 'f3000000-0000-0000-0000-0000000000a1')
  where admission_no = 'ADM-101';
  if v_roster.score <> 90 or v_roster.grade_code <> 'EE' or v_roster.points <> 4 then
    raise exception 'FAIL mark entry roster grade preview: %', v_roster;
  end if;

  -- Check publish readiness.
  select * into v_ready
  from public.get_exam_publish_readiness(v_exam_id)
  where subject_code = 'MAT';
  if v_ready.enrolled_students <> 2
     or v_ready.recorded_marks <> 2
     or v_ready.missing_marks <> 0
     or v_ready.mean_score <> 80.00 then
    raise exception 'FAIL publish readiness MAT: %', v_ready;
  end if;

  -- Teacher cannot publish the exam (admin required).
  begin
    perform public.set_exam_lifecycle_status(v_exam_id, 'published');
    raise exception 'FAIL teacher publish allowed';
  exception when others then
    if sqlerrm = 'FAIL teacher publish allowed' then raise; end if;
    if sqlerrm not ilike '%administrator role required%' then
      raise exception 'FAIL teacher publish message: %', sqlerrm;
    end if;
  end;

  -- Stage C: Switch back to Admin and publish the exam!
  perform set_config(
    'request.jwt.claims',
    '{"sub":"f0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"f0000000-0000-0000-0000-0000000000a1"}',
    true
  );

  perform public.set_exam_lifecycle_status(v_exam_id, 'published');

  -- Once published, mark edits are blocked.
  begin
    perform public.save_exam_subject_marks(
      v_exam_id,
      'f3000000-0000-0000-0000-0000000000a1',
      '[{"student_id": "f5000000-0000-0000-0000-0000000000a1", "score": 95}]'::jsonb
    );
    raise exception 'FAIL edit marks on published exam allowed';
  exception when others then
    if sqlerrm = 'FAIL edit marks on published exam allowed' then raise; end if;
    if sqlerrm not ilike '%published exam%' then
      raise exception 'FAIL edit marks on published exam message: %', sqlerrm;
    end if;
  end;

  -- Stage D: Verify the published exam immediately flows into ALL reports!
  -- 1) Class performance (Amina mean = (90+80)/2 = 85 -> EE, pos 1; Brian mean = (70+50)/2 = 60 -> ME, pos 2)
  select * into v_perf
  from public.get_class_performance(v_exam_id)
  where admission_no = 'ADM-101';
  if v_perf.total_score <> 170 or v_perf.mean_percentage <> 85
     or v_perf.overall_grade <> 'EE' or v_perf.class_position <> 1 then
    raise exception 'FAIL published exam -> get_class_performance: %', v_perf;
  end if;

  -- 2) Most improved (Amina improved from 60 in Term 1 Opener to 85 -> delta +25)
  select * into v_imp
  from public.get_most_improved(v_exam_id)
  where admission_no = 'ADM-101';
  if v_imp.current_mean <> 85 or v_imp.previous_mean <> 60 or v_imp.delta <> 25 then
    raise exception 'FAIL published exam -> get_most_improved: %', v_imp;
  end if;

  -- 3) Student report card
  v_report := public.get_student_report_data('f5000000-0000-0000-0000-0000000000a1', v_exam_id);
  if (v_report #>> '{summary,total_score}')::numeric <> 170
     or (v_report #>> '{summary,position}')::int <> 1 then
    raise exception 'FAIL published exam -> get_student_report_data: %', v_report -> 'summary';
  end if;

  -- Stage E: Reopen exam, update Amina's English mark from 80 to 100, re-publish, verify report updates!
  perform public.set_exam_lifecycle_status(v_exam_id, 'reopened');
  perform public.save_exam_subject_marks(
    v_exam_id,
    'f3000000-0000-0000-0000-0000000000a2',
    '[{"student_id": "f5000000-0000-0000-0000-0000000000a1", "score": 100}]'::jsonb
  );
  perform public.set_exam_lifecycle_status(v_exam_id, 'published');

  select * into v_perf
  from public.get_class_performance(v_exam_id)
  where admission_no = 'ADM-101';
  if v_perf.total_score <> 190 or v_perf.mean_percentage <> 95 then
    raise exception 'FAIL reopened + republished exam -> get_class_performance: %', v_perf;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tenant isolation & anon block
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"f0000000-0000-0000-0000-0000000000f3","role":"authenticated","tenant_id":"f0000000-0000-0000-0000-0000000000b1"}',
  true
);
do $$
declare
  n int;
begin
  select count(*) into n from public.get_exam_pipeline_overview();
  if n <> 0 then
    raise exception 'FAIL tenant isolation on get_exam_pipeline_overview: expected 0 for School B, got %', n;
  end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform count(*) from public.get_exam_pipeline_overview();
    raise exception 'FAIL anon: call allowed';
  exception when others then
    if sqlerrm = 'FAIL anon: call allowed' then raise; end if;
    if sqlerrm not ilike '%permission denied%' then
      raise exception 'FAIL anon message: %', sqlerrm;
    end if;
  end;
end $$;

reset role;
select 'ALL EXAM PIPELINE CHECKS PASSED' as result;
rollback;
