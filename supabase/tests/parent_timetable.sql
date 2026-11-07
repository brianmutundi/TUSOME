-- Parent timetable RPC (slice 2, test added in slice 7).
-- Seeds two tenants, runs as the RLS-enforcing authenticated role, rolls back.
-- Run with ON_ERROR_STOP=1:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parent_timetable.sql
-- Needs migration 20261105000007 and the test-only base schema; seeds auth.users rows.
begin;

create function public.t_expect_fail(p_sql text, p_label text) returns void
language plpgsql as $f$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'FAIL: % was allowed', p_label;
end
$f$;
grant execute on function public.t_expect_fail(text, text) to authenticated;

do $seed$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  c7 constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000c7';
  c8 constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000c8';
  e1 constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000e1';
  e2 constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000e2';
  math constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000d1';
  eng constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000d2';
  teacher constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000f1';
  s_mon1 constant uuid := 'aaaaaaaa-0000-0000-0000-00000000a001';
  s_mon2 constant uuid := 'aaaaaaaa-0000-0000-0000-00000000a002';
  s_tue1 constant uuid := 'aaaaaaaa-0000-0000-0000-00000000a003';
  s_wed1 constant uuid := 'aaaaaaaa-0000-0000-0000-00000000a004';
begin
  insert into public.tenants (id, name) values (a, 'School A'), (b, 'School B');
  insert into auth.users (id) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000a3'),
    ('aaaaaaaa-0000-0000-0000-0000000000f1'), ('bbbbbbbb-0000-0000-0000-0000000000b1');
  insert into public.profiles (id, tenant_id, full_name, role) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1', a, 'Parent A', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000a3', a, 'Parent Unlinked', 'parent'),
    (teacher, a, 'Teacher Maths', 'teacher'),
    ('bbbbbbbb-0000-0000-0000-0000000000b1', b, 'Parent B', 'parent');
  insert into public.classes (id, tenant_id, name) values
    (c7, a, 'Grade 7'), (c8, a, 'Grade 8'), ('bbbbbbbb-0000-0000-0000-0000000000c7', b, 'Grade 7');
  insert into public.streams (id, tenant_id, class_id, name) values
    (e1, a, c7, 'East'), (e2, a, c7, 'West');
  insert into public.subjects (id, tenant_id, name) values
    (math, a, 'Mathematics'), (eng, a, 'English'), ('bbbbbbbb-0000-0000-0000-0000000000d1', b, 'Mathematics');
  -- c1 East, c2 West, c3 linked but placed in no class, c4 not linked to Parent A, cb tenant B
  insert into public.students (id, tenant_id, admission_no, full_name, class_id, stream_id) values
    ('aaaaaaaa-0000-0000-0000-0000000000c1', a, 'A1', 'Kid East', c7, e1),
    ('aaaaaaaa-0000-0000-0000-0000000000c2', a, 'A2', 'Kid West', c7, e2),
    ('aaaaaaaa-0000-0000-0000-0000000000c3', a, 'A3', 'Kid No Class', null, null),
    ('aaaaaaaa-0000-0000-0000-0000000000c4', a, 'A4', 'Kid Unlinked', c7, e1),
    ('bbbbbbbb-0000-0000-0000-0000000000c1', b, 'B1', 'Kid B', 'bbbbbbbb-0000-0000-0000-0000000000c7', null);
  insert into public.parent_student_links (tenant_id, parent_id, student_id, can_view_academics) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', true),
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c2', true),
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c3', true),
    (b, 'bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1', true);

  insert into public.timetable_slots (id, tenant_id, day_of_week, period_number, start_time, end_time, label) values
    (s_mon1, a, 1, 1, '08:00', '08:40', null),
    (s_mon2, a, 1, 2, '08:40', '09:20', null),
    (s_tue1, a, 2, 1, '08:00', '08:40', 'Period 1'),
    (s_wed1, a, 3, 1, '08:00', '08:40', null),
    ('bbbbbbbb-0000-0000-0000-00000000b001', b, 1, 1, '08:00', '08:40', null);
  insert into public.timetable_entries (tenant_id, slot_id, class_id, stream_id, subject_id, teacher_id, room, notes) values
    -- Mon 1: Grade 7 whole class Maths, and a Grade 8 lesson in the same slot (must not show)
    (a, s_mon1, c7, null, math, teacher, 'R1', 'internal note'),
    (a, s_mon1, c8, null, eng, null, 'R9', null),
    -- Mon 2: whole-class Maths AND East-only English: East must get English, West must get Maths
    (a, s_mon2, c7, null, math, teacher, 'R1', null),
    (a, s_mon2, c7, e1, eng, null, 'R2', null),
    -- Tue 1: West only
    (a, s_tue1, c7, e2, eng, null, 'R3', null),
    -- Wed 1: no class at all (must never show)
    (a, s_wed1, null, null, math, null, 'R4', null),
    ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000b001', 'bbbbbbbb-0000-0000-0000-0000000000c7', null, 'bbbbbbbb-0000-0000-0000-0000000000d1', null, 'RB', null);
end
$seed$;

do $static$
begin
  if has_function_privilege('anon', 'public.get_my_child_timetable(uuid)', 'execute') then
    raise exception 'FAIL: anon can execute get_my_child_timetable';
  end if;
end
$static$;

-- ---------------- Parent A ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $pa$
declare
  r record;
  v_n integer;
begin
  -- East child: Mon1 Maths, Mon2 English (stream lesson beats whole class), no Tue lesson
  select count(*) into v_n from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c1');
  if v_n <> 2 then raise exception 'FAIL: East child should have 2 lessons, got %', v_n; end if;
  select * into r from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c1') order by day_of_week, period_number limit 1;
  if r.subject_name <> 'Mathematics' or r.day_of_week <> 1 or r.period_number <> 1 or r.room <> 'R1'
     or r.teacher_name <> 'Teacher Maths' or r.start_time <> '08:00' or r.end_time <> '08:40' then
    raise exception 'FAIL: East Mon 1 wrong: %', r;
  end if;
  select * into r from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c1') where period_number = 2;
  if r.subject_name <> 'English' or r.room <> 'R2' then raise exception 'FAIL: East Mon 2 should be the stream lesson: %', r; end if;
  if exists (select 1 from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c1') where subject_name = 'English' and room = 'R9') then
    raise exception 'FAIL: Grade 8 lesson leaked to a Grade 7 child';
  end if;

  -- West child: Mon1 Maths, Mon2 Maths (whole class), Tue1 English (stream lesson, label kept)
  select count(*) into v_n from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c2');
  if v_n <> 3 then raise exception 'FAIL: West child should have 3 lessons, got %', v_n; end if;
  select * into r from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c2') where period_number = 2;
  if r.subject_name <> 'Mathematics' then raise exception 'FAIL: West Mon 2 should be whole-class Maths: %', r; end if;
  select * into r from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c2') where day_of_week = 2;
  if r.subject_name <> 'English' or r.slot_label <> 'Period 1' then raise exception 'FAIL: West Tue lesson wrong: %', r; end if;

  -- Ordered by day then period
  if (select array_agg(day_of_week * 10 + period_number order by ordinality)
        from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c2') with ordinality) <> array[11, 12, 21] then
    raise exception 'FAIL: timetable not ordered by day then period';
  end if;

  -- Wed lesson has no class: nobody sees it
  if exists (select 1 from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c1') where day_of_week = 3)
     or exists (select 1 from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c2') where day_of_week = 3) then
    raise exception 'FAIL: a lesson with no class was returned';
  end if;

  -- Linked child with no class: empty, not an error
  select count(*) into v_n from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c3');
  if v_n <> 0 then raise exception 'FAIL: child with no class should have no lessons, got %', v_n; end if;
end
$pa$;
-- Internal columns are not part of the result.
do $cols$
begin
  if exists (
    select 1 from pg_proc p, unnest(p.proargnames) n
    where p.proname = 'get_my_child_timetable' and n in ('notes', 'teacher_id', 'class_id', 'stream_id')
  ) then raise exception 'FAIL: an internal column is returned'; end if;
end
$cols$;
select public.t_expect_fail($$select * from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c4')$$, 'a child not linked to this parent');
select public.t_expect_fail($$select * from public.get_my_child_timetable('bbbbbbbb-0000-0000-0000-0000000000c1')$$, 'another tenant''s child');
reset role;

-- ---------------- Parent without a link to anything ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a3","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
select public.t_expect_fail($$select * from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c1')$$, 'an unlinked parent');
reset role;

-- ---------------- Teacher is not a parent ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000f1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
select public.t_expect_fail($$select * from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c1')$$, 'a teacher using the parent timetable');
reset role;

-- ---------------- Parent B (other tenant) ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000b1","tenant_id":"bbbbbbbb-0000-0000-0000-000000000001"}', true);
do $pb$
declare v_n integer;
begin
  select count(*) into v_n from public.get_my_child_timetable('bbbbbbbb-0000-0000-0000-0000000000c1');
  if v_n <> 1 then raise exception 'FAIL: tenant B child should see its own 1 lesson, got %', v_n; end if;
end
$pb$;
select public.t_expect_fail($$select * from public.get_my_child_timetable('aaaaaaaa-0000-0000-0000-0000000000c1')$$, 'tenant B parent reading a tenant A child');
reset role;

rollback;
select 'parent_timetable.sql: all expectations passed' as result;
