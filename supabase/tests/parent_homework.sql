-- Homework RPC isolation (slice 4).
-- Seeds two tenants, runs as the RLS-enforcing authenticated role, rolls back.
-- Any failed expectation raises 'FAIL: ...'. Run with ON_ERROR_STOP=1:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parent_homework.sql
-- Needs migration 20261105000009 and a test-only base schema; seeds auth.users rows.
-- public.teacher_has_allocation is defined in no migration: a stand-in (class + subject match
-- in subject_teacher_assignments) is created here only when the database has none.

begin;

do $stub$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'teacher_has_allocation') then
    create function public.teacher_has_allocation(p_user uuid, p_class uuid, p_subject uuid)
    returns boolean language sql stable as
    $f$ select exists (select 1 from public.subject_teacher_assignments a
                       where a.teacher_id = p_user and a.class_id = p_class and a.subject_id = p_subject) $f$;
  end if;
end
$stub$;

-- expect_fail(sql, label): runs sql as the current role; raises FAIL unless it errors.
create function public.t_expect_fail(p_sql text, p_label text) returns void
language plpgsql as $f$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FAIL: % was allowed', p_label;
end
$f$;
grant execute on function public.t_expect_fail(text, text) to authenticated;

-- uuids: tenant a/b; users: pa parent, p2 parent (no academics), pu unlinked parent,
-- pb parent B, ta teacher (Maths 7), tx teacher (no allocation), ad admin A, tb teacher B, bd admin B.
do $seed$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
begin
  insert into public.tenants (id, name) values (a, 'School A'), (b, 'School B');
  insert into auth.users (id) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000a2'),
    ('aaaaaaaa-0000-0000-0000-0000000000a3'), ('aaaaaaaa-0000-0000-0000-0000000000f1'),
    ('aaaaaaaa-0000-0000-0000-0000000000f2'), ('aaaaaaaa-0000-0000-0000-0000000000ad'),
    ('bbbbbbbb-0000-0000-0000-0000000000b1'), ('bbbbbbbb-0000-0000-0000-0000000000f1'),
    ('bbbbbbbb-0000-0000-0000-0000000000bd');
  insert into public.profiles (id, tenant_id, full_name, role) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1', a, 'Parent A', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000a2', a, 'Parent NoAcademics', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000a3', a, 'Parent Unlinked', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000f1', a, 'Teacher Maths', 'teacher'),
    ('aaaaaaaa-0000-0000-0000-0000000000f2', a, 'Teacher Other', 'teacher'),
    ('aaaaaaaa-0000-0000-0000-0000000000ad', a, 'Admin A', 'admin'),
    ('bbbbbbbb-0000-0000-0000-0000000000b1', b, 'Parent B', 'parent'),
    ('bbbbbbbb-0000-0000-0000-0000000000f1', b, 'Teacher B', 'teacher'),
    ('bbbbbbbb-0000-0000-0000-0000000000bd', b, 'Admin B', 'admin');

  insert into public.classes (id, tenant_id, name) values
    ('aaaaaaaa-0000-0000-0000-0000000000c7', a, 'Grade 7'),
    ('aaaaaaaa-0000-0000-0000-0000000000c8', a, 'Grade 8'),
    ('bbbbbbbb-0000-0000-0000-0000000000c7', b, 'Grade 7');
  insert into public.streams (id, tenant_id, class_id, name) values
    ('aaaaaaaa-0000-0000-0000-0000000000e1', a, 'aaaaaaaa-0000-0000-0000-0000000000c7', 'East'),
    ('aaaaaaaa-0000-0000-0000-0000000000e2', a, 'aaaaaaaa-0000-0000-0000-0000000000c7', 'West'),
    ('aaaaaaaa-0000-0000-0000-0000000000e8', a, 'aaaaaaaa-0000-0000-0000-0000000000c8', 'Grade 8 East');
  insert into public.subjects (id, tenant_id, name) values
    ('aaaaaaaa-0000-0000-0000-0000000000d1', a, 'Mathematics'),
    ('aaaaaaaa-0000-0000-0000-0000000000d2', a, 'English'),
    ('bbbbbbbb-0000-0000-0000-0000000000d1', b, 'Mathematics');
  -- c1 East, c2 West (both Grade 7), c3 unlinked Grade 7 East, c8 Grade 8, cb tenant B
  insert into public.students (id, tenant_id, admission_no, full_name, class_id, stream_id) values
    ('aaaaaaaa-0000-0000-0000-0000000000c1', a, 'A1', 'Kid East', 'aaaaaaaa-0000-0000-0000-0000000000c7', 'aaaaaaaa-0000-0000-0000-0000000000e1'),
    ('aaaaaaaa-0000-0000-0000-0000000000c2', a, 'A2', 'Kid West', 'aaaaaaaa-0000-0000-0000-0000000000c7', 'aaaaaaaa-0000-0000-0000-0000000000e2'),
    ('aaaaaaaa-0000-0000-0000-0000000000c3', a, 'A3', 'Kid Unlinked', 'aaaaaaaa-0000-0000-0000-0000000000c7', 'aaaaaaaa-0000-0000-0000-0000000000e1'),
    ('bbbbbbbb-0000-0000-0000-0000000000c1', b, 'B1', 'Kid B', 'bbbbbbbb-0000-0000-0000-0000000000c7', null);
  insert into public.parent_student_links (tenant_id, parent_id, student_id, can_view_academics) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', true),
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c2', true),
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000c3', false),
    (b, 'bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1', true);
  insert into public.subject_teacher_assignments (tenant_id, class_id, subject_id, teacher_id) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000c7', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000f1');
end
$seed$;

do $static$
declare
  fn text;
begin
  foreach fn in array array[
    'public.get_homework_scopes()', 'public.create_homework(uuid,uuid,uuid,text,text,date,boolean)',
    'public.update_homework(uuid,text,text,date,boolean)', 'public.delete_homework(uuid)',
    'public.list_homework(date)', 'public.get_my_child_homework(uuid)',
    'public.set_my_child_homework_done(uuid,uuid,boolean)', 'public.homework_assert_staff(uuid,uuid,uuid)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: anon can execute %', fn;
    end if;
  end loop;
  if has_function_privilege('authenticated', 'public.homework_assert_staff(uuid,uuid,uuid)', 'execute') then
    raise exception 'FAIL: authenticated can execute the internal guard';
  end if;
  if has_table_privilege('authenticated', 'public.homework_assignments', 'select')
     or has_table_privilege('authenticated', 'public.homework_completions', 'select')
     or has_table_privilege('anon', 'public.homework_assignments', 'select') then
    raise exception 'FAIL: a client role holds a table grant on homework';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'homework_assignments' and policyname = 'parent_block')
     or not exists (select 1 from pg_policies where tablename = 'homework_completions' and policyname = 'parent_block') then
    raise exception 'FAIL: parent_block policy missing';
  end if;
  if not ('manage-homework' = any (public.role_permissions_for('aaaaaaaa-0000-0000-0000-000000000001', 'teacher'))) then
    raise exception 'FAIL: teacher default lacks manage-homework';
  end if;
end
$static$;

-- Fixed ids for the items the later steps refer to.
-- (inserted directly as the table owner so old and cross-stream rows can be shaped exactly)
do $rows$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  c7 constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000c7';
  e1 constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000e1';
  m constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000d1';
  t constant date := (now() at time zone 'Africa/Nairobi')::date;
  tch constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000f1';
begin
  insert into public.homework_assignments (id, tenant_id, class_id, stream_id, subject_id, title, due_date, created_by, is_published) values
    ('aaaaaaaa-0000-0000-0000-00000000b001', a, c7, null, m, 'Whole class, published', t + 2, tch, true),
    ('aaaaaaaa-0000-0000-0000-00000000b002', a, c7, e1,   m, 'East only, published',   t + 3, tch, true),
    ('aaaaaaaa-0000-0000-0000-00000000b003', a, c7, null, m, 'Draft',                   t + 2, tch, false),
    ('aaaaaaaa-0000-0000-0000-00000000b004', a, c7, null, m, 'Due 10 days ago',         t - 10, tch, true),
    ('aaaaaaaa-0000-0000-0000-00000000b005', a, c7, null, m, 'Due 20 days ago',         t - 20, tch, true),
    ('aaaaaaaa-0000-0000-0000-00000000b006', a, 'aaaaaaaa-0000-0000-0000-0000000000c8', null, m, 'Other class', t + 2, tch, true);
end
$rows$;

-- ---------------- Parent A (child c1 East, child c2 West) ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $parent$
declare
  v_titles text;
  r record;
begin
  select string_agg(h.title, '|' order by h.due_date) into v_titles
  from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c1') h;
  if v_titles is distinct from 'Due 10 days ago|Whole class, published|East only, published' then
    raise exception 'FAIL: East child sees wrong list: %', v_titles;
  end if;

  select string_agg(h.title, '|' order by h.due_date) into v_titles
  from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c2') h;
  if v_titles is distinct from 'Due 10 days ago|Whole class, published' then
    raise exception 'FAIL: West child sees wrong list (stream filter): %', v_titles;
  end if;

  select * into r from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c1') h where h.title = 'Whole class, published';
  if r.subject_name is distinct from 'Mathematics' or r.teacher_name is distinct from 'Teacher Maths' or r.is_done then
    raise exception 'FAIL: row shape wrong: %', r;
  end if;

  -- tick, then it shows done for c1 but not for c2
  if public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b001', 'aaaaaaaa-0000-0000-0000-0000000000c1', true) is not true then
    raise exception 'FAIL: tick did not return true';
  end if;
  perform public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b001', 'aaaaaaaa-0000-0000-0000-0000000000c1', true); -- idempotent
  if not (select h.is_done from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c1') h where h.title = 'Whole class, published') then
    raise exception 'FAIL: tick not visible';
  end if;
  if (select h.is_done from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c2') h where h.title = 'Whole class, published') then
    raise exception 'FAIL: tick leaked to a sibling';
  end if;
  -- untick
  perform public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b001', 'aaaaaaaa-0000-0000-0000-0000000000c1', false);
  if (select h.is_done from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c1') h where h.title = 'Whole class, published') then
    raise exception 'FAIL: untick did not clear';
  end if;
  perform public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b001', 'aaaaaaaa-0000-0000-0000-0000000000c1', true);
end
$parent$;

select public.t_expect_fail($$select public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b003','aaaaaaaa-0000-0000-0000-0000000000c1',true)$$, 'ticking a draft');
select public.t_expect_fail($$select public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b002','aaaaaaaa-0000-0000-0000-0000000000c2',true)$$, 'ticking another stream''s item');
select public.t_expect_fail($$select public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b005','aaaaaaaa-0000-0000-0000-0000000000c1',true)$$, 'ticking an item outside the 14-day window');
select public.t_expect_fail($$select public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b006','aaaaaaaa-0000-0000-0000-0000000000c1',true)$$, 'ticking another class''s item');
select public.t_expect_fail($$select * from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c3')$$, 'reading an unlinked child (same tenant)');
select public.t_expect_fail($$select * from public.get_my_child_homework('bbbbbbbb-0000-0000-0000-0000000000c1')$$, 'reading another tenant''s child');
select public.t_expect_fail($$select public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b001','aaaaaaaa-0000-0000-0000-0000000000c3',true)$$, 'ticking for an unlinked child');
select public.t_expect_fail($$select count(*) from public.homework_assignments$$, 'direct table read by a parent');
select public.t_expect_fail($$select count(*) from public.homework_completions$$, 'direct completions read by a parent');
select public.t_expect_fail($$insert into public.homework_completions (assignment_id, student_id, tenant_id) values ('aaaaaaaa-0000-0000-0000-00000000b002','aaaaaaaa-0000-0000-0000-0000000000c1','aaaaaaaa-0000-0000-0000-000000000001')$$, 'direct completions insert by a parent');
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000d1', 'x', null, current_date + 1, true)$$, 'parent creating homework');
select public.t_expect_fail($$select * from public.list_homework()$$, 'parent listing staff homework');
select public.t_expect_fail($$select * from public.get_homework_scopes()$$, 'parent reading staff scopes');
select public.t_expect_fail($$select public.update_homework('aaaaaaaa-0000-0000-0000-00000000b001', 'hacked', null, current_date + 5, true)$$, 'parent updating homework');
select public.t_expect_fail($$select public.delete_homework('aaaaaaaa-0000-0000-0000-00000000b001')$$, 'parent deleting homework');
reset role;

-- ---------------- Parent without can_view_academics ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a2","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
select public.t_expect_fail($$select * from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c3')$$, 'can_view_academics=false on read');
select public.t_expect_fail($$select public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b001','aaaaaaaa-0000-0000-0000-0000000000c3',true)$$, 'can_view_academics=false on tick');
reset role;

-- ---------------- Parent B (other tenant) ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000b1","tenant_id":"bbbbbbbb-0000-0000-0000-000000000001"}', true);
select public.t_expect_fail($$select * from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c1')$$, 'tenant B parent reading tenant A child');
do $pb$
begin
  if exists (select 1 from public.get_my_child_homework('bbbbbbbb-0000-0000-0000-0000000000c1')) then
    raise exception 'FAIL: tenant B child sees tenant A homework';
  end if;
end
$pb$;
reset role;

-- ---------------- Teacher with the allocation ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000f1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $teacher$
declare v_n integer;
begin
  select count(*) into v_n from public.get_homework_scopes();
  if v_n <> 1 then raise exception 'FAIL: teacher scopes should be exactly Grade 7 + Mathematics, got %', v_n; end if;
end
$teacher$;
select public.t_expect_fail($$select count(*) from public.homework_assignments$$, 'direct table read by a teacher');
select public.t_expect_fail($$insert into public.homework_assignments (tenant_id, class_id, subject_id, title, due_date) values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-0000000000c8','aaaaaaaa-0000-0000-0000-0000000000d1','bypass',current_date)$$, 'direct table insert by a teacher');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000f1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', 'aaaaaaaa-0000-0000-0000-0000000000e1',
  'aaaaaaaa-0000-0000-0000-0000000000d1', '  Chapter 4 exercise  ', '  Do Q1 to Q10  ',
  (now() at time zone 'Africa/Nairobi')::date + 4, true);
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000d2', 'English', null, current_date + 2, true)$$, 'teacher creating for an unallocated subject');
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c8', null, 'aaaaaaaa-0000-0000-0000-0000000000d1', 'Maths G8', null, current_date + 2, true)$$, 'teacher creating for an unallocated class');
select public.t_expect_fail($$select public.create_homework('bbbbbbbb-0000-0000-0000-0000000000c7', null, 'bbbbbbbb-0000-0000-0000-0000000000d1', 'x', null, current_date + 2, true)$$, 'teacher creating in another tenant');
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', 'aaaaaaaa-0000-0000-0000-0000000000e8', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'wrong stream', null, current_date + 2, true)$$, 'a stream from another class');
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000d1', '   ', null, current_date + 2, true)$$, 'blank title');
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000d1', repeat('x', 121), null, current_date + 2, true)$$, '121-character title');
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000d1', 'late', null, (now() at time zone 'Africa/Nairobi')::date - 1, true)$$, 'due date in the past');
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000d1', 'long', repeat('x', 2001), current_date + 2, true)$$, '2001-character instructions');
do $list$
declare
  v_n integer;
  r record;
begin
  select count(*) into v_n from public.list_homework();
  -- own items only: b001..b006 were created_by this teacher (6) plus the new one
  if v_n <> 7 then raise exception 'FAIL: teacher list should hold 7 own items, got %', v_n; end if;
  select * into r from public.list_homework() l where l.title = 'Chapter 4 exercise';
  if r.instructions is distinct from 'Do Q1 to Q10' or r.stream_name is distinct from 'East' or not r.is_published then
    raise exception 'FAIL: created row not trimmed or wrong: %', r;
  end if;
  select * into r from public.list_homework() l where l.title = 'Whole class, published';
  -- Grade 7 has 3 students (c1, c2, c3); c1 ticked in the parent step
  if r.student_count <> 3 or r.done_count <> 1 then
    raise exception 'FAIL: counts wrong (students %, done %)', r.student_count, r.done_count;
  end if;
  select * into r from public.list_homework() l where l.title = 'East only, published';
  if r.student_count <> 2 or r.done_count <> 0 then
    raise exception 'FAIL: stream counts wrong (students %, done %)', r.student_count, r.done_count;
  end if;
  -- unpublish + edit own
  perform public.update_homework('aaaaaaaa-0000-0000-0000-00000000b001', 'Renamed', null, (now() at time zone 'Africa/Nairobi')::date + 5, false);
  if exists (select 1 from public.list_homework() l where l.assignment_id = 'aaaaaaaa-0000-0000-0000-00000000b001' and (l.title <> 'Renamed' or l.is_published)) then
    raise exception 'FAIL: update did not apply';
  end if;
  -- keep an already-past due date unchanged is allowed
  perform public.update_homework('aaaaaaaa-0000-0000-0000-00000000b005', 'Old but editable', null, (now() at time zone 'Africa/Nairobi')::date - 20, true);
end
$list$;
select public.t_expect_fail($$select public.update_homework('aaaaaaaa-0000-0000-0000-00000000b005', 'moved to past', null, (now() at time zone 'Africa/Nairobi')::date - 3, true)$$, 'moving a due date into the past');
select public.t_expect_fail($$select public.update_homework('00000000-0000-0000-0000-000000000000', 'x', null, current_date + 1, true)$$, 'updating a missing id');
select public.t_expect_fail($$select public.delete_homework('aaaaaaaa-0000-0000-0000-00000000b006')$$, 'teacher deleting in an unallocated class');
select public.delete_homework('aaaaaaaa-0000-0000-0000-00000000b004');
reset role;

do $afterdel$
begin
  if exists (select 1 from public.homework_assignments where id = 'aaaaaaaa-0000-0000-0000-00000000b004') then
    raise exception 'FAIL: delete did not remove the row';
  end if;
  if (select is_published from public.homework_assignments where id = 'aaaaaaaa-0000-0000-0000-00000000b001') then
    raise exception 'FAIL: unpublish was lost';
  end if;
end
$afterdel$;

-- A tick on an unpublished item is invisible to the parent again.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $unpub$
begin
  if exists (select 1 from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c1') h where h.title = 'Renamed') then
    raise exception 'FAIL: unpublished homework still visible to the parent';
  end if;
end
$unpub$;
reset role;

-- ---------------- Teacher without the allocation ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000f2","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $tx$
declare v_n integer;
begin
  select count(*) into v_n from public.get_homework_scopes();
  if v_n <> 0 then raise exception 'FAIL: unallocated teacher has % scopes', v_n; end if;
  select count(*) into v_n from public.list_homework();
  if v_n <> 0 then raise exception 'FAIL: unallocated teacher lists others'' homework (%)', v_n; end if;
end
$tx$;
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000d1', 'x', null, current_date + 2, true)$$, 'unallocated teacher creating');
select public.t_expect_fail($$select public.update_homework('aaaaaaaa-0000-0000-0000-00000000b002', 'x', null, current_date + 2, true)$$, 'unallocated teacher updating a colleague''s item');
select public.t_expect_fail($$select public.delete_homework('aaaaaaaa-0000-0000-0000-00000000b002')$$, 'unallocated teacher deleting a colleague''s item');
select public.t_expect_fail($$select * from public.get_my_child_homework('aaaaaaaa-0000-0000-0000-0000000000c1')$$, 'a teacher using the parent read');
select public.t_expect_fail($$select public.set_my_child_homework_done('aaaaaaaa-0000-0000-0000-00000000b002','aaaaaaaa-0000-0000-0000-0000000000c1',true)$$, 'a teacher using the parent tick');
reset role;

-- ---------------- Admin A: any class and subject, sees everything ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000ad","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $admin$
declare v_n integer;
begin
  select count(*) into v_n from public.get_homework_scopes();
  if v_n <> 4 then raise exception 'FAIL: admin scopes should be 2 classes x 2 subjects, got %', v_n; end if;
  perform public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c8', null, 'aaaaaaaa-0000-0000-0000-0000000000d2',
            'Admin English', null, (now() at time zone 'Africa/Nairobi')::date + 2, false);
  select count(*) into v_n from public.list_homework();
  -- 6 seeded - 1 deleted + teacher's new one + admin's new one
  if v_n <> 7 then raise exception 'FAIL: admin should list 7 items, got %', v_n; end if;
  perform public.update_homework('aaaaaaaa-0000-0000-0000-00000000b002', 'Admin edit', null, (now() at time zone 'Africa/Nairobi')::date + 3, true);
end
$admin$;
reset role;

-- ---------------- Tenant B staff cannot reach tenant A ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000bd","tenant_id":"bbbbbbbb-0000-0000-0000-000000000001"}', true);
select public.t_expect_fail($$select public.update_homework('aaaaaaaa-0000-0000-0000-00000000b002', 'x', null, current_date + 2, true)$$, 'admin B updating tenant A homework');
select public.t_expect_fail($$select public.delete_homework('aaaaaaaa-0000-0000-0000-00000000b002')$$, 'admin B deleting tenant A homework');
select public.t_expect_fail($$select public.create_homework('aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000d1', 'x', null, current_date + 2, true)$$, 'admin B creating in tenant A');
do $bd$
declare v_n integer;
begin
  select count(*) into v_n from public.list_homework();
  if v_n <> 0 then raise exception 'FAIL: admin B lists % tenant A items', v_n; end if;
end
$bd$;
reset role;

-- Deleting an item removes its ticks.
do $cascade$
begin
  delete from public.homework_assignments where id = 'aaaaaaaa-0000-0000-0000-00000000b002';
  if exists (select 1 from public.homework_completions where assignment_id = 'aaaaaaaa-0000-0000-0000-00000000b002') then
    raise exception 'FAIL: completions survived delete';
  end if;
  raise notice 'PARENT_HOMEWORK: ALL PASS';
end
$cascade$;

rollback;
