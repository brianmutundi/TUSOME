-- Join-multiplication, enrollment-precedence, filtering and ranking regression tests.
--
-- LOCAL / DISPOSABLE DATABASE ONLY.
-- Requires: base schema, then
--   20261028000000_create_analytics_functions.sql
--   20261028000001_fix_roster_joins_and_config_grading.sql
--
-- Runs in one transaction and rolls back.
--
-- Fixture shape is deliberately hostile:
--   * 9 exam_classes and a student with 3 enrollment rows.
--   * 224 marks for the same student (224 distinct subjects, as in the live
--     incident) so the old join produced 224 * 9 = 2016.
--   * students with no enrollment, with a NULL stream enrollment, and with an
--     older enrollment that must not win.
--   * a class that does not appear in exam_classes at all.
begin;

insert into tenants (id, name) values
  ('c0000000-0000-0000-0000-0000000000c1', 'Roster School');

insert into auth.users (id, email) values
  ('c9000000-0000-0000-0000-0000000000f1', 'roster-admin@test.local');

insert into profiles (id, tenant_id, full_name, role) values
  ('c9000000-0000-0000-0000-0000000000f1', 'c0000000-0000-0000-0000-0000000000c1', 'Roster Admin', 'admin');

insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('cc000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000c1', '4', true, 'default');

insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('cc000000-0000-0000-0000-000000000001', 'EE', 80, 100, 4, 'Exceeding Expectations', 'EE', 0),
  ('cc000000-0000-0000-0000-000000000001', 'ME', 60, 79.99, 3, 'Meeting Expectations', 'ME', 1),
  ('cc000000-0000-0000-0000-000000000001', 'AE', 30, 59.99, 2, 'Approaching Expectations', 'AE', 2),
  ('cc000000-0000-0000-0000-000000000001', 'BE', 0, 29.99, 1, 'Below Expectations', 'BE', 3);

-- Nine classes sit the exam; a tenth class exists but is not linked to it.
insert into classes (id, tenant_id, name)
select ('c1000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'c0000000-0000-0000-0000-0000000000c1',
       'Class ' || g
from generate_series(1, 10) g;

insert into streams (id, tenant_id, class_id, name)
select ('c2000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'c0000000-0000-0000-0000-0000000000c1',
       ('c1000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'Stream ' || g
from generate_series(1, 10) g;

insert into exams (id, tenant_id, name, term, academic_year, status) values
  ('c4000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000c1',
   'Roster Exam', 'Term 1', 2026, 'published'),
  ('c4000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-0000000000c1',
   'Tie Exam', 'Term 1', 2026, 'published');

insert into exam_classes (exam_id, class_id)
select 'c4000000-0000-0000-0000-000000000001'::uuid,
       ('c1000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid
from generate_series(1, 9) g;

insert into subjects (id, tenant_id, name, code)
select gen_random_uuid(), 'c0000000-0000-0000-0000-0000000000c1',
       'Subject ' || lpad(g::text, 3, '0'), 'S' || lpad(g::text, 3, '0')
from generate_series(1, 224) g;

-- S1: latest enrollment (2026, Class 9) wins over older 2024/2025 rows.
-- S2: no enrollment at all -> students.class_id/stream_id fallback.
-- S3: enrollment exists but its stream_id is NULL -> students.stream_id fallback.
-- S4: only an older enrollment (Class 1).
-- S5: belongs to Class 10, which is NOT in exam_classes.
-- S6: the 224-mark incident student (single enrollment).
-- S7: rounding case (mean 80.333...).
insert into students (id, tenant_id, admission_no, full_name, class_id, stream_id, gender) values
  ('c5000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000c1', 'C-001', 'S1 Latest',   'c1000000-0000-0000-0000-000000000009', 'c2000000-0000-0000-0000-000000000009', 'Female'),
  ('c5000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-0000000000c1', 'C-002', 'S2 NoEnroll', 'c1000000-0000-0000-0000-000000000003', null, 'Male'),
  ('c5000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-0000000000c1', 'C-003', 'S3 NullStream', 'c1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000005', 'Female'),
  ('c5000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-0000000000c1', 'C-004', 'S4 OldEnroll', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Male'),
  ('c5000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-0000000000c1', 'C-005', 'S5 Class10',  'c1000000-0000-0000-0000-000000000010', null, 'Female'),
  ('c5000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-0000000000c1', 'C-006', 'S6 Incident', 'c1000000-0000-0000-0000-000000000001', null, 'Male'),
  ('c5000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-0000000000c1', 'C-007', 'S7 Rounding', 'c1000000-0000-0000-0000-000000000010', null, 'Female'),
  ('c5000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-0000000000c1', 'C-008', 'S8 SameYear', 'c1000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000006', 'Male');

insert into student_enrollments (tenant_id, student_id, academic_year, class_id, stream_id) values
  ('c0000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-000000000001', 2024, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-000000000001', 2025, 'c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-000000000001', 2026, 'c1000000-0000-0000-0000-000000000009', 'c2000000-0000-0000-0000-000000000009'),
  ('c0000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-000000000003', 2026, 'c1000000-0000-0000-0000-000000000005', null),
  ('c0000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-000000000004', 2025, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-000000000006', 2026, 'c1000000-0000-0000-0000-000000000001', null);

-- S8: two enrollments in the SAME academic year. The later created_at must win
-- (Class 8), not the student's own class (6) and not the earlier row (Class 7).
insert into student_enrollments (tenant_id, student_id, academic_year, class_id, stream_id, created_at) values
  ('c0000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-000000000008', 2026, 'c1000000-0000-0000-0000-000000000007', 'c2000000-0000-0000-0000-000000000007', '2026-02-01T00:00:00Z'),
  ('c0000000-0000-0000-0000-0000000000c1', 'c5000000-0000-0000-0000-000000000008', 2026, 'c1000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000008', '2026-08-01T00:00:00Z');

-- Published-exam guard would block this load; disable user triggers for the
-- fixture only (the whole transaction is rolled back).
alter table public.marks disable trigger user;

-- S6: 224 marks of score 1 across 224 subjects. Old join: 224 * 9 = 2016.
insert into marks (tenant_id, exam_id, student_id, subject_id, score)
select 'c0000000-0000-0000-0000-0000000000c1',
       'c4000000-0000-0000-0000-000000000001',
       'c5000000-0000-0000-0000-000000000006',
       sub.id,
       1
from subjects sub
where sub.tenant_id = 'c0000000-0000-0000-0000-0000000000c1';

-- S1: 224 marks, half 80 / half 40 -> total 13440, mean 60.
insert into marks (tenant_id, exam_id, student_id, subject_id, score)
select 'c0000000-0000-0000-0000-0000000000c1',
       'c4000000-0000-0000-0000-000000000001',
       'c5000000-0000-0000-0000-000000000001',
       sub.id,
       case when row_number() over (order by sub.code) <= 112 then 80 else 40 end
from subjects sub
where sub.tenant_id = 'c0000000-0000-0000-0000-0000000000c1';

insert into marks (tenant_id, exam_id, student_id, subject_id, score)
select 'c0000000-0000-0000-0000-0000000000c1',
       'c4000000-0000-0000-0000-000000000001',
       s.id,
       sub.id,
       v.score
from (values
  ('c5000000-0000-0000-0000-000000000002'::uuid, 'S001', 100),
  ('c5000000-0000-0000-0000-000000000002'::uuid, 'S002', 100),
  ('c5000000-0000-0000-0000-000000000003'::uuid, 'S001', 30),
  ('c5000000-0000-0000-0000-000000000003'::uuid, 'S002', 30),
  ('c5000000-0000-0000-0000-000000000004'::uuid, 'S001', 40),
  ('c5000000-0000-0000-0000-000000000004'::uuid, 'S002', 50),
  ('c5000000-0000-0000-0000-000000000005'::uuid, 'S001', 90),
  ('c5000000-0000-0000-0000-000000000005'::uuid, 'S002', 90),
  ('c5000000-0000-0000-0000-000000000007'::uuid, 'S001', 80),
  ('c5000000-0000-0000-0000-000000000007'::uuid, 'S002', 80),
  ('c5000000-0000-0000-0000-000000000007'::uuid, 'S003', 81)
) v(student_id, code, score)
join students s on s.id = v.student_id
join subjects sub on sub.code = v.code and sub.tenant_id = s.tenant_id;

-- S8: one mark (50) so it appears on the roster at mean 50 -> position 5.
insert into marks (tenant_id, exam_id, student_id, subject_id, score)
select 'c0000000-0000-0000-0000-0000000000c1',
       'c4000000-0000-0000-0000-000000000001',
       'c5000000-0000-0000-0000-000000000008',
       sub.id,
       50
from subjects sub
where sub.code = 'S004'
  and sub.tenant_id = 'c0000000-0000-0000-0000-0000000000c1';

-- Ranking ties: 100, 80, 80, 60 -> DENSE_RANK 1, 2, 2, 3.
insert into marks (tenant_id, exam_id, student_id, subject_id, score)
select 'c0000000-0000-0000-0000-0000000000c1',
       'c4000000-0000-0000-0000-000000000002',
       s.id, sub.id, v.score
from (values
  ('c5000000-0000-0000-0000-000000000002'::uuid, 100),
  ('c5000000-0000-0000-0000-000000000005'::uuid, 80),
  ('c5000000-0000-0000-0000-000000000007'::uuid, 80),
  ('c5000000-0000-0000-0000-000000000003'::uuid, 60)
) v(student_id, score)
join students s on s.id = v.student_id
join subjects sub on sub.code = 'S001' and sub.tenant_id = s.tenant_id;

alter table public.marks enable trigger user;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c9000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"c0000000-0000-0000-0000-0000000000c1"}',
  true);

do $$
declare
  r record;
  n int;
  total numeric;
  inc record;
begin
  -- --- The reported incident: 224 marks must not become 2016 -------------
  select * into inc from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
  where admission_no = 'C-006';
  if inc.total_score <> 224 then
    raise exception 'FAIL join multiplication: expected 224, got % (224 * 9 exam_classes = 2016)', inc.total_score;
  end if;
  if inc.mean_percentage <> 1 then
    raise exception 'FAIL join multiplication mean: expected 1, got %', inc.mean_percentage;
  end if;
  if inc.subjects_count <> 224 then
    raise exception 'FAIL join multiplication subjects: expected 224, got %', inc.subjects_count;
  end if;

  -- --- No inflated totals anywhere in the exam ---------------------------
  select count(*), coalesce(sum(total_score), 0) into n, total
  from public.get_class_performance('c4000000-0000-0000-0000-000000000001');
  if n <> 8 then
    raise exception 'FAIL roster size: expected 8 students, got %', n;
  end if;
  -- 224 + 13440 + 200 + 60 + 90 + 180 + 241 + 50
  if total <> 14485 then
    raise exception 'FAIL exam total: expected 14485, got %', total;
  end if;

  -- --- Latest enrollment wins; older rows must not duplicate or filter ----
  select * into r from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
  where admission_no = 'C-001';
  if r.total_score <> 13440 or r.mean_percentage <> 60 then
    raise exception 'FAIL S1 totals: expected 13440/60, got %/%', r.total_score, r.mean_percentage;
  end if;
  if r.stream_name <> 'Stream 9' then
    raise exception 'FAIL latest enrollment stream: expected Stream 9, got %', r.stream_name;
  end if;

  select count(*) into n from public.get_class_performance(
    'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000009');
  if n <> 1 then
    raise exception 'FAIL latest-enrollment class filter: expected 1 in Class 9, got %', n;
  end if;

  -- S1's 2024 enrollment is in Class 1; it must NOT match the Class 1 filter.
  select count(*) into n from public.get_class_performance(
    'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001');
  if n <> 2 then
    raise exception 'FAIL stale-enrollment filter: expected only S4/S6 in Class 1, got %', n;
  end if;
  if exists (
    select 1 from public.get_class_performance(
      'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001')
    where admission_no = 'C-001'
  ) then
    raise exception 'FAIL stale-enrollment filter: S1 leaked into its 2024 class';
  end if;

  -- --- Same academic year: later created_at wins --------------------------
  -- S8 has two 2026 enrollments (Class 7 created first, Class 8 created
  -- later). The latest row must be used, not the earliest, and not the
  -- students.class_id fallback (Class 6).
  select * into r from public.get_class_performance(
    'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000008');
  if r.admission_no is distinct from 'C-008' then
    raise exception 'FAIL same-year tie-break: Class 8 filter returned %', coalesce(r.admission_no, '<no row>');
  end if;
  if r.stream_name is distinct from 'Stream 8' then
    raise exception 'FAIL same-year tie-break stream: expected Stream 8, got %', coalesce(r.stream_name, '<null>');
  end if;

  select count(*) into n from public.get_class_performance(
    'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000007');
  if n <> 0 then
    raise exception 'FAIL same-year tie-break: earlier Class 7 row still matches (% rows)', n;
  end if;

  select count(*) into n from public.get_class_performance(
    'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006');
  if n <> 0 then
    raise exception 'FAIL same-year tie-break: students.class_id fallback (Class 6) still matches (% rows)', n;
  end if;

  -- --- Student-level fallback when no enrollment exists ------------------
  select count(*) into n from public.get_class_performance(
    'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003');
  if n <> 1 then
    raise exception 'FAIL no-enrollment fallback: expected 1 in Class 3, got %', n;
  end if;

  -- --- NULL stream on enrollment falls back to students.stream_id --------
  select count(*) into n from public.get_class_performance(
    'c4000000-0000-0000-0000-000000000001', null, 'c2000000-0000-0000-0000-000000000005');
  if n <> 1 then
    raise exception 'FAIL NULL-stream fallback: expected 1 in Stream 5, got %', n;
  end if;

  -- --- exam_classes is not a global filter -------------------------------
  select count(*) into n from public.get_class_performance(
    'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000010');
  if n <> 2 then
    raise exception 'FAIL non-exam class: expected S5/S7 from Class 10, got %', n;
  end if;

  -- --- Ranking respects the current selection ----------------------------
  select * into r from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
  where admission_no = 'C-002';
  if r.class_position <> 1 then
    raise exception 'FAIL ranking: expected C-002 first, got position %', r.class_position;
  end if;
  select * into r from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
  where admission_no = 'C-005';
  if r.class_position <> 2 then
    raise exception 'FAIL ranking: expected C-005 second, got position %', r.class_position;
  end if;
  select * into r from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
  where admission_no = 'C-001';
  if r.class_position <> 4 then
    raise exception 'FAIL ranking: expected C-001 fourth, got position %', r.class_position;
  end if;
  select * into r from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
  where admission_no = 'C-008';
  if r.class_position is distinct from 5 then
    raise exception 'FAIL ranking: expected C-008 (mean 50) fifth, got position %', coalesce(r.class_position::text, '<no row>');
  end if;
  select * into r from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
  where admission_no = 'C-004';
  if r.class_position is distinct from 6 then
    raise exception 'FAIL ranking: expected C-004 (mean 45) sixth, got position %', coalesce(r.class_position::text, '<no row>');
  end if;

  -- Class-filtered ranking restarts at 1.
  select * into r from public.get_class_performance(
    'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000010');
  if r.class_position <> 1 or r.admission_no <> 'C-005' then
    raise exception 'FAIL filtered ranking: expected C-005 at 1, got % at %', r.admission_no, r.class_position;
  end if;

  -- --- Two-decimal rounding preserved ------------------------------------
  select * into r from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
  where admission_no = 'C-007';
  if r.mean_percentage <> 80.33 then
    raise exception 'FAIL rounding: expected 80.33, got %', r.mean_percentage;
  end if;

  -- --- Config-driven overall grade (80.33 -> EE, 60 -> ME, 1 -> BE) ------
  if (select overall_grade from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
      where admission_no = 'C-007') <> 'EE' then
    raise exception 'FAIL config grade: C-007 (80.33) should be EE';
  end if;
  if (select overall_grade from public.get_class_performance('c4000000-0000-0000-0000-000000000001')
      where admission_no = 'C-006') <> 'BE' then
    raise exception 'FAIL config grade: C-006 (1) should be BE';
  end if;
end $$;

-- --- Ranking ties use DENSE_RANK within a selection ----------------------
do $$
declare
  positions int[];
begin
  select array_agg(class_position order by total_score desc, admission_no) into positions
  from public.get_class_performance('c4000000-0000-0000-0000-000000000002');
  if positions <> array[1, 2, 2, 3] then
    raise exception 'FAIL DENSE_RANK ties: expected [1,2,2,3], got %', positions;
  end if;
end $$;

select 'JOIN/ROSTER/RANKING CHECKS PASSED' as result;
rollback;
