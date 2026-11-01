-- Grading-configuration boundary tests.
--
-- LOCAL / DISPOSABLE DATABASE ONLY. Requires the base schema and both analytics
-- migrations. Runs in one transaction and rolls back.
--
-- Proves that:
--   * broad categories come from the tenant's configuration, not 75/50/40;
--   * band edges are inclusive on both sides;
--   * gaps and out-of-range scores fail loudly;
--   * inactive, missing and empty configurations behave predictably;
--   * unsupported / NULL broad codes stop subject performance instead of
--     producing counts that do not add up;
--   * pass_count/pass_rate still use the unchanged score >= 40 rule;
--   * the two-decimal rounding in get_class_performance is preserved.
begin;

-- ---------------------------------------------------------------------------
-- Fixtures (created before SET ROLE, as the disposable-database owner)
-- ---------------------------------------------------------------------------
insert into tenants (id, name) values
  ('d0000000-0000-0000-0000-0000000000d1', 'Boundary School'),
  ('e0000000-0000-0000-0000-0000000000e1', 'Unsupported Broad School'),
  ('f0000000-0000-0000-0000-0000000000f1', 'Null Broad School'),
  ('10000000-0000-0000-0000-0000000000a1', 'No Config School'),
  ('10000000-0000-0000-0000-0000000000b1', 'Empty Config School'),
  ('10000000-0000-0000-0000-0000000000c1', 'Alternate Thresholds School');

-- One authenticated admin per tenant used by the assertions below.
insert into auth.users (id, email) values
  ('d9000000-0000-0000-0000-0000000000f1', 'boundary-admin@test.local'),
  ('19000000-0000-0000-0000-0000000000f1', 'alternate-admin@test.local'),
  ('19000000-0000-0000-0000-0000000000f2', 'noconfig-admin@test.local'),
  ('19000000-0000-0000-0000-0000000000f3', 'emptyconfig-admin@test.local'),
  ('e9000000-0000-0000-0000-0000000000f1', 'unsupported-admin@test.local'),
  ('f9000000-0000-0000-0000-0000000000f1', 'nullbroad-admin@test.local');

insert into profiles (id, tenant_id, full_name, role) values
  ('d9000000-0000-0000-0000-0000000000f1', 'd0000000-0000-0000-0000-0000000000d1', 'Boundary Admin', 'admin'),
  ('19000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c1', 'Alternate Admin', 'admin'),
  ('19000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-0000000000a1', 'No Config Admin', 'admin'),
  ('19000000-0000-0000-0000-0000000000f3', '10000000-0000-0000-0000-0000000000b1', 'Empty Config Admin', 'admin'),
  ('e9000000-0000-0000-0000-0000000000f1', 'e0000000-0000-0000-0000-0000000000e1', 'Unsupported Admin', 'admin'),
  ('f9000000-0000-0000-0000-0000000000f1', 'f0000000-0000-0000-0000-0000000000f1', 'Null Broad Admin', 'admin');

-- Tenant D: 80 / 60 / 30 / 0 boundaries + an inactive decoy.
insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('dc000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000d1', '4', true, 'default'),
  ('dc000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000d1', '9', false, 'default');

insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('dc000000-0000-0000-0000-000000000001', 'EE', 80, 100, 4, 'Exceeding Expectations', 'EE', 0),
  ('dc000000-0000-0000-0000-000000000001', 'ME', 60, 79.99, 3, 'Meeting Expectations', 'ME', 1),
  ('dc000000-0000-0000-0000-000000000001', 'AE', 30, 59.99, 2, 'Approaching Expectations', 'AE', 2),
  ('dc000000-0000-0000-0000-000000000001', 'BE', 0, 29.99, 1, 'Below Expectations', 'BE', 3),
  ('dc000000-0000-0000-0000-000000000002', 'XX', 0, 100, 9, 'Decoy', 'XX', 0);

-- Tenant E: a broad code the dashboard cannot render.
insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('ec000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', '4', true, 'default');
insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('ec000000-0000-0000-0000-000000000001', 'EE', 80, 100, 4, 'Exceeding', 'XX', 0),
  ('ec000000-0000-0000-0000-000000000001', 'ME', 60, 79.99, 3, 'Meeting', 'XX', 1),
  ('ec000000-0000-0000-0000-000000000001', 'AE', 30, 59.99, 2, 'Approaching', 'XX', 2),
  ('ec000000-0000-0000-0000-000000000001', 'BE', 0, 29.99, 1, 'Below', 'XX', 3);

-- Tenant F: NULL broad code.
insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('fc000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000f1', '4', true, 'default');
insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('fc000000-0000-0000-0000-000000000001', 'EE', 80, 100, 4, 'Exceeding', null, 0),
  ('fc000000-0000-0000-0000-000000000001', 'ME', 60, 79.99, 3, 'Meeting', null, 1),
  ('fc000000-0000-0000-0000-000000000001', 'AE', 30, 59.99, 2, 'Approaching', null, 2),
  ('fc000000-0000-0000-0000-000000000001', 'BE', 0, 29.99, 1, 'Below', null, 3);

-- Tenant B1: active configuration with zero levels.
insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('1bc00000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b1', '4', true, 'default');

-- Tenant C1: a third, clearly different scale (90 / 75 / 60 / 0).
insert into grading_configurations (id, tenant_id, mode, active, school_level) values
  ('1cc00000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000c1', '8', true, 'default');
insert into grading_configuration_levels
  (config_id, code, min_percent, max_percent, points, name, broad, sort_order) values
  ('1cc00000-0000-0000-0000-000000000001', 'EE', 90, 100, 4, 'Exceeding', 'EE', 0),
  ('1cc00000-0000-0000-0000-000000000001', 'ME', 75, 89.99, 3, 'Meeting', 'ME', 1),
  ('1cc00000-0000-0000-0000-000000000001', 'AE', 60, 74.99, 2, 'Approaching', 'AE', 2),
  ('1cc00000-0000-0000-0000-000000000001', 'BE', 0, 59.99, 1, 'Below', 'BE', 3);

-- Tenant D: exam 1 (distribution/denominator) and exam 2 (rounding/pass edge).
insert into classes (id, tenant_id, name) values
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000d1', 'D1');
insert into subjects (id, tenant_id, name, code) values
  ('d3000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000d1', 'Maths', 'MAT'),
  ('d3000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000d1', 'Science', 'SCN'),
  ('d3000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-0000000000d1', 'Art', 'ART'),
  ('d3000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-0000000000d1', 'Geography', 'GEO'),
  ('d3000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-0000000000d1', 'History', 'HIS');
insert into students (id, tenant_id, admission_no, full_name, class_id) values
  ('d5000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000d1', 'D-001', 'On EE floor',  'd1000000-0000-0000-0000-000000000001'),
  ('d5000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000d1', 'D-002', 'On ME floor',  'd1000000-0000-0000-0000-000000000001'),
  ('d5000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-0000000000d1', 'D-003', 'Low 20',       'd1000000-0000-0000-0000-000000000001'),
  ('d5000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-0000000000d1', 'D-004', 'Just below EE', 'd1000000-0000-0000-0000-000000000001'),
  ('d5000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-0000000000d1', 'D-005', 'Rounds up to 80', 'd1000000-0000-0000-0000-000000000001'),
  ('d5000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-0000000000d1', 'D-006', 'Exactly 40',   'd1000000-0000-0000-0000-000000000001'),
  ('d5000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-0000000000d1', 'D-007', 'Just below 40', 'd1000000-0000-0000-0000-000000000001');
insert into exams (id, tenant_id, name, term, academic_year, status) values
  ('d4000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000d1', 'Boundary Exam', 'Term 1', 2026, 'published'),
  ('d4000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000d1', 'Rounding Exam', 'Term 1', 2026, 'published');
insert into exam_classes (exam_id, class_id) values
  ('d4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001');

alter table public.marks disable trigger user;
-- Exam 1: one subject, four students (80, 60, 20, 79.99).
insert into marks (tenant_id, exam_id, student_id, subject_id, score) values
  ('d0000000-0000-0000-0000-0000000000d1', 'd4000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 80),
  ('d0000000-0000-0000-0000-0000000000d1', 'd4000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000001', 60),
  ('d0000000-0000-0000-0000-0000000000d1', 'd4000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000001', 20),
  ('d0000000-0000-0000-0000-0000000000d1', 'd4000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000001', 79.99);
-- Exam 2: mean 79.995 rounds to 80.00; 40 passes; 39.99 does not.
insert into marks (tenant_id, exam_id, student_id, subject_id, score) values
  ('d0000000-0000-0000-0000-0000000000d1', 'd4000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000005', 'd3000000-0000-0000-0000-000000000002', 79.99),
  ('d0000000-0000-0000-0000-0000000000d1', 'd4000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000005', 'd3000000-0000-0000-0000-000000000003', 80),
  ('d0000000-0000-0000-0000-0000000000d1', 'd4000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000006', 'd3000000-0000-0000-0000-000000000004', 40),
  ('d0000000-0000-0000-0000-0000000000d1', 'd4000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000005', 39.99);

-- Tenants E and F: one exam/one mark each, to exercise unsupported broad codes.
insert into classes (id, tenant_id, name) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', 'E1'),
  ('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000f1', 'F1');
insert into subjects (id, tenant_id, name, code) values
  ('e3000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', 'Maths', 'MAT'),
  ('f3000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000f1', 'Maths', 'MAT');
insert into students (id, tenant_id, admission_no, full_name, class_id) values
  ('e5000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', 'E-001', 'E One', 'e1000000-0000-0000-0000-000000000001'),
  ('f5000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000f1', 'F-001', 'F One', 'f1000000-0000-0000-0000-000000000001');
insert into exams (id, tenant_id, name, term, academic_year, status) values
  ('e4000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000e1', 'E Exam', 'Term 1', 2026, 'published'),
  ('f4000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000f1', 'F Exam', 'Term 1', 2026, 'published');
insert into marks (tenant_id, exam_id, student_id, subject_id, score) values
  ('e0000000-0000-0000-0000-0000000000e1', 'e4000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000001', 85),
  ('f0000000-0000-0000-0000-0000000000f1', 'f4000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 85);
alter table public.marks enable trigger user;

-- ---------------------------------------------------------------------------
-- 1. Inclusive band edges, inactive config, gaps and out-of-range
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d9000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"d0000000-0000-0000-0000-0000000000d1"}',
  true);

do $$
declare
  g record;
begin
  select * into g from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 0);
  if g.code <> 'BE' or g.broad <> 'BE' then raise exception 'FAIL 0: got %/%', g.code, g.broad; end if;

  select * into g from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 29.99);
  if g.code <> 'BE' then raise exception 'FAIL 29.99: expected BE, got %', g.code; end if;

  select * into g from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 30);
  if g.code <> 'AE' then raise exception 'FAIL 30: expected AE, got %', g.code; end if;

  select * into g from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 59.99);
  if g.code <> 'AE' then raise exception 'FAIL 59.99: expected AE, got %', g.code; end if;

  select * into g from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 60);
  if g.code <> 'ME' then raise exception 'FAIL 60: expected ME, got %', g.code; end if;

  select * into g from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 79.99);
  if g.code <> 'ME' then raise exception 'FAIL 79.99: expected ME, got %', g.code; end if;

  select * into g from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 80);
  if g.code <> 'EE' then raise exception 'FAIL 80: expected EE, got %', g.code; end if;

  select * into g from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 100);
  if g.code <> 'EE' then raise exception 'FAIL 100: expected EE, got %', g.code; end if;

  -- The inactive decoy (0-100, code XX) must never win.
  select * into g from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 60);
  if g.code = 'XX' then raise exception 'FAIL inactive config was used'; end if;

  -- Configuration gap: nothing owns 79.99 < score < 80.
  begin
    perform * from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 79.995);
    raise exception 'FAIL gap: 79.995 was accepted';
  exception when others then
    if sqlerrm like 'No grade level matches score%' then null;
    elsif sqlerrm = 'FAIL gap: 79.995 was accepted' then raise;
    else raise exception 'FAIL gap message: %', sqlerrm;
    end if;
  end;

  begin
    perform * from public.get_grade_for_score('d0000000-0000-0000-0000-0000000000d1', 100.01);
    raise exception 'FAIL above-max: 100.01 was accepted';
  exception when others then
    if sqlerrm like 'No grade level matches score%' then null;
    elsif sqlerrm = 'FAIL above-max: 100.01 was accepted' then raise;
    else raise exception 'FAIL above-max message: %', sqlerrm;
    end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. A different tenant with different thresholds (config is the source)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"19000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"10000000-0000-0000-0000-0000000000c1"}',
  true);
do $$
declare
  g record;
begin
  select * into g from public.get_grade_for_score('10000000-0000-0000-0000-0000000000c1', 76);
  if g.code <> 'ME' then raise exception 'FAIL alternate 76: expected ME, got %', g.code; end if;

  select * into g from public.get_grade_for_score('10000000-0000-0000-0000-0000000000c1', 74.99);
  if g.code <> 'AE' then raise exception 'FAIL alternate 74.99: expected AE, got %', g.code; end if;

  select * into g from public.get_grade_for_score('10000000-0000-0000-0000-0000000000c1', 59.99);
  if g.code <> 'BE' then raise exception 'FAIL alternate 59.99: expected BE, got %', g.code; end if;

  select * into g from public.get_grade_for_score('10000000-0000-0000-0000-0000000000c1', 90);
  if g.code <> 'EE' then raise exception 'FAIL alternate 90: expected EE, got %', g.code; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Missing / empty configuration fails clearly
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"19000000-0000-0000-0000-0000000000f2","role":"authenticated","tenant_id":"10000000-0000-0000-0000-0000000000a1"}',
  true);
do $$
begin
  begin
    perform * from public.get_grade_for_score('10000000-0000-0000-0000-0000000000a1', 50);
    raise exception 'FAIL no-config: was accepted';
  exception when others then
    if sqlerrm like 'No active grading configuration found%' then null;
    elsif sqlerrm = 'FAIL no-config: was accepted' then raise;
    else raise exception 'FAIL no-config message: %', sqlerrm;
    end if;
  end;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"19000000-0000-0000-0000-0000000000f3","role":"authenticated","tenant_id":"10000000-0000-0000-0000-0000000000b1"}',
  true);
do $$
begin
  begin
    perform * from public.get_grade_for_score('10000000-0000-0000-0000-0000000000b1', 50);
    raise exception 'FAIL empty-config: was accepted';
  exception when others then
    if sqlerrm like 'Grading configuration % has no levels defined' then null;
    elsif sqlerrm = 'FAIL empty-config: was accepted' then raise;
    else raise exception 'FAIL empty-config message: %', sqlerrm;
    end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Subject performance: denominator, pass mark and broad reconciliation
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"d9000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"d0000000-0000-0000-0000-0000000000d1"}',
  true);
do $$
declare
  s record;
  s2 record;
begin
  select * into s from public.get_subject_performance('d4000000-0000-0000-0000-000000000001');
  if s.total_students <> 4 then
    raise exception 'FAIL total_students: expected 4, got %', s.total_students;
  end if;
  -- (80 + 60 + 20 + 79.99) / 4 = 59.9975 -> 60.00
  if s.mean_score <> 60.00 then
    raise exception 'FAIL mean: expected 60.00, got %', s.mean_score;
  end if;
  if s.highest_score <> 80 or s.lowest_score <> 20 then
    raise exception 'FAIL high/low: got %/%', s.highest_score, s.lowest_score;
  end if;

  -- Unchanged pass rule: >= 40. 80, 60 and 79.99 pass; 20 does not.
  if s.pass_count <> 3 then
    raise exception 'FAIL pass_count: expected 3, got %', s.pass_count;
  end if;
  if s.pass_rate <> 75.00 then
    raise exception 'FAIL pass_rate: expected 75.00, got %', s.pass_rate;
  end if;

  -- Config-driven broad counts: 80 EE, 60 ME, 20 BE, 79.99 ME.
  if s.ee_count <> 1 or s.me_count <> 2 or s.ae_count <> 0 or s.be_count <> 1 then
    raise exception 'FAIL broad counts: EE=% ME=% AE=% BE=%', s.ee_count, s.me_count, s.ae_count, s.be_count;
  end if;
  if s.ee_count + s.me_count + s.ae_count + s.be_count <> s.total_students then
    raise exception 'FAIL broad counts do not reconcile with total_students';
  end if;

  -- Pass mark boundary in a separate exam: 40 passes, 39.99 does not.
  select * into s2 from public.get_subject_performance('d4000000-0000-0000-0000-000000000002')
  where subject_code = 'GEO';
  if s2.pass_count <> 1 or s2.pass_rate <> 100.00 then
    raise exception 'FAIL GEO pass edge: expected 1/100, got %/%', s2.pass_count, s2.pass_rate;
  end if;
  select * into s2 from public.get_subject_performance('d4000000-0000-0000-0000-000000000002')
  where subject_code = 'HIS';
  if s2.pass_count <> 0 or s2.pass_rate <> 0.00 then
    raise exception 'FAIL HIS pass edge: expected 0/0, got %/%', s2.pass_count, s2.pass_rate;
  end if;
  if s2.ae_count <> 1 then
    raise exception 'FAIL HIS broad: 39.99 should be AE, got AE=%', s2.ae_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Grade distribution: denominator and percentages
-- ---------------------------------------------------------------------------
do $$
declare
  total int;
  pct numeric;
begin
  select sum(count), sum(percentage) into total, pct
  from public.get_grade_distribution('d4000000-0000-0000-0000-000000000001');
  if total <> 4 then
    raise exception 'FAIL distribution count sum: expected 4, got %', total;
  end if;
  if pct <> 100.0 then
    raise exception 'FAIL distribution percentages: expected 100.0, got %', pct;
  end if;

  -- Rounding exam: 79.995 -> 80.00 EE, 40 AE, 39.99 AE => 1 EE + 2 AE, total 3.
  if (select sum(count) from public.get_grade_distribution('d4000000-0000-0000-0000-000000000002')) <> 3 then
    raise exception 'FAIL rounding-exam distribution total';
  end if;
  if (select count from public.get_grade_distribution('d4000000-0000-0000-0000-000000000002')
      where grade_code = 'EE') <> 1 then
    raise exception 'FAIL rounding-exam EE count: 80.00 must be EE';
  end if;
  if (select count from public.get_grade_distribution('d4000000-0000-0000-0000-000000000002')
      where grade_code = 'AE') <> 2 then
    raise exception 'FAIL rounding-exam AE count: 40 and 39.99 must be AE';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. get_class_performance keeps two-decimal rounding and grades on it
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  -- 79.99 + 80 = 79.995 -> ROUND(...,2) = 80.00 -> EE.
  select * into r from public.get_class_performance('d4000000-0000-0000-0000-000000000002')
  where admission_no = 'D-005';
  if r.mean_percentage <> 80.00 then
    raise exception 'FAIL rounding: expected 80.00, got %', r.mean_percentage;
  end if;
  if r.overall_grade <> 'EE' then
    raise exception 'FAIL rounding grade: expected EE, got %', r.overall_grade;
  end if;

  -- 79.99 alone stays ME.
  select * into r from public.get_class_performance('d4000000-0000-0000-0000-000000000001')
  where admission_no = 'D-004';
  if r.mean_percentage <> 79.99 or r.overall_grade <> 'ME' then
    raise exception 'FAIL D-004: expected 79.99/ME, got %/%', r.mean_percentage, r.overall_grade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Unsupported and NULL broad codes fail loudly
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"e9000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"e0000000-0000-0000-0000-0000000000e1"}',
  true);
do $$
begin
  begin
    perform * from public.get_subject_performance('e4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL unsupported broad: was accepted';
  exception when others then
    if sqlerrm like 'Subject performance supports broad codes EE, ME, AE and BE, but the active grading configuration resolved a score to XX%' then null;
    elsif sqlerrm = 'FAIL unsupported broad: was accepted' then raise;
    else raise exception 'FAIL unsupported broad message: %', sqlerrm;
    end if;
  end;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"f9000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"f0000000-0000-0000-0000-0000000000f1"}',
  true);
do $$
begin
  begin
    perform * from public.get_subject_performance('f4000000-0000-0000-0000-000000000001');
    raise exception 'FAIL NULL broad: was accepted';
  exception when others then
    if sqlerrm like 'Subject performance supports broad codes EE, ME, AE and BE, but the active grading configuration resolved a score to NULL%' then null;
    elsif sqlerrm = 'FAIL NULL broad: was accepted' then raise;
    else raise exception 'FAIL NULL broad message: %', sqlerrm;
    end if;
  end;
end $$;

reset role;
select 'GRADING BOUNDARY CHECKS PASSED' as result;
rollback;
