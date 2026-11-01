-- Analytics tenant-isolation and correctness tests.
--
-- Run against a LOCAL / DISPOSABLE database only, after the analytics
-- migrations have been applied:
--
--   supabase db reset
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/analytics_tenant_isolation.sql
--   Expect: ALL ANALYTICS CHECKS PASSED
--
-- Everything runs in one transaction and is rolled back.
--
-- NEVER run this against project fzwexcgsyzdqyauwccah (production): it inserts
-- tenants, exams, students and marks.
--
-- The grading configuration below is deliberately NON-standard
-- (EE 80-100, ME 60-79.99, AE 30-59.99, BE 0-29.99) so the tests prove the
-- subject-performance categories follow the configuration instead of the old
-- hardcoded 75/50/40 thresholds.
begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as the migration-owning superuser)
-- ---------------------------------------------------------------------------
insert into tenants (id, name) values
  ('a0000000-0000-0000-0000-0000000000a1', 'Analytics School A'),
  ('b0000000-0000-0000-0000-0000000000b1', 'Analytics School B');

-- Two school administrators. my_tenant_id()/is_admin() read profiles, while the
-- analytics functions read the JWT tenant_id claim, so both must line up for
-- the "valid tenant" case.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000f1', 'analytics-admin-a@test.local'),
  ('b0000000-0000-0000-0000-0000000000f1', 'analytics-admin-b@test.local');

insert into profiles (id, tenant_id, full_name, role) values
  ('a0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-0000000000a1', 'Admin A', 'admin'),
  ('b0000000-0000-0000-0000-0000000000f1', 'b0000000-0000-0000-0000-0000000000b1', 'Admin B', 'admin');

insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('ac000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', '4', true, 'default'),
  ('bc000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', '4', true, 'default');

insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('ac000000-0000-0000-0000-000000000001', 'EE', 80, 100, 4, 'Exceeding Expectations', 'EE', 0),
  ('ac000000-0000-0000-0000-000000000001', 'ME', 60, 79.99, 3, 'Meeting Expectations', 'ME', 1),
  ('ac000000-0000-0000-0000-000000000001', 'AE', 30, 59.99, 2, 'Approaching Expectations', 'AE', 2),
  ('ac000000-0000-0000-0000-000000000001', 'BE', 0, 29.99, 1, 'Below Expectations', 'BE', 3),
  ('bc000000-0000-0000-0000-000000000001', 'EE', 80, 100, 4, 'Exceeding Expectations', 'EE', 0),
  ('bc000000-0000-0000-0000-000000000001', 'ME', 60, 79.99, 3, 'Meeting Expectations', 'ME', 1),
  ('bc000000-0000-0000-0000-000000000001', 'AE', 30, 59.99, 2, 'Approaching Expectations', 'AE', 2),
  ('bc000000-0000-0000-0000-000000000001', 'BE', 0, 29.99, 1, 'Below Expectations', 'BE', 3);

insert into classes (id, tenant_id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'Class A1'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1', 'Class A2'),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', 'Class B1');

insert into streams (id, tenant_id, class_id, name) values
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000001', 'A1 Blue');

insert into subjects (id, tenant_id, name, code) values
  ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'Mathematics', 'MAT'),
  ('a3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1', 'English', 'ENG'),
  ('b3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', 'Mathematics', 'MAT');

insert into exams (id, tenant_id, name, term, academic_year, status) values
  ('a4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'School A Published Exam', 'Term 1', 2026, 'published'),
  ('a4000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1', 'School A Draft Exam', 'Term 1', 2026, 'draft'),
  ('b4000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', 'School B Published Exam', 'Term 1', 2026, 'published');

-- Two classes sit the same exam. The old implementation multiplied every mark
-- once per row here.
insert into exam_classes (exam_id, class_id) values
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');

insert into students (id, tenant_id, admission_no, full_name, class_id, stream_id, gender) values
  ('a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'A-001', 'Alice A', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Female'),
  ('a5000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1', 'A-002', 'Bob A', 'a1000000-0000-0000-0000-000000000002', null, 'Male'),
  ('b5000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', 'B-001', 'Cara B', 'b1000000-0000-0000-0000-000000000001', null, 'Female');

-- Alice has an older enrollment in A2 and the current one in A1. Only the
-- latest year may be used, and it must not duplicate her marks.
insert into student_enrollments (tenant_id, student_id, academic_year, class_id, stream_id) values
  ('a0000000-0000-0000-0000-0000000000a1', 'a5000000-0000-0000-0000-000000000001', 2025, 'a1000000-0000-0000-0000-000000000002', null),
  ('a0000000-0000-0000-0000-0000000000a1', 'a5000000-0000-0000-0000-000000000001', 2026, 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-0000000000a1', 'a5000000-0000-0000-0000-000000000002', 2026, 'a1000000-0000-0000-0000-000000000002', null),
  ('b0000000-0000-0000-0000-0000000000b1', 'b5000000-0000-0000-0000-000000000001', 2026, 'b1000000-0000-0000-0000-000000000001', null);

-- Alice: 76 + 40 = 116 -> mean 58 (AE under this config, ME under the old
-- hardcoded thresholds). Bob: 60 + 90 = 150 -> mean 75 (ME under this config,
-- EE under the old hardcoded thresholds).
--
-- Marks are normally written to a draft exam and then published. For a compact
-- fixture the integrity triggers are disabled for this insert only; the whole
-- transaction is rolled back at the end.
alter table public.marks disable trigger user;

insert into marks (tenant_id, exam_id, student_id, subject_id, score) values
  ('a0000000-0000-0000-0000-0000000000a1', 'a4000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 76),
  ('a0000000-0000-0000-0000-0000000000a1', 'a4000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 40),
  ('a0000000-0000-0000-0000-0000000000a1', 'a4000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 60),
  ('a0000000-0000-0000-0000-0000000000a1', 'a4000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000002', 90),
  ('a0000000-0000-0000-0000-0000000000a1', 'a4000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 50),
  ('b0000000-0000-0000-0000-0000000000b1', 'b4000000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 90);

alter table public.marks enable trigger user;

-- ---------------------------------------------------------------------------
-- 1. Valid tenant access: values are correct and marks are not multiplied
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"a0000000-0000-0000-0000-0000000000a1"}', true);
do $$
declare
  n int;
  total numeric;
  alice record;
  bob record;
begin
  select count(*), coalesce(sum(total_score), 0) into n, total
  from public.get_class_performance('a4000000-0000-0000-0000-000000000001');

  if n <> 2 then
    raise exception 'FAIL valid tenant: expected 2 students, got %', n;
  end if;
  if total <> 266 then
    raise exception 'FAIL valid tenant: expected total 266 (no join multiplication), got %', total;
  end if;

  select * into alice from public.get_class_performance('a4000000-0000-0000-0000-000000000001')
  where admission_no = 'A-001';
  select * into bob from public.get_class_performance('a4000000-0000-0000-0000-000000000001')
  where admission_no = 'A-002';

  if alice.total_score <> 116 or alice.mean_percentage <> 58 then
    raise exception 'FAIL Alice totals: expected 116/58, got %/%', alice.total_score, alice.mean_percentage;
  end if;
  if bob.total_score <> 150 or bob.mean_percentage <> 75 then
    raise exception 'FAIL Bob totals: expected 150/75, got %/%', bob.total_score, bob.mean_percentage;
  end if;
  if bob.class_position <> 1 or alice.class_position <> 2 then
    raise exception 'FAIL ranking: expected Bob 1 / Alice 2, got % / %', bob.class_position, alice.class_position;
  end if;
  -- Config is EE 80-100 / ME 60-79.99 / AE 30-59.99 / BE 0-29.99.
  if bob.overall_grade <> 'ME' or alice.overall_grade <> 'AE' then
    raise exception 'FAIL overall grade: expected ME/AE, got %/%', bob.overall_grade, alice.overall_grade;
  end if;
  if alice.subjects_count <> 2 then
    raise exception 'FAIL subject count: expected 2, got %', alice.subjects_count;
  end if;

  -- Class filter uses the latest enrollment (A1) and must not leak the other
  -- class that also sits the exam.
  select count(*) into n
  from public.get_class_performance('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');
  if n <> 1 then
    raise exception 'FAIL class filter: expected 1 student in A1, got %', n;
  end if;

  -- Ranking is scoped to the selection: Alice is 2nd exam-wide but 1st when
  -- the dashboard is filtered to her class.
  select * into alice from public.get_class_performance(
    'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'
  );
  if alice.class_position <> 1 then
    raise exception 'FAIL class-filtered position: expected 1, got %', alice.class_position;
  end if;

  select count(*) into n
  from public.get_grade_distribution('a4000000-0000-0000-0000-000000000001');
  if n <> 2 then
    raise exception 'FAIL grade distribution buckets: expected 2, got %', n;
  end if;
end $$;

-- Subject performance follows the configuration, not 75/50/40.
do $$
declare
  maths record;
  english record;
begin
  select * into maths from public.get_subject_performance('a4000000-0000-0000-0000-000000000001')
  where subject_code = 'MAT';
  select * into english from public.get_subject_performance('a4000000-0000-0000-0000-000000000001')
  where subject_code = 'ENG';

  if maths.mean_score <> 68 or maths.total_students <> 2 then
    raise exception 'FAIL Maths stats: expected mean 68 / 2 students, got %/%', maths.mean_score, maths.total_students;
  end if;
  -- 76 is ME here (EE starts at 80); the old hardcoded threshold called it EE.
  if maths.ee_count <> 0 or maths.me_count <> 2 or maths.ae_count <> 0 or maths.be_count <> 0 then
    raise exception 'FAIL Maths broad counts (config not applied): EE=% ME=% AE=% BE=%',
      maths.ee_count, maths.me_count, maths.ae_count, maths.be_count;
  end if;
  if maths.pass_count <> 2 or maths.pass_rate <> 100 then
    raise exception 'FAIL Maths pass stats: expected 2/100, got %/%', maths.pass_count, maths.pass_rate;
  end if;

  if english.mean_score <> 65 or english.total_students <> 2 then
    raise exception 'FAIL English stats: expected mean 65 / 2 students, got %/%', english.mean_score, english.total_students;
  end if;
  if english.ee_count <> 1 or english.me_count <> 0 or english.ae_count <> 1 or english.be_count <> 0 then
    raise exception 'FAIL English broad counts: EE=% ME=% AE=% BE=%',
      english.ee_count, english.me_count, english.ae_count, english.be_count;
  end if;

  -- Invariant: broad counts add up to total_students for every subject.
  if exists (
    select 1 from public.get_subject_performance('a4000000-0000-0000-0000-000000000001') s
    where s.ee_count + s.me_count + s.ae_count + s.be_count <> s.total_students
  ) then
    raise exception 'FAIL broad counts do not sum to total_students';
  end if;
end $$;

-- Report data: correct position, total and grades, no leaked students.
do $$
declare
  r json;
begin
  r := public.get_student_report_data(
    'a5000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001'
  );

  if (r #>> '{summary,position}')::int <> 2 then
    raise exception 'FAIL report position: expected 2, got %', r #>> '{summary,position}';
  end if;
  if (r #>> '{summary,total_in_class}')::int <> 2 then
    raise exception 'FAIL report total_in_class: expected 2, got %', r #>> '{summary,total_in_class}';
  end if;
  if (r #>> '{summary,total_score}')::numeric <> 116 then
    raise exception 'FAIL report total_score: expected 116, got %', r #>> '{summary,total_score}';
  end if;
  if (r #>> '{student,class}') <> 'Class A1' then
    raise exception 'FAIL report class: expected Class A1, got %', r #>> '{student,class}';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Missing tenant claim fails closed
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
do $$
begin
  begin
    perform count(*) from public.get_class_performance('a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL missing claim: get_class_performance allowed';
  exception when others then
    if sqlerrm = 'FAIL missing claim: get_class_performance allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then raise exception 'FAIL missing claim message: %', sqlerrm; end if;
  end;

  begin
    perform count(*) from public.get_subject_performance('a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL missing claim: get_subject_performance allowed';
  exception when others then
    if sqlerrm = 'FAIL missing claim: get_subject_performance allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then raise exception 'FAIL missing claim message (subject): %', sqlerrm; end if;
  end;

  begin
    perform public.get_student_report_data('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL missing claim: get_student_report_data allowed';
  exception when others then
    if sqlerrm = 'FAIL missing claim: get_student_report_data allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then raise exception 'FAIL missing claim message (report): %', sqlerrm; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Malformed tenant claim fails closed (cast error is swallowed into NULL)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"not-a-uuid"}', true);
do $$
begin
  begin
    perform count(*) from public.get_class_performance('a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL malformed claim allowed';
  exception when others then
    if sqlerrm = 'FAIL malformed claim allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then raise exception 'FAIL malformed claim message: %', sqlerrm; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Mismatched tenant claim is denied (exam and grading config)
--    Profile A (so RLS still shows School A's rows) with a stale/forged
--    claim for School B must not read School A's data.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"b0000000-0000-0000-0000-0000000000b1"}', true);
do $$
begin
  begin
    perform count(*) from public.get_class_performance('a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL mismatched claim: exam read allowed';
  exception when others then
    if sqlerrm = 'FAIL mismatched claim: exam read allowed' then raise; end if;
    if sqlerrm <> 'Access denied to exam from different tenant' then
      raise exception 'FAIL mismatched claim message: %', sqlerrm;
    end if;
  end;

  begin
    perform count(*) from public.get_grade_for_score('a0000000-0000-0000-0000-0000000000a1', 60);
    raise exception 'FAIL mismatched claim: grading config read allowed';
  exception when others then
    if sqlerrm = 'FAIL mismatched claim: grading config read allowed' then raise; end if;
    if sqlerrm <> 'Access denied to grading config from different tenant' then
      raise exception 'FAIL mismatched grading claim message: %', sqlerrm;
    end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Unpublished exams are not readable, even by the owning tenant
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"a0000000-0000-0000-0000-0000000000a1"}', true);
do $$
begin
  begin
    perform count(*) from public.get_class_performance('a4000000-0000-0000-0000-000000000002');
    raise exception 'FAIL draft exam: get_class_performance allowed';
  exception when others then
    if sqlerrm = 'FAIL draft exam: get_class_performance allowed' then raise; end if;
    if sqlerrm <> 'Exam is not published' then raise exception 'FAIL draft message: %', sqlerrm; end if;
  end;

  begin
    perform count(*) from public.get_subject_performance('a4000000-0000-0000-0000-000000000002');
    raise exception 'FAIL draft exam: get_subject_performance allowed';
  exception when others then
    if sqlerrm = 'FAIL draft exam: get_subject_performance allowed' then raise; end if;
    if sqlerrm <> 'Exam is not published' then raise exception 'FAIL draft message (subject): %', sqlerrm; end if;
  end;

  begin
    perform public.get_student_report_data('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002');
    raise exception 'FAIL draft exam: get_student_report_data allowed';
  exception when others then
    if sqlerrm = 'FAIL draft exam: get_student_report_data allowed' then raise; end if;
    if sqlerrm <> 'Exam is not published' then raise exception 'FAIL draft message (report): %', sqlerrm; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Student reports cannot cross tenant boundaries
-- ---------------------------------------------------------------------------
-- (a) School A claims School A exam but asks for School B's student.
do $$
begin
  begin
    perform public.get_student_report_data('b5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL cross-tenant student report allowed';
  exception when others then
    if sqlerrm = 'FAIL cross-tenant student report allowed' then raise; end if;
    if sqlerrm <> 'Student not found in this tenant' then
      raise exception 'FAIL cross-tenant student message: %', sqlerrm;
    end if;
  end;
end $$;

-- (b) School B claims School B and asks for School A's exam. RLS hides the
-- exam row, so the function reports it as not found rather than leaking its
-- existence.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"b0000000-0000-0000-0000-0000000000b1"}', true);
do $$
begin
  begin
    perform public.get_student_report_data('b5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL cross-tenant exam report allowed';
  exception when others then
    if sqlerrm = 'FAIL cross-tenant exam report allowed' then raise; end if;
    if sqlerrm <> 'Exam not found' then raise exception 'FAIL cross-tenant exam message: %', sqlerrm; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Intended service_role access (DB role service_role bypasses RLS; the
--    function also accepts the JWT claim). This is the only bypass.
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  n int;
begin
  -- No tenant_id claim, reading School A's exam.
  select count(*) into n from public.get_class_performance('a4000000-0000-0000-0000-000000000001');
  if n <> 2 then raise exception 'FAIL service_role class performance: expected 2, got %', n; end if;

  select count(*) into n from public.get_subject_performance('a4000000-0000-0000-0000-000000000001');
  if n <> 2 then raise exception 'FAIL service_role subject performance: expected 2, got %', n; end if;

  -- And School B's exam in the same call context.
  select count(*) into n from public.get_class_performance('b4000000-0000-0000-0000-000000000001');
  if n <> 1 then raise exception 'FAIL service_role other tenant: expected 1, got %', n; end if;

  perform public.get_student_report_data('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001');
end $$;

reset role;
select 'ALL ANALYTICS CHECKS PASSED' as result;
rollback;
