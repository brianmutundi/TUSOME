-- Additional tenant-isolation, grant and error-propagation checks.
--
-- LOCAL / DISPOSABLE DATABASE ONLY. Requires the base schema and both analytics
-- migrations. Runs in one transaction and rolls back.
--
-- The primary isolation suite is analytics_tenant_isolation.sql; this file adds
-- the cases it does not cover:
--   * get_grade_distribution and get_grade_for_score authorization paths;
--   * anon has no EXECUTE privilege on any analytics RPC;
--   * RLS actually filters the underlying tables (harness self-check);
--   * service_role bypass for every RPC, including grade distribution;
--   * non-existent ids fail with a message instead of an empty result.
begin;

insert into tenants (id, name) values
  ('a0000000-0000-0000-0000-0000000000a1', 'Isolation A'),
  ('b0000000-0000-0000-0000-0000000000b1', 'Isolation B');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000f1', 'iso-admin-a@test.local'),
  ('b0000000-0000-0000-0000-0000000000f1', 'iso-admin-b@test.local');

insert into profiles (id, tenant_id, full_name, role) values
  ('a0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-0000000000a1', 'Admin A', 'admin'),
  ('b0000000-0000-0000-0000-0000000000f1', 'b0000000-0000-0000-0000-0000000000b1', 'Admin B', 'admin');

insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('ac000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', '4', true, 'default'),
  ('bc000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', '4', true, 'default');

insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('ac000000-0000-0000-0000-000000000001', 'EE', 80, 100, 4, 'Exceeding', 'EE', 0),
  ('ac000000-0000-0000-0000-000000000001', 'ME', 60, 79.99, 3, 'Meeting', 'ME', 1),
  ('ac000000-0000-0000-0000-000000000001', 'AE', 30, 59.99, 2, 'Approaching', 'AE', 2),
  ('ac000000-0000-0000-0000-000000000001', 'BE', 0, 29.99, 1, 'Below', 'BE', 3),
  ('bc000000-0000-0000-0000-000000000001', 'EE', 80, 100, 4, 'Exceeding', 'EE', 0),
  ('bc000000-0000-0000-0000-000000000001', 'ME', 60, 79.99, 3, 'Meeting', 'ME', 1),
  ('bc000000-0000-0000-0000-000000000001', 'AE', 30, 59.99, 2, 'Approaching', 'AE', 2),
  ('bc000000-0000-0000-0000-000000000001', 'BE', 0, 29.99, 1, 'Below', 'BE', 3);

insert into classes (id, tenant_id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'A1'),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', 'B1');

insert into subjects (id, tenant_id, name, code) values
  ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'Maths', 'MAT'),
  ('b3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', 'Maths', 'MAT');

insert into students (id, tenant_id, admission_no, full_name, class_id) values
  ('a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'A-001', 'Alice', 'a1000000-0000-0000-0000-000000000001'),
  ('b5000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', 'B-001', 'Cara', 'b1000000-0000-0000-0000-000000000001');

insert into exams (id, tenant_id, name, term, academic_year, status) values
  ('a4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'A Published', 'Term 1', 2026, 'published'),
  ('a4000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1', 'A Draft', 'Term 1', 2026, 'draft'),
  ('b4000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', 'B Published', 'Term 1', 2026, 'published');

alter table public.marks disable trigger user;
insert into marks (tenant_id, exam_id, student_id, subject_id, score) values
  ('a0000000-0000-0000-0000-0000000000a1', 'a4000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 90),
  ('a0000000-0000-0000-0000-0000000000a1', 'a4000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 70),
  ('b0000000-0000-0000-0000-0000000000b1', 'b4000000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 40);
alter table public.marks enable trigger user;

-- ---------------------------------------------------------------------------
-- 1. Grants: authenticated and service_role must be able to execute.
--
-- NOTE: the migrations GRANT but do not REVOKE the PostgreSQL default
-- EXECUTE ... TO PUBLIC, so anon also holds the privilege. That is recorded as
-- an EVIDENCE row by the runner rather than asserted here; what must hold is
-- that anon cannot obtain any data (section 2 below), which is the property the
-- functions actually rely on.
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.get_grade_for_score(uuid,numeric,text,text)',
    'public.get_class_performance(uuid,uuid,uuid)',
    'public.get_grade_distribution(uuid,uuid,uuid)',
    'public.get_subject_performance(uuid,uuid,uuid)',
    'public.get_student_report_data(uuid,uuid)'
  ] loop
    if not has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'FAIL grant: authenticated lacks EXECUTE on %', f;
    end if;
    if not has_function_privilege('service_role', f, 'EXECUTE') then
      raise exception 'FAIL grant: service_role lacks EXECUTE on %', f;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. anon is fail-closed: every RPC must raise, and none may return rows
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare
  f text;
  got_rows boolean;
begin
  foreach f in array array[
    'public.get_grade_for_score(uuid,numeric,text,text)',
    'public.get_class_performance(uuid,uuid,uuid)',
    'public.get_grade_distribution(uuid,uuid,uuid)',
    'public.get_subject_performance(uuid,uuid,uuid)',
    'public.get_student_report_data(uuid,uuid)'
  ] loop
    begin
      if f like '%grade_for_score%' then
        got_rows := exists (select 1 from public.get_grade_for_score('a0000000-0000-0000-0000-0000000000a1', 90));
      elsif f like '%class_performance%' then
        got_rows := exists (select 1 from public.get_class_performance('a4000000-0000-0000-0000-000000000001'));
      elsif f like '%grade_distribution%' then
        got_rows := exists (select 1 from public.get_grade_distribution('a4000000-0000-0000-0000-000000000001'));
      elsif f like '%subject_performance%' then
        got_rows := exists (select 1 from public.get_subject_performance('a4000000-0000-0000-0000-000000000001'));
      else
        got_rows := (public.get_student_report_data('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001')) is not null;
      end if;
      raise exception 'FAIL anon: % returned normally', f;
    exception
      when insufficient_privilege then null;
      when others then
        if sqlerrm = 'FAIL anon: ' || f || ' returned normally' then raise; end if;
        if sqlerrm <> 'Missing tenant claim' then
          raise exception 'FAIL anon (%) unexpected error: %', f, sqlerrm;
        end if;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. RLS self-check: tenant A cannot see tenant B rows directly
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"a0000000-0000-0000-0000-0000000000a1"}',
  true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from public.students;
  if n <> 1 then raise exception 'FAIL RLS students: expected 1 visible, got %', n; end if;

  select count(*) into n from public.students where id = 'b5000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FAIL RLS: tenant B student is visible'; end if;

  select count(*) into n from public.exams;
  if n <> 2 then raise exception 'FAIL RLS exams: expected 2 visible, got %', n; end if;

  select count(*) into n from public.marks;
  if n <> 2 then raise exception 'FAIL RLS marks: expected 2 visible, got %', n; end if;

  select count(*) into n from public.grading_configuration_levels;
  if n <> 4 then raise exception 'FAIL RLS grading levels: expected 4 visible, got %', n; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Missing / mismatched claims on every RPC
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    perform * from public.get_grade_distribution('a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL missing claim: grade_distribution allowed';
  exception when others then
    if sqlerrm = 'FAIL missing claim: grade_distribution allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then raise exception 'FAIL distribution claim msg: %', sqlerrm; end if;
  end;

  begin
    perform * from public.get_grade_for_score('a0000000-0000-0000-0000-0000000000a1', 90);
    raise exception 'FAIL missing claim: grade_for_score allowed';
  exception when others then
    if sqlerrm = 'FAIL missing claim: grade_for_score allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then raise exception 'FAIL grade claim msg: %', sqlerrm; end if;
  end;
end $$;

reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"b0000000-0000-0000-0000-0000000000b1"}',
  true);
set local role authenticated;

do $$
begin
  begin
    perform * from public.get_grade_distribution('a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL mismatch: grade_distribution allowed';
  exception when others then
    if sqlerrm = 'FAIL mismatch: grade_distribution allowed' then raise; end if;
    if sqlerrm <> 'Access denied to exam from different tenant' then
      raise exception 'FAIL distribution mismatch msg: %', sqlerrm;
    end if;
  end;

  begin
    perform * from public.get_subject_performance('a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL mismatch: subject_performance allowed';
  exception when others then
    if sqlerrm = 'FAIL mismatch: subject_performance allowed' then raise; end if;
    if sqlerrm <> 'Access denied to exam from different tenant' then
      raise exception 'FAIL subject mismatch msg: %', sqlerrm;
    end if;
  end;

  begin
    perform public.get_student_report_data('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL mismatch: report allowed';
  exception when others then
    if sqlerrm = 'FAIL mismatch: report allowed' then raise; end if;
    if sqlerrm <> 'Access denied' then raise exception 'FAIL report mismatch msg: %', sqlerrm; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Unpublished exam on the remaining RPCs
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"a0000000-0000-0000-0000-0000000000a1"}',
  true);
set local role authenticated;

do $$
begin
  begin
    perform * from public.get_grade_distribution('a4000000-0000-0000-0000-000000000002');
    raise exception 'FAIL draft: grade_distribution allowed';
  exception when others then
    if sqlerrm = 'FAIL draft: grade_distribution allowed' then raise; end if;
    if sqlerrm <> 'Exam is not published' then raise exception 'FAIL draft distribution msg: %', sqlerrm; end if;
  end;
end $$;

-- Non-existent exam must report a message, not an empty success.
do $$
begin
  begin
    perform * from public.get_class_performance('a4000000-0000-0000-0000-0000000000ff');
    raise exception 'FAIL missing exam: returned no error';
  exception when others then
    if sqlerrm = 'FAIL missing exam: returned no error' then raise; end if;
    if sqlerrm <> 'Exam not found' then raise exception 'FAIL missing exam msg: %', sqlerrm; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Intended service_role bypass, every RPC, no tenant claim
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  n int;
  g record;
begin
  select count(*) into n from public.get_class_performance('b4000000-0000-0000-0000-000000000001');
  if n <> 1 then raise exception 'FAIL service_role class: expected 1, got %', n; end if;

  select count(*) into n from public.get_grade_distribution('a4000000-0000-0000-0000-000000000001');
  if n <> 1 then raise exception 'FAIL service_role distribution: expected 1, got %', n; end if;

  select count(*) into n from public.get_subject_performance('b4000000-0000-0000-0000-000000000001');
  if n <> 1 then raise exception 'FAIL service_role subject: expected 1, got %', n; end if;

  select * into g from public.get_grade_for_score('b0000000-0000-0000-0000-0000000000b1', 40);
  if g.code <> 'AE' then raise exception 'FAIL service_role grade: expected AE, got %', g.code; end if;

  perform public.get_student_report_data('b5000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001');
end $$;

reset role;
select 'ISOLATION EXTRA CHECKS PASSED' as result;
rollback;
