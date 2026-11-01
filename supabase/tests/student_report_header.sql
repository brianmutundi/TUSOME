-- Regression suite: deterministic student report header.
--
-- Run against a LOCAL / DISPOSABLE database only, after:
--   20261028000000_create_analytics_functions.sql
--   20261028000001_fix_roster_joins_and_config_grading.sql
--   20261028000003_fix_student_report_header.sql
--
-- Everything runs in one transaction and is rolled back.
--
-- Covers:
--   H1 exam-year enrollment preferred over older and newer enrollments
--   H2 multiple enrollments do not duplicate marks
--   H3 no enrollment falls back to students.class_id / students.stream_id
--   H4 no exam-year match falls back to the latest enrollment
--   H5 same-year tie broken by created_at DESC
--   H6 student identity still comes from students
--   H7 authenticated keeps EXECUTE

begin;

insert into tenants (id, name) values
  ('e0000000-0000-0000-0000-0000000000e1', 'Header School');

insert into auth.users (id, email) values
  ('e9000000-0000-0000-0000-0000000000f1', 'header-admin@test.local');

insert into profiles (id, tenant_id, full_name, role) values
  ('e9000000-0000-0000-0000-0000000000f1', 'e0000000-0000-0000-0000-0000000000e1', 'Header Admin', 'admin');

insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('ec000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', '4', true, 'default');

insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('ec000000-0000-0000-0000-000000000001', 'EE', 80, 100, 4, 'Exceeding Expectations', 'EE', 0),
  ('ec000000-0000-0000-0000-000000000001', 'ME', 60, 79.99, 3, 'Meeting Expectations', 'ME', 1),
  ('ec000000-0000-0000-0000-000000000001', 'AE', 30, 59.99, 2, 'Approaching Expectations', 'AE', 2),
  ('ec000000-0000-0000-0000-000000000001', 'BE', 0, 29.99, 1, 'Below Expectations', 'BE', 3);

insert into classes (id, tenant_id, name) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', 'Header Form 2 East'),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000e1', 'Header Form 1 West'),
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-0000000000e1', 'Header Form 3 North');

insert into streams (id, tenant_id, class_id, name) values
  ('e2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', 'e1000000-0000-0000-0000-000000000001', 'East Blue');

insert into subjects (id, tenant_id, name, code) values
  ('e3000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', 'Mathematics', 'MAT'),
  ('e3000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000e1', 'English', 'ENG');

insert into exams (id, tenant_id, name, term, academic_year, status) values
  ('e4000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', 'Header Exam', 'Term 2', 2026, 'published');

insert into exam_classes (exam_id, class_id) values
  ('e4000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001'),
  ('e4000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002'),
  ('e4000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003');

-- students.class_id is deliberately stale/wrong for every student that has an
-- enrollment. Only the no-enrollment case may fall back to it.
insert into students (id, tenant_id, admission_no, full_name, class_id, stream_id, gender) values
  ('e5000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', 'H-001', 'Multiple Enrollment', 'e1000000-0000-0000-0000-000000000003', null, 'Female'),
  ('e5000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000e1', 'H-002', 'No Enrollment', 'e1000000-0000-0000-0000-000000000002', null, 'Male'),
  ('e5000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-0000000000e1', 'H-003', 'No Matching Year', 'e1000000-0000-0000-0000-000000000003', null, 'Female'),
  ('e5000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-0000000000e1', 'H-004', 'Same Year Tie', 'e1000000-0000-0000-0000-000000000003', null, 'Male');

-- H1/H2: 2025 (older), 2026 (exam year), 2027 (newer). The exam-year row must
-- win even though 2027 is the latest. The 2027 row points at the stale class to
-- make a wrong choice obvious.
-- H4: 2024 and 2025, no 2026 row -> latest 2025 wins.
-- H5: two 2026 rows, created_at decides.
insert into student_enrollments (tenant_id, student_id, academic_year, class_id, stream_id, created_at) values
  ('e0000000-0000-0000-0000-0000000000e1', 'e5000000-0000-0000-0000-000000000001', 2025, 'e1000000-0000-0000-0000-000000000002', null, '2025-01-10T08:00:00Z'),
  ('e0000000-0000-0000-0000-0000000000e1', 'e5000000-0000-0000-0000-000000000001', 2026, 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', '2026-01-10T08:00:00Z'),
  ('e0000000-0000-0000-0000-0000000000e1', 'e5000000-0000-0000-0000-000000000001', 2027, 'e1000000-0000-0000-0000-000000000003', null, '2027-01-10T08:00:00Z'),
  ('e0000000-0000-0000-0000-0000000000e1', 'e5000000-0000-0000-0000-000000000003', 2024, 'e1000000-0000-0000-0000-000000000001', null, '2024-01-10T08:00:00Z'),
  ('e0000000-0000-0000-0000-0000000000e1', 'e5000000-0000-0000-0000-000000000003', 2025, 'e1000000-0000-0000-0000-000000000002', null, '2025-01-10T08:00:00Z'),
  ('e0000000-0000-0000-0000-0000000000e1', 'e5000000-0000-0000-0000-000000000004', 2026, 'e1000000-0000-0000-0000-000000000002', null, '2026-01-10T08:00:00Z'),
  ('e0000000-0000-0000-0000-0000000000e1', 'e5000000-0000-0000-0000-000000000004', 2026, 'e1000000-0000-0000-0000-000000000001', null, '2026-06-10T08:00:00Z');

alter table public.marks disable trigger user;
insert into marks (tenant_id, exam_id, student_id, subject_id, score) values
  ('e0000000-0000-0000-0000-0000000000e1', 'e4000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000001', 70),
  ('e0000000-0000-0000-0000-0000000000e1', 'e4000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000002', 80);
alter table public.marks enable trigger user;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"e9000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"e0000000-0000-0000-0000-0000000000e1"}',
  true
);

do $$
declare
  r json;
begin
  -- H1/H2: exam-year enrollment wins; three enrollment rows do not duplicate marks.
  r := public.get_student_report_data(
    'e5000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001'
  );
  if (r #>> '{student,class}') is distinct from 'Header Form 2 East' then
    raise exception 'FAIL H1 header class: expected Header Form 2 East, got %', r #>> '{student,class}';
  end if;
  if (r #>> '{student,stream}') is distinct from 'East Blue' then
    raise exception 'FAIL H1 header stream: expected East Blue, got %', r #>> '{student,stream}';
  end if;
  if (r #>> '{student,academic_year}')::int is distinct from 2026 then
    raise exception 'FAIL H1 header year: expected 2026, got %', r #>> '{student,academic_year}';
  end if;
  if (r #>> '{summary,total_score}')::numeric is distinct from 150 then
    raise exception 'FAIL H2 total_score: expected 150, got %', r #>> '{summary,total_score}';
  end if;
  if (r #>> '{summary,subjects_count}')::int is distinct from 2 then
    raise exception 'FAIL H2 subjects_count: expected 2, got %', r #>> '{summary,subjects_count}';
  end if;
  if json_array_length(r -> 'subjects') <> 2 then
    raise exception 'FAIL H2 subjects array: expected 2, got %', json_array_length(r -> 'subjects');
  end if;

  -- H3: no enrollment -> students fallback, no invented academic year.
  r := public.get_student_report_data(
    'e5000000-0000-0000-0000-000000000002',
    'e4000000-0000-0000-0000-000000000001'
  );
  if (r #>> '{student,class}') is distinct from 'Header Form 1 West' then
    raise exception 'FAIL H3 fallback class: expected Header Form 1 West, got %', r #>> '{student,class}';
  end if;
  if r #> '{student,academic_year}' is not null and r #>> '{student,academic_year}' is not null then
    raise exception 'FAIL H3 academic_year: expected null, got %', r #>> '{student,academic_year}';
  end if;

  -- H4: no enrollment for the exam year -> latest year wins.
  r := public.get_student_report_data(
    'e5000000-0000-0000-0000-000000000003',
    'e4000000-0000-0000-0000-000000000001'
  );
  if (r #>> '{student,class}') is distinct from 'Header Form 1 West' then
    raise exception 'FAIL H4 latest year class: expected Header Form 1 West, got %', r #>> '{student,class}';
  end if;
  if (r #>> '{student,academic_year}')::int is distinct from 2025 then
    raise exception 'FAIL H4 latest year: expected 2025, got %', r #>> '{student,academic_year}';
  end if;

  -- H5: same year, later created_at wins.
  r := public.get_student_report_data(
    'e5000000-0000-0000-0000-000000000004',
    'e4000000-0000-0000-0000-000000000001'
  );
  if (r #>> '{student,class}') is distinct from 'Header Form 2 East' then
    raise exception 'FAIL H5 same-year tie: expected Header Form 2 East, got %', r #>> '{student,class}';
  end if;
  if (r #>> '{student,academic_year}')::int is distinct from 2026 then
    raise exception 'FAIL H5 same-year year: expected 2026, got %', r #>> '{student,academic_year}';
  end if;

  -- H6: identity fields remain students', never enrollment-derived.
  if (r #>> '{student,admission_no}') is distinct from 'H-004'
     or (r #>> '{student,name}') is distinct from 'Same Year Tie'
     or (r #>> '{student,gender}') is distinct from 'Male' then
    raise exception 'FAIL H6 identity fields changed: %', r -> 'student';
  end if;

  -- H7: the report function remains executable by authenticated.
  if not has_function_privilege('authenticated', 'public.get_student_report_data(uuid,uuid)', 'EXECUTE') then
    raise exception 'FAIL H7 authenticated lost EXECUTE on get_student_report_data';
  end if;
end $$;

select 'ALL STUDENT REPORT HEADER CHECKS PASSED' as result;
