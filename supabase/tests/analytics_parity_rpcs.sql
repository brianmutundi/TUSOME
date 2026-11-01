-- Parity RPC tests: get_mark_sheet, get_student_exam_history, get_most_improved.
--
-- Run against a LOCAL / DISPOSABLE database only, after
-- 20261028000005_analytics_parity_rpcs.sql has been applied:
--
--   npm run db:test
--   -- or --
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/analytics_parity_rpcs.sql
--
-- Expect: ALL PARITY RPC CHECKS PASSED
--
-- Everything runs in one transaction and is rolled back. The grading
-- configuration is deliberately non-standard (EE 80-100, ME 60-79.99,
-- AE 30-59.99, BE 0-29.99) so the tests prove the new functions resolve grades
-- through get_grade_for_score instead of hardcoded thresholds.
--
-- NEVER run this against project fzwexcgsyzdqyauwccah (production): it inserts
-- tenants, exams, students and marks.
begin;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into tenants (id, name) values
  ('c0000000-0000-0000-0000-0000000000a1', 'Parity School A'),
  ('c0000000-0000-0000-0000-0000000000b1', 'Parity School B'),
  ('c0000000-0000-0000-0000-0000000000c1', 'Parity School C');

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-0000000000f1', 'parity-admin-a@test.local'),
  ('c0000000-0000-0000-0000-0000000000f2', 'parity-admin-b@test.local'),
  ('c0000000-0000-0000-0000-0000000000f3', 'parity-admin-c@test.local');

insert into profiles (id, tenant_id, full_name, role) values
  ('c0000000-0000-0000-0000-0000000000f1', 'c0000000-0000-0000-0000-0000000000a1', 'Parity Admin A', 'admin'),
  ('c0000000-0000-0000-0000-0000000000f2', 'c0000000-0000-0000-0000-0000000000b1', 'Parity Admin B', 'admin'),
  ('c0000000-0000-0000-0000-0000000000f3', 'c0000000-0000-0000-0000-0000000000c1', 'Parity Admin C', 'admin');

insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('cc000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000a1', '4', true, 'default'),
  ('cc000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b1', '4', true, 'default'),
  ('cc000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c1', '4', true, 'default');

insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('cc000000-0000-0000-0000-0000000000a1', 'EE', 80, 100, 4, 'Exceeding Expectations', 'EE', 0),
  ('cc000000-0000-0000-0000-0000000000a1', 'ME', 60, 79.99, 3, 'Meeting Expectations', 'ME', 1),
  ('cc000000-0000-0000-0000-0000000000a1', 'AE', 30, 59.99, 2, 'Approaching Expectations', 'AE', 2),
  ('cc000000-0000-0000-0000-0000000000a1', 'BE', 0, 29.99, 1, 'Below Expectations', 'BE', 3),
  ('cc000000-0000-0000-0000-0000000000b1', 'EE', 80, 100, 4, 'Exceeding Expectations', 'EE', 0),
  ('cc000000-0000-0000-0000-0000000000b1', 'ME', 60, 79.99, 3, 'Meeting Expectations', 'ME', 1),
  ('cc000000-0000-0000-0000-0000000000b1', 'AE', 30, 59.99, 2, 'Approaching Expectations', 'AE', 2),
  ('cc000000-0000-0000-0000-0000000000b1', 'BE', 0, 29.99, 1, 'Below Expectations', 'BE', 3),
  ('cc000000-0000-0000-0000-0000000000c1', 'EE', 80, 100, 4, 'Exceeding Expectations', 'EE', 0),
  ('cc000000-0000-0000-0000-0000000000c1', 'ME', 60, 79.99, 3, 'Meeting Expectations', 'ME', 1),
  ('cc000000-0000-0000-0000-0000000000c1', 'AE', 30, 59.99, 2, 'Approaching Expectations', 'AE', 2),
  ('cc000000-0000-0000-0000-0000000000c1', 'BE', 0, 29.99, 1, 'Below Expectations', 'BE', 3);

insert into classes (id, tenant_id, name) values
  ('c1000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000a1', 'Parity Class A1'),
  ('c1000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-0000000000a1', 'Parity Class A2'),
  ('c1000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b1', 'Parity Class B1'),
  ('c1000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c1', 'Parity Class C1');

insert into streams (id, tenant_id, class_id, name) values
  ('c2000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-0000000000a1', 'A1 Blue'),
  ('c2000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-0000000000b1', 'B1 Blue'),
  ('c2000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-0000000000c1', 'C1 Blue');

insert into subjects (id, tenant_id, name, code) values
  ('c3000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000a1', 'Mathematics', 'MAT'),
  ('c3000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-0000000000a1', 'English', 'ENG'),
  ('c3000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b1', 'Mathematics', 'MAT'),
  ('c3000000-0000-0000-0000-0000000000b2', 'c0000000-0000-0000-0000-0000000000b1', 'English', 'ENG'),
  ('c3000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c1', 'Mathematics', 'MAT');

-- E_prev (2025) -> E_mid (2026-03) -> E_cur (2026-09). E_draft must never be
-- visible. E_mid exists to prove "previous" prefers the same academic year over
-- an older year, and to exercise an earlier same-year created_at.
insert into exams (id, tenant_id, name, term, academic_year, assessment_component, status, created_at) values
  ('c4000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000a1', 'Previous Published Exam', 'Term 3', 2025, 'end_term', 'published', '2025-11-01T08:00:00Z'),
  ('c4000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-0000000000a1', 'Mid-Year Published Exam', 'Term 2', 2026, 'mid_term', 'published', '2026-03-01T08:00:00Z'),
  ('c4000000-0000-0000-0000-0000000000a3', 'c0000000-0000-0000-0000-0000000000a1', 'Current Published Exam', 'Term 3', 2026, 'end_term', 'published', '2026-09-01T08:00:00Z'),
  ('c4000000-0000-0000-0000-0000000000a4', 'c0000000-0000-0000-0000-0000000000a1', 'Draft Exam', 'Term 1', 2026, 'test_exam', 'draft', '2026-10-01T08:00:00Z'),
  ('c4000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b1', 'School B Published Exam', 'Term 1', 2026, 'mid_term', 'published', '2026-02-01T08:00:00Z'),
  -- Same academic year and identical created_at: only the id tie-break can
  -- decide which one is the earlier exam.
  ('c4000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c1', 'Tie Exam One', 'Term 1', 2026, 'mid_term', 'published', '2026-05-01T08:00:00Z'),
  ('c4000000-0000-0000-0000-0000000000c2', 'c0000000-0000-0000-0000-0000000000c1', 'Tie Exam Two', 'Term 2', 2026, 'end_term', 'published', '2026-05-01T08:00:00Z');

insert into exam_classes (exam_id, class_id) values
  ('c4000000-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-0000000000a1'),
  ('c4000000-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-0000000000a2'),
  ('c4000000-0000-0000-0000-0000000000a2', 'c1000000-0000-0000-0000-0000000000a1'),
  ('c4000000-0000-0000-0000-0000000000a2', 'c1000000-0000-0000-0000-0000000000a2'),
  ('c4000000-0000-0000-0000-0000000000a3', 'c1000000-0000-0000-0000-0000000000a1'),
  ('c4000000-0000-0000-0000-0000000000a3', 'c1000000-0000-0000-0000-0000000000a2'),
  ('c4000000-0000-0000-0000-0000000000a4', 'c1000000-0000-0000-0000-0000000000a1'),
  ('c4000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-0000000000b1'),
  ('c4000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-0000000000c1'),
  ('c4000000-0000-0000-0000-0000000000c2', 'c1000000-0000-0000-0000-0000000000c1');

insert into students (id, tenant_id, admission_no, full_name, class_id, stream_id, gender) values
  ('c5000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000a1', 'P-001', 'Alice Parity', 'c1000000-0000-0000-0000-0000000000a1', 'c2000000-0000-0000-0000-0000000000a1', 'Female'),
  ('c5000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-0000000000a1', 'P-002', 'Bob Parity', 'c1000000-0000-0000-0000-0000000000a2', null, 'Male'),
  ('c5000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b1', 'P-003', 'Cara Parity', 'c1000000-0000-0000-0000-0000000000b1', 'c2000000-0000-0000-0000-0000000000b1', 'Female'),
  ('c5000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c1', 'P-004', 'Cole Parity', 'c1000000-0000-0000-0000-0000000000c1', 'c2000000-0000-0000-0000-0000000000c1', 'Male');

-- Alice has an older enrollment in A2 and the current one in A1. The mark sheet
-- must use the latest enrollment and must not duplicate her rows.
insert into student_enrollments (tenant_id, student_id, academic_year, class_id, stream_id) values
  ('c0000000-0000-0000-0000-0000000000a1', 'c5000000-0000-0000-0000-0000000000a1', 2025, 'c1000000-0000-0000-0000-0000000000a2', null),
  ('c0000000-0000-0000-0000-0000000000a1', 'c5000000-0000-0000-0000-0000000000a1', 2026, 'c1000000-0000-0000-0000-0000000000a1', 'c2000000-0000-0000-0000-0000000000a1'),
  ('c0000000-0000-0000-0000-0000000000a1', 'c5000000-0000-0000-0000-0000000000a2', 2026, 'c1000000-0000-0000-0000-0000000000a2', null),
  ('c0000000-0000-0000-0000-0000000000b1', 'c5000000-0000-0000-0000-0000000000b1', 2026, 'c1000000-0000-0000-0000-0000000000b1', 'c2000000-0000-0000-0000-0000000000b1'),
  ('c0000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-0000000000c1', 2026, 'c1000000-0000-0000-0000-0000000000c1', 'c2000000-0000-0000-0000-0000000000c1');

-- Means: E_prev Alice 50 / Bob 70; E_mid Alice 40 / Bob 60;
-- E_cur Alice 80 / Bob 50. Draft must stay invisible.
alter table public.marks disable trigger user;

insert into marks (tenant_id, exam_id, student_id, subject_id, score) values
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a1', 'c5000000-0000-0000-0000-0000000000a1', 'c3000000-0000-0000-0000-0000000000a1', 60),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a1', 'c5000000-0000-0000-0000-0000000000a1', 'c3000000-0000-0000-0000-0000000000a2', 40),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a1', 'c5000000-0000-0000-0000-0000000000a2', 'c3000000-0000-0000-0000-0000000000a1', 80),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a1', 'c5000000-0000-0000-0000-0000000000a2', 'c3000000-0000-0000-0000-0000000000a2', 60),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a2', 'c5000000-0000-0000-0000-0000000000a1', 'c3000000-0000-0000-0000-0000000000a1', 30),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a2', 'c5000000-0000-0000-0000-0000000000a1', 'c3000000-0000-0000-0000-0000000000a2', 50),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a2', 'c5000000-0000-0000-0000-0000000000a2', 'c3000000-0000-0000-0000-0000000000a1', 70),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a2', 'c5000000-0000-0000-0000-0000000000a2', 'c3000000-0000-0000-0000-0000000000a2', 50),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a3', 'c5000000-0000-0000-0000-0000000000a1', 'c3000000-0000-0000-0000-0000000000a1', 90),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a3', 'c5000000-0000-0000-0000-0000000000a1', 'c3000000-0000-0000-0000-0000000000a2', 70),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a3', 'c5000000-0000-0000-0000-0000000000a2', 'c3000000-0000-0000-0000-0000000000a1', 50),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a3', 'c5000000-0000-0000-0000-0000000000a2', 'c3000000-0000-0000-0000-0000000000a2', 50),
  ('c0000000-0000-0000-0000-0000000000a1', 'c4000000-0000-0000-0000-0000000000a4', 'c5000000-0000-0000-0000-0000000000a1', 'c3000000-0000-0000-0000-0000000000a1', 99),
  ('c0000000-0000-0000-0000-0000000000b1', 'c4000000-0000-0000-0000-0000000000b1', 'c5000000-0000-0000-0000-0000000000b1', 'c3000000-0000-0000-0000-0000000000b1', 90),
  ('c0000000-0000-0000-0000-0000000000b1', 'c4000000-0000-0000-0000-0000000000b1', 'c5000000-0000-0000-0000-0000000000b1', 'c3000000-0000-0000-0000-0000000000b2', 90),
  ('c0000000-0000-0000-0000-0000000000c1', 'c4000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-0000000000c1', 'c3000000-0000-0000-0000-0000000000c1', 40),
  ('c0000000-0000-0000-0000-0000000000c1', 'c4000000-0000-0000-0000-0000000000c2', 'c5000000-0000-0000-0000-0000000000c1', 'c3000000-0000-0000-0000-0000000000c1', 90);

alter table public.marks enable trigger user;

-- ---------------------------------------------------------------------------
-- 0. Function properties and grant matrix
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.proname, p.prosecdef, p.provolatile
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_mark_sheet', 'get_student_exam_history', 'get_most_improved')
  loop
    if r.prosecdef then
      raise exception 'FAIL security: % is SECURITY DEFINER', r.proname;
    end if;
    if r.provolatile <> 's' then
      raise exception 'FAIL volatility: % is not STABLE (%)', r.proname, r.provolatile;
    end if;
  end loop;

  if (select count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('get_mark_sheet', 'get_student_exam_history', 'get_most_improved')) <> 3 then
    raise exception 'FAIL grants: expected 3 parity functions';
  end if;

  if has_function_privilege('anon', 'public.get_mark_sheet(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_student_exam_history(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_most_improved(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'FAIL grants: anon can execute a parity function';
  end if;

  if not has_function_privilege('authenticated', 'public.get_mark_sheet(uuid,uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_student_exam_history(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_most_improved(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'FAIL grants: authenticated cannot execute a parity function';
  end if;

  if not has_function_privilege('service_role', 'public.get_mark_sheet(uuid,uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_student_exam_history(uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_most_improved(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'FAIL grants: service_role cannot execute a parity function';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Mark sheet: correct matrix, grades from configuration, latest enrollment
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"c0000000-0000-0000-0000-0000000000a1"}', true);

do $$
declare
  n int;
  alice_maths record;
  alice_english record;
  bob_maths record;
begin
  select count(*) into n from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000a3');
  if n <> 4 then
    raise exception 'FAIL mark sheet rows: expected 4, got %', n;
  end if;

  select * into alice_maths from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000a3')
  where admission_no = 'P-001' and subject_code = 'MAT';
  select * into alice_english from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000a3')
  where admission_no = 'P-001' and subject_code = 'ENG';
  select * into bob_maths from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000a3')
  where admission_no = 'P-002' and subject_code = 'MAT';

  if alice_maths.score <> 90 or alice_maths.grade_code <> 'EE'
     or alice_maths.grade_name <> 'Exceeding Expectations' or alice_maths.points <> 4 then
    raise exception 'FAIL mark sheet Alice Maths: % / % / % / %',
      alice_maths.score, alice_maths.grade_code, alice_maths.grade_name, alice_maths.points;
  end if;
  -- 70 is ME (60-79.99) under this config; 50 is AE (30-59.99), not a pass/fail
  -- constant.
  if alice_english.grade_code <> 'ME' or alice_english.points <> 3 then
    raise exception 'FAIL mark sheet Alice English: % / %', alice_english.grade_code, alice_english.points;
  end if;
  if bob_maths.grade_code <> 'AE' or bob_maths.points <> 2 then
    raise exception 'FAIL mark sheet Bob Maths: % / %', bob_maths.grade_code, bob_maths.points;
  end if;

  -- Latest enrollment (A1) wins over the stale students.class_id for Bob and
  -- the older 2025 enrollment for Alice.
  if alice_maths.class_name <> 'Parity Class A1' or alice_maths.stream_name <> 'A1 Blue' then
    raise exception 'FAIL mark sheet Alice class: % / %', alice_maths.class_name, alice_maths.stream_name;
  end if;
  if bob_maths.class_name <> 'Parity Class A2' or bob_maths.stream_name is not null then
    raise exception 'FAIL mark sheet Bob class: % / %', bob_maths.class_name, bob_maths.stream_name;
  end if;
end $$;

-- Draft and unknown exams fail closed (the function rejects them outright).
do $$
begin
  begin
    perform count(*) from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000a4');
    raise exception 'FAIL mark sheet draft: call allowed';
  exception when others then
    if sqlerrm = 'FAIL mark sheet draft: call allowed' then raise; end if;
    if sqlerrm <> 'Exam is not published' then
      raise exception 'FAIL mark sheet draft message: %', sqlerrm;
    end if;
  end;

  begin
    perform count(*) from public.get_mark_sheet('00000000-0000-0000-0000-000000000000');
    raise exception 'FAIL mark sheet unknown exam: call allowed';
  exception when others then
    if sqlerrm = 'FAIL mark sheet unknown exam: call allowed' then raise; end if;
    if sqlerrm <> 'Exam not found' then
      raise exception 'FAIL mark sheet unknown exam message: %', sqlerrm;
    end if;
  end;
end $$;

-- Class and stream filters use the latest enrollment.
do $$
declare
  n int;
  v_class_name text;
begin
  select count(*), min(class_name) into n, v_class_name
  from public.get_mark_sheet(
    'c4000000-0000-0000-0000-0000000000a3',
    'c1000000-0000-0000-0000-0000000000a1'
  );
  if n <> 2 or v_class_name <> 'Parity Class A1' then
    raise exception 'FAIL mark sheet class filter: expected 2 rows in A1, got % / %', n, v_class_name;
  end if;

  select count(*) into n
  from public.get_mark_sheet(
    'c4000000-0000-0000-0000-0000000000a3',
    null,
    'c2000000-0000-0000-0000-0000000000a1'
  );
  if n <> 2 then
    raise exception 'FAIL mark sheet stream filter: expected 2 rows in A1 Blue, got %', n;
  end if;

  select count(*) into n
  from public.get_mark_sheet(
    'c4000000-0000-0000-0000-0000000000a3',
    'c1000000-0000-0000-0000-0000000000a2'
  );
  if n <> 2 then
    raise exception 'FAIL mark sheet A2 filter: expected 2 rows, got %', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Student exam history: published only, newest first, dense-ranked
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  first_row record;
  second_row record;
  third_row record;
begin
  select count(*) into n from public.get_student_exam_history('c5000000-0000-0000-0000-0000000000a1');
  if n <> 3 then
    raise exception 'FAIL history rows: expected 3 published exams, got %', n;
  end if;

  -- Rely on the function's own ORDER BY (no outer ORDER BY).
  select * into first_row from public.get_student_exam_history('c5000000-0000-0000-0000-0000000000a1') limit 1;
  select * into second_row from public.get_student_exam_history('c5000000-0000-0000-0000-0000000000a1') offset 1 limit 1;
  select * into third_row from public.get_student_exam_history('c5000000-0000-0000-0000-0000000000a1') offset 2 limit 1;

  -- The function itself orders by academic_year DESC, created_at DESC, id DESC.
  if first_row.exam_name <> 'Current Published Exam'
     or second_row.exam_name <> 'Mid-Year Published Exam'
     or third_row.exam_name <> 'Previous Published Exam' then
    raise exception 'FAIL history order: % / % / %',
      first_row.exam_name, second_row.exam_name, third_row.exam_name;
  end if;

  if first_row.total_score <> 160 or first_row.mean_score <> 80
     or first_row.subjects_count <> 2 then
    raise exception 'FAIL history current totals: % / % / %',
      first_row.total_score, first_row.mean_score, first_row.subjects_count;
  end if;
  if first_row.overall_grade <> 'EE' or first_row.overall_points <> 4 then
    raise exception 'FAIL history current grade: % / %', first_row.overall_grade, first_row.overall_points;
  end if;
  if first_row."position" <> 1 or first_row.total_in_exam <> 2 then
    raise exception 'FAIL history current position: % of %', first_row."position", first_row.total_in_exam;
  end if;

  if second_row.mean_score <> 40 or second_row.overall_grade <> 'AE'
     or second_row."position" <> 2 or second_row.total_in_exam <> 2 then
    raise exception 'FAIL history mid: % / % / % of %',
      second_row.mean_score, second_row.overall_grade, second_row."position", second_row.total_in_exam;
  end if;

  if third_row.mean_score <> 50 or third_row.overall_grade <> 'AE'
     or third_row."position" <> 2 or third_row.total_in_exam <> 2 then
    raise exception 'FAIL history previous: % / % / % of %',
      third_row.mean_score, third_row.overall_grade, third_row."position", third_row.total_in_exam;
  end if;

  if exists (
    select 1 from public.get_student_exam_history('c5000000-0000-0000-0000-0000000000a1')
    where exam_name = 'Draft Exam'
  ) then
    raise exception 'FAIL history: draft exam leaked';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Most improved: previous exam selection and delta
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  alice record;
  bob record;
  first_admission text;
begin
  select count(*) into n from public.get_most_improved('c4000000-0000-0000-0000-0000000000a3');
  if n <> 2 then
    raise exception 'FAIL improved rows: expected 2, got %', n;
  end if;

  select * into alice from public.get_most_improved('c4000000-0000-0000-0000-0000000000a3')
  where admission_no = 'P-001';
  select * into bob from public.get_most_improved('c4000000-0000-0000-0000-0000000000a3')
  where admission_no = 'P-002';

  -- Previous is the same-year Mid-Year exam, not the older 2025 exam.
  if alice.previous_exam_name <> 'Mid-Year Published Exam' then
    raise exception 'FAIL improved previous exam: %', alice.previous_exam_name;
  end if;
  if alice.current_mean <> 80 or alice.previous_mean <> 40 or alice.delta <> 40 then
    raise exception 'FAIL improved Alice: % / % / %',
      alice.current_mean, alice.previous_mean, alice.delta;
  end if;
  if bob.current_mean <> 50 or bob.previous_mean <> 60 or bob.delta <> -10 then
    raise exception 'FAIL improved Bob: % / % / %',
      bob.current_mean, bob.previous_mean, bob.delta;
  end if;
  if alice.stream_name <> 'A1 Blue' or bob.stream_name is not null then
    raise exception 'FAIL improved stream: % / %', alice.stream_name, bob.stream_name;
  end if;

  -- Ordered by delta descending: Alice (+40) before Bob (-10).
  select admission_no into first_admission
  from public.get_most_improved('c4000000-0000-0000-0000-0000000000a3')
  limit 1;
  if first_admission <> 'P-001' then
    raise exception 'FAIL improved order: expected P-001 first, got %', first_admission;
  end if;
end $$;

do $$
declare
  n int;
  alice record;
begin
  -- E_mid compares to E_prev (2025), not to the later E_cur.
  select * into alice from public.get_most_improved('c4000000-0000-0000-0000-0000000000a2')
  where admission_no = 'P-001';
  if alice.previous_exam_name <> 'Previous Published Exam'
     or alice.current_mean <> 40 or alice.previous_mean <> 50 or alice.delta <> -10 then
    raise exception 'FAIL improved mid: % / % / % / %',
      alice.previous_exam_name, alice.current_mean, alice.previous_mean, alice.delta;
  end if;

  -- The oldest published exam has nothing earlier to compare against.
  select count(*) into n from public.get_most_improved('c4000000-0000-0000-0000-0000000000a1');
  if n <> 0 then
    raise exception 'FAIL improved oldest: expected 0 rows, got %', n;
  end if;

  -- Class filter follows the latest enrollment.
  select count(*) into n from public.get_most_improved(
    'c4000000-0000-0000-0000-0000000000a3',
    'c1000000-0000-0000-0000-0000000000a2'
  );
  if n <> 1 then
    raise exception 'FAIL improved class filter: expected 1 row, got %', n;
  end if;
end $$;

-- Tie-break: same academic year and identical created_at, so only e.id < p_exam_id
-- can pick Tie Exam One as the previous exam.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-0000000000f3","role":"authenticated","tenant_id":"c0000000-0000-0000-0000-0000000000c1"}', true);
do $$
declare
  cole record;
begin
  select * into cole from public.get_most_improved('c4000000-0000-0000-0000-0000000000c2')
  where admission_no = 'P-004';
  if cole.previous_exam_name <> 'Tie Exam One'
     or cole.current_mean <> 90 or cole.previous_mean <> 40 or cole.delta <> 50 then
    raise exception 'FAIL improved tie-break: % / % / % / %',
      cole.previous_exam_name, cole.current_mean, cole.previous_mean, cole.delta;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Tenant isolation and fail-closed behaviour
-- ---------------------------------------------------------------------------
-- Run the explicit tenant checks as the table owner. RLS would otherwise hide
-- the other tenant's rows before the function's own guard could see them, and
-- the guard would never be exercised. The RLS layer is asserted separately
-- below as `authenticated`.
reset role;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"c0000000-0000-0000-0000-0000000000a1"}', true);

do $$
begin
  -- School A claims School A but asks for School B's student.
  begin
    perform count(*) from public.get_student_exam_history('c5000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL history cross-tenant: call allowed';
  exception when others then
    if sqlerrm = 'FAIL history cross-tenant: call allowed' then raise; end if;
    if sqlerrm <> 'Access denied to student from different tenant' then
      raise exception 'FAIL history cross-tenant message: %', sqlerrm;
    end if;
  end;

  -- School A claims School A but asks for School B's exam.
  begin
    perform count(*) from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL mark sheet cross-tenant: call allowed';
  exception when others then
    if sqlerrm = 'FAIL mark sheet cross-tenant: call allowed' then raise; end if;
    if sqlerrm <> 'Access denied to exam from different tenant' then
      raise exception 'FAIL mark sheet cross-tenant message: %', sqlerrm;
    end if;
  end;

  begin
    perform count(*) from public.get_most_improved('c4000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL improved cross-tenant: call allowed';
  exception when others then
    if sqlerrm = 'FAIL improved cross-tenant: call allowed' then raise; end if;
    if sqlerrm <> 'Access denied to exam from different tenant' then
      raise exception 'FAIL improved cross-tenant message: %', sqlerrm;
    end if;
  end;

  begin
    perform count(*) from public.get_student_exam_history('00000000-0000-0000-0000-000000000000');
    raise exception 'FAIL history unknown student: call allowed';
  exception when others then
    if sqlerrm = 'FAIL history unknown student: call allowed' then raise; end if;
    if sqlerrm <> 'Student not found' then
      raise exception 'FAIL history unknown student message: %', sqlerrm;
    end if;
  end;

  begin
    perform count(*) from public.get_most_improved('c4000000-0000-0000-0000-0000000000a4');
    raise exception 'FAIL improved draft: call allowed';
  exception when others then
    if sqlerrm = 'FAIL improved draft: call allowed' then raise; end if;
    if sqlerrm <> 'Exam is not published' then
      raise exception 'FAIL improved draft message: %', sqlerrm;
    end if;
  end;
end $$;

-- The same cross-tenant calls as `authenticated`: RLS hides the other tenant's
-- rows, so the functions fail closed with the not-found message instead of the
-- explicit denial. Both paths must reject; neither may return data.
set local role authenticated;
do $$
begin
  begin
    perform count(*) from public.get_student_exam_history('c5000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL history RLS cross-tenant: call allowed';
  exception when others then
    if sqlerrm = 'FAIL history RLS cross-tenant: call allowed' then raise; end if;
    if sqlerrm <> 'Student not found' then
      raise exception 'FAIL history RLS cross-tenant message: %', sqlerrm;
    end if;
  end;

  begin
    perform count(*) from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL mark sheet RLS cross-tenant: call allowed';
  exception when others then
    if sqlerrm = 'FAIL mark sheet RLS cross-tenant: call allowed' then raise; end if;
    if sqlerrm <> 'Exam not found' then
      raise exception 'FAIL mark sheet RLS cross-tenant message: %', sqlerrm;
    end if;
  end;

  begin
    perform count(*) from public.get_most_improved('c4000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL improved RLS cross-tenant: call allowed';
  exception when others then
    if sqlerrm = 'FAIL improved RLS cross-tenant: call allowed' then raise; end if;
    if sqlerrm <> 'Exam not found' then
      raise exception 'FAIL improved RLS cross-tenant message: %', sqlerrm;
    end if;
  end;
end $$;

-- Missing tenant claim fails closed for every new function.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
do $$
begin
  begin
    perform count(*) from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000a3');
    raise exception 'FAIL mark sheet missing claim: call allowed';
  exception when others then
    if sqlerrm = 'FAIL mark sheet missing claim: call allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then
      raise exception 'FAIL mark sheet missing claim message: %', sqlerrm;
    end if;
  end;

  begin
    perform count(*) from public.get_student_exam_history('c5000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL history missing claim: call allowed';
  exception when others then
    if sqlerrm = 'FAIL history missing claim: call allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then
      raise exception 'FAIL history missing claim message: %', sqlerrm;
    end if;
  end;

  begin
    perform count(*) from public.get_most_improved('c4000000-0000-0000-0000-0000000000a3');
    raise exception 'FAIL improved missing claim: call allowed';
  exception when others then
    if sqlerrm = 'FAIL improved missing claim: call allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then
      raise exception 'FAIL improved missing claim message: %', sqlerrm;
    end if;
  end;
end $$;

-- Malformed tenant claim is treated as missing (the cast error is swallowed).
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"not-a-uuid"}', true);
do $$
begin
  begin
    perform count(*) from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000a3');
    raise exception 'FAIL mark sheet malformed claim: call allowed';
  exception when others then
    if sqlerrm = 'FAIL mark sheet malformed claim: call allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then
      raise exception 'FAIL mark sheet malformed claim message: %', sqlerrm;
    end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 5. service_role bypass is the only bypass
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  n int;
begin
  select count(*) into n from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000b1');
  if n <> 2 then
    raise exception 'FAIL service_role mark sheet: expected 2, got %', n;
  end if;

  select count(*) into n from public.get_student_exam_history('c5000000-0000-0000-0000-0000000000b1');
  if n <> 1 then
    raise exception 'FAIL service_role history: expected 1, got %', n;
  end if;

  -- School C's tie-break fixture is readable in the same call context.
  select count(*) into n from public.get_most_improved('c4000000-0000-0000-0000-0000000000c2');
  if n <> 1 then
    raise exception 'FAIL service_role improved: expected 1, got %', n;
  end if;
end $$;

-- anon has no EXECUTE grant, so the call fails at the privilege layer.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform count(*) from public.get_mark_sheet('c4000000-0000-0000-0000-0000000000a3');
    raise exception 'FAIL anon: call allowed';
  exception when others then
    if sqlerrm = 'FAIL anon: call allowed' then raise; end if;
    if sqlerrm not ilike '%permission denied%' then
      raise exception 'FAIL anon message: %', sqlerrm;
    end if;
  end;
end $$;

reset role;
select 'ALL PARITY RPC CHECKS PASSED' as result;
rollback;
