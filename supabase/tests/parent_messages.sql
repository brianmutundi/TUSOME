-- Parent messages RPC isolation and routing (slice 5).
-- Seeds two tenants, runs as the RLS-enforcing authenticated role, rolls back.
-- Any failed expectation raises 'FAIL: ...'. Run with ON_ERROR_STOP=1:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parent_messages.sql
-- Needs migrations up to 20261105000010 and a test-only base schema; seeds auth.users rows.
-- Verified on PostgreSQL 16 (scratch DB: local base schema + migrations, rls_auto_enable stubbed).

begin;

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

-- users: pa parent (children c1 East, c8 Grade 8), p2 parent (messaging off), pb parent B,
-- ft class teacher of Grade 7, tx other teacher, bu bursar, ad admin A, bd admin B, tb teacher B.
do $seed$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
begin
  insert into public.tenants (id, name) values (a, 'School A'), (b, 'School B');
  insert into auth.users (id) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000a2'),
    ('aaaaaaaa-0000-0000-0000-0000000000f1'), ('aaaaaaaa-0000-0000-0000-0000000000f2'),
    ('aaaaaaaa-0000-0000-0000-0000000000b0'), ('aaaaaaaa-0000-0000-0000-0000000000ad'),
    ('bbbbbbbb-0000-0000-0000-0000000000b1'), ('bbbbbbbb-0000-0000-0000-0000000000bd'),
    ('bbbbbbbb-0000-0000-0000-0000000000f1');
  insert into public.profiles (id, tenant_id, full_name, role) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1', a, 'Parent A', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000a2', a, 'Parent NoMsg', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000f1', a, 'Class Teacher', 'teacher'),
    ('aaaaaaaa-0000-0000-0000-0000000000f2', a, 'Other Teacher', 'teacher'),
    ('aaaaaaaa-0000-0000-0000-0000000000b0', a, 'Bursar A', 'bursar'),
    ('aaaaaaaa-0000-0000-0000-0000000000ad', a, 'Admin A', 'admin'),
    ('bbbbbbbb-0000-0000-0000-0000000000b1', b, 'Parent B', 'parent'),
    ('bbbbbbbb-0000-0000-0000-0000000000bd', b, 'Admin B', 'admin'),
    ('bbbbbbbb-0000-0000-0000-0000000000f1', b, 'Teacher B', 'teacher');
  insert into public.classes (id, tenant_id, name) values
    ('aaaaaaaa-0000-0000-0000-0000000000c7', a, 'Grade 7'),
    ('aaaaaaaa-0000-0000-0000-0000000000c8', a, 'Grade 8'),
    ('bbbbbbbb-0000-0000-0000-0000000000c7', b, 'Grade 7');
  insert into public.streams (id, tenant_id, class_id, name) values
    ('aaaaaaaa-0000-0000-0000-0000000000e1', a, 'aaaaaaaa-0000-0000-0000-0000000000c7', 'East');
  insert into public.students (id, tenant_id, admission_no, full_name, class_id, stream_id) values
    ('aaaaaaaa-0000-0000-0000-0000000000c1', a, 'A1', 'Kid East', 'aaaaaaaa-0000-0000-0000-0000000000c7', 'aaaaaaaa-0000-0000-0000-0000000000e1'),
    ('aaaaaaaa-0000-0000-0000-0000000000c3', a, 'A3', 'Kid NoMsg', 'aaaaaaaa-0000-0000-0000-0000000000c7', null),
    ('aaaaaaaa-0000-0000-0000-0000000000c8', a, 'A8', 'Kid Grade 8', 'aaaaaaaa-0000-0000-0000-0000000000c8', null),
    ('bbbbbbbb-0000-0000-0000-0000000000c1', b, 'B1', 'Kid B', 'bbbbbbbb-0000-0000-0000-0000000000c7', null);
  insert into public.parent_student_links (tenant_id, parent_id, student_id, can_message_school) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', true),
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c8', true),
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000c3', false),
    (b, 'bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1', true);
  -- Class teacher of all of Grade 7; Grade 8 has none.
  insert into public.class_teacher_assignments (tenant_id, class_id, stream_id, teacher_id, academic_year) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000f1', extract(year from (now() at time zone 'Africa/Nairobi'))::integer);
end
$seed$;

do $static$
declare
  fn text;
begin
  foreach fn in array array[
    'public.get_my_message_options()', 'public.get_my_threads()', 'public.get_my_thread_messages(uuid)',
    'public.create_my_thread(uuid,text,text,text)', 'public.send_my_thread_message(uuid,text)',
    'public.reopen_my_thread(uuid)', 'public.mark_my_thread_read(uuid,timestamptz)',
    'public.list_parent_threads(text)', 'public.get_parent_thread_messages(uuid)',
    'public.reply_parent_thread(uuid,text)', 'public.close_parent_thread(uuid)',
    'public.set_parent_thread_flag(uuid,boolean)', 'public.mark_parent_thread_read_staff(uuid,timestamptz)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: anon can execute %', fn;
    end if;
  end loop;
  foreach fn in array array[
    'public.parent_msg_assert_staff(uuid)', 'public.parent_msg_class_teachers(uuid,uuid,uuid)',
    'public.parent_msg_is_admin_level(uuid)', 'public.parent_msg_is_bursar(uuid)',
    'public.parent_msg_staff_can_see(uuid,text,uuid)'
  ] loop
    if has_function_privilege('authenticated', fn, 'execute') or has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: a client role can execute internal helper %', fn;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.parent_threads', 'select')
     or has_table_privilege('authenticated', 'public.parent_messages', 'select')
     or has_table_privilege('anon', 'public.parent_threads', 'select') then
    raise exception 'FAIL: a client role holds a table grant on the message tables';
  end if;
  if (select count(*) from pg_policies where tablename in ('parent_threads', 'parent_messages') and policyname = 'parent_block') <> 2 then
    raise exception 'FAIL: parent_block policy missing';
  end if;
  if not ('reply-parent-messages' = any (public.role_permissions_for('aaaaaaaa-0000-0000-0000-000000000001', 'teacher')))
     or not ('reply-parent-messages' = any (public.role_permissions_for('aaaaaaaa-0000-0000-0000-000000000001', 'bursar'))) then
    raise exception 'FAIL: teacher or bursar default lacks reply-parent-messages';
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
  select count(*) into v_n from public.get_my_message_options();
  if v_n <> 2 then raise exception 'FAIL: options should hold 2 children, got %', v_n; end if;
  select * into r from public.get_my_message_options() o where o.student_id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  if r.can_message_school is not true or r.class_teacher_name is distinct from 'Class Teacher' then
    raise exception 'FAIL: option row for Grade 7 child wrong: %', r;
  end if;
  select * into r from public.get_my_message_options() o where o.student_id = 'aaaaaaaa-0000-0000-0000-0000000000c8';
  if r.class_teacher_name is not null then raise exception 'FAIL: Grade 8 should have no class teacher: %', r; end if;

  -- class_teacher stays class_teacher for Grade 7; falls back to admin for Grade 8; bursar stays bursar
  select * into r from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1', 'class_teacher', '  Missed lessons  ', '  Amina was away  ');
  if r.routed_audience <> 'class_teacher' then raise exception 'FAIL: Grade 7 routed to %', r.routed_audience; end if;
  perform set_config('t.ct', r.new_thread_id::text, true);
  select * into r from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c8', 'class_teacher', 'Grade 8 matter', 'Hello');
  if r.routed_audience <> 'admin' then raise exception 'FAIL: Grade 8 should fall back to admin, got %', r.routed_audience; end if;
  perform set_config('t.ad', r.new_thread_id::text, true);
  select * into r from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1', 'bursar', 'Fee statement', 'Please send one');
  if r.routed_audience <> 'bursar' then raise exception 'FAIL: bursar routed to %', r.routed_audience; end if;
  perform set_config('t.bu', r.new_thread_id::text, true);

  select * into r from public.get_my_threads() t where t.thread_id = current_setting('t.ct')::uuid;
  if r.subject <> 'Missed lessons' or r.student_name <> 'Kid East' or r.is_unread or r.last_sender_kind <> 'parent' or r.last_message_preview <> 'Amina was away' then
    raise exception 'FAIL: thread row wrong or not trimmed: %', r;
  end if;
  select count(*) into v_n from public.get_my_threads();
  if v_n <> 3 then raise exception 'FAIL: parent should see 3 threads, got %', v_n; end if;
end
$pa$;
select public.t_expect_fail($$select * from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1','nobody','s','b')$$, 'unknown audience');
select public.t_expect_fail($$select * from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1','bursar','   ','b')$$, 'blank subject');
select public.t_expect_fail($$select * from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1','bursar',repeat('x',121),'b')$$, '121-character subject');
select public.t_expect_fail($$select * from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1','bursar','s','   ')$$, 'blank body');
select public.t_expect_fail($$select * from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1','bursar','s',repeat('x',1001))$$, '1001-character body');
select public.t_expect_fail($$select * from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c3','bursar','s','b')$$, 'unlinked child in the same tenant');
select public.t_expect_fail($$select * from public.create_my_thread('bbbbbbbb-0000-0000-0000-0000000000c1','bursar','s','b')$$, 'another tenant''s child');
select public.t_expect_fail($$select count(*) from public.parent_threads$$, 'direct thread read by a parent');
select public.t_expect_fail($$select count(*) from public.parent_messages$$, 'direct message read by a parent');
select public.t_expect_fail($$insert into public.parent_messages (thread_id, tenant_id, sender_kind, body) values (current_setting('t.ct')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'staff', 'forged')$$, 'direct message insert by a parent');
select public.t_expect_fail($$select * from public.list_parent_threads()$$, 'parent using the staff inbox list');
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.ct')::uuid, 'x')$$, 'parent using the staff reply');
select public.t_expect_fail($$select public.close_parent_thread(current_setting('t.ct')::uuid)$$, 'parent closing a thread');
select public.t_expect_fail($$select * from public.get_parent_thread_messages(current_setting('t.ct')::uuid)$$, 'parent using the staff message read');

-- Daily limit: 3 created so far, 7 more fit, the 11th fails.
do $limit$
begin
  for i in 1..7 loop
    perform public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1', 'admin', 'Filler ' || i, 'x');
  end loop;
end
$limit$;
select public.t_expect_fail($$select * from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1','admin','11th','x')$$, 'the 11th new thread of the day');
-- Replying in an existing thread is not limited by it.
select public.send_my_thread_message(current_setting('t.ct')::uuid, '  Second note  ');
select public.t_expect_fail($$select public.send_my_thread_message(current_setting('t.ct')::uuid, '   ')$$, 'blank reply');
select public.t_expect_fail($$select public.send_my_thread_message(current_setting('t.ct')::uuid, repeat('x', 1001))$$, '1001-character reply');
reset role;

-- ---------------- Parent without can_message_school ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a2","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $p2$
begin
  if exists (select 1 from public.get_my_message_options() o where o.can_message_school) then
    raise exception 'FAIL: parent with messaging off is offered messaging';
  end if;
  if exists (select 1 from public.get_my_threads()) then
    raise exception 'FAIL: parent with messaging off sees threads';
  end if;
end
$p2$;
select public.t_expect_fail($$select * from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c3','bursar','s','b')$$, 'create with can_message_school=false');
select public.t_expect_fail($$select * from public.get_my_thread_messages(current_setting('t.ct')::uuid)$$, 'reading another parent''s thread');
select public.t_expect_fail($$select public.send_my_thread_message(current_setting('t.ct')::uuid, 'x')$$, 'replying in another parent''s thread');
select public.t_expect_fail($$select public.mark_my_thread_read(current_setting('t.ct')::uuid, null)$$, 'marking another parent''s thread read');
select public.t_expect_fail($$select public.reopen_my_thread(current_setting('t.ct')::uuid)$$, 'reopening another parent''s thread');
reset role;

-- ---------------- Parent B (other tenant) ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000b1","tenant_id":"bbbbbbbb-0000-0000-0000-000000000001"}', true);
do $pb$
begin
  if exists (select 1 from public.get_my_threads()) then raise exception 'FAIL: tenant B parent sees tenant A threads'; end if;
end
$pb$;
select public.t_expect_fail($$select * from public.get_my_thread_messages(current_setting('t.ct')::uuid)$$, 'tenant B reading tenant A thread');
select public.t_expect_fail($$select public.send_my_thread_message(current_setting('t.ct')::uuid, 'x')$$, 'tenant B replying in tenant A thread');
reset role;

-- Everything above runs in one transaction, so every message shares one now() and the
-- "latest message" tie-break falls to a random uuid. Back-date the parent messages so the
-- staff reply sent below is strictly the newest (as it is in production, where each insert
-- is its own transaction).
update public.parent_messages set created_at = now() - interval '2 hours' where sender_kind = 'parent';

-- ---------------- Class teacher ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000f1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $ft$
declare
  r record;
  v_n integer;
begin
  select count(*) into v_n from public.list_parent_threads();
  if v_n <> 1 then raise exception 'FAIL: class teacher should see exactly the Grade 7 class-teacher thread, got %', v_n; end if;
  select * into r from public.list_parent_threads();
  if r.thread_id <> current_setting('t.ct')::uuid or r.parent_name <> 'Parent A' or r.student_name <> 'Kid East' or r.class_name <> 'Grade 7' or not r.is_unread or r.audience <> 'class_teacher' then
    raise exception 'FAIL: inbox row wrong: %', r;
  end if;
  select count(*) into v_n from public.get_parent_thread_messages(current_setting('t.ct')::uuid);
  if v_n <> 2 then raise exception 'FAIL: expected 2 messages, got %', v_n; end if;
  perform public.mark_parent_thread_read_staff(current_setting('t.ct')::uuid, (select max(m.created_at) from public.get_parent_thread_messages(current_setting('t.ct')::uuid) m));
  if (select l.is_unread from public.list_parent_threads() l) then raise exception 'FAIL: staff read mark did not clear unread'; end if;
  perform public.reply_parent_thread(current_setting('t.ct')::uuid, '  We will follow up  ');
  perform public.set_parent_thread_flag(current_setting('t.ct')::uuid, true);
  if not (select l.flagged from public.list_parent_threads() l) then raise exception 'FAIL: flag not set'; end if;
  if (select l.last_sender_kind from public.list_parent_threads() l) <> 'staff' then raise exception 'FAIL: last sender should be staff'; end if;
end
$ft$;
select public.t_expect_fail($$select * from public.get_parent_thread_messages(current_setting('t.bu')::uuid)$$, 'class teacher reading a bursar thread');
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.bu')::uuid, 'x')$$, 'class teacher replying to a bursar thread');
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.ad')::uuid, 'x')$$, 'class teacher replying to an office thread');
select public.t_expect_fail($$select public.close_parent_thread(current_setting('t.ad')::uuid)$$, 'class teacher closing an office thread');
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.ct')::uuid, repeat('x', 1001))$$, 'oversized staff reply');
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.ct')::uuid, '  ')$$, 'blank staff reply');
select public.t_expect_fail($$select count(*) from public.parent_threads$$, 'direct thread read by a teacher');
select public.t_expect_fail($$select * from public.list_parent_threads('archived')$$, 'invalid status filter');
reset role;

-- ---------------- Other teacher (not the class teacher) ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000f2","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $tx$
begin
  if exists (select 1 from public.list_parent_threads()) then raise exception 'FAIL: a teacher who is not the class teacher sees threads'; end if;
end
$tx$;
select public.t_expect_fail($$select * from public.get_parent_thread_messages(current_setting('t.ct')::uuid)$$, 'other teacher reading the thread');
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.ct')::uuid, 'x')$$, 'other teacher replying');
reset role;

-- ---------------- Bursar ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000b0","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $bu$
declare v_n integer;
begin
  select count(*) into v_n from public.list_parent_threads();
  if v_n <> 1 or (select l.audience from public.list_parent_threads() l) <> 'bursar' then
    raise exception 'FAIL: bursar should see exactly the bursar thread, got % rows', v_n;
  end if;
  perform public.reply_parent_thread(current_setting('t.bu')::uuid, 'Statement attached in the portal');
end
$bu$;
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.ct')::uuid, 'x')$$, 'bursar replying to a class-teacher thread');
reset role;

-- ---------------- Admin A sees all; closes the office thread ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000ad","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $ad$
declare v_n integer;
begin
  select count(*) into v_n from public.list_parent_threads();
  if v_n <> 10 then raise exception 'FAIL: admin should see all 10 threads, got %', v_n; end if;
  select count(*) into v_n from public.list_parent_threads('closed');
  if v_n <> 0 then raise exception 'FAIL: nothing is closed yet'; end if;
  perform public.reply_parent_thread(current_setting('t.ad')::uuid, 'The office will call you');
  perform public.close_parent_thread(current_setting('t.ad')::uuid);
  perform public.close_parent_thread(current_setting('t.ad')::uuid); -- idempotent
  select count(*) into v_n from public.list_parent_threads('closed');
  if v_n <> 1 then raise exception 'FAIL: expected 1 closed thread, got %', v_n; end if;
end
$ad$;
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.ad')::uuid, 'after close')$$, 'staff reply to a closed thread');
reset role;

-- ---------------- Tenant B staff ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000bd","tenant_id":"bbbbbbbb-0000-0000-0000-000000000001"}', true);
do $bd$
begin
  if exists (select 1 from public.list_parent_threads()) then raise exception 'FAIL: tenant B admin sees tenant A threads'; end if;
end
$bd$;
select public.t_expect_fail($$select * from public.get_parent_thread_messages(current_setting('t.ct')::uuid)$$, 'tenant B admin reading tenant A thread');
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.ct')::uuid, 'x')$$, 'tenant B admin replying in tenant A');
select public.t_expect_fail($$select public.close_parent_thread(current_setting('t.ct')::uuid)$$, 'tenant B admin closing tenant A thread');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000f1","tenant_id":"bbbbbbbb-0000-0000-0000-000000000001"}', true);
select public.t_expect_fail($$select * from public.get_parent_thread_messages(current_setting('t.ct')::uuid)$$, 'tenant B teacher reading tenant A thread');
reset role;

-- Every row above was written inside this one transaction, so they all share now(). Space the
-- messages out as the table owner so the read-mark comparisons below mean something.
update public.parent_messages set created_at = now() - interval '2 hours' where sender_kind = 'parent';
update public.parent_messages set created_at = now() - interval '1 hour' where sender_kind = 'staff';

-- ---------------- Parent A again: unread, read marks, closed thread, reopen ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $pa2$
declare
  r record;
  v_seen timestamptz;
begin
  select * into r from public.get_my_threads() t where t.thread_id = current_setting('t.ct')::uuid;
  if not r.is_unread or r.last_sender_kind <> 'staff' then raise exception 'FAIL: staff reply should show as unread: %', r; end if;
  -- reading up to an older message leaves the newer reply unread
  select min(m.created_at) into v_seen from public.get_my_thread_messages(current_setting('t.ct')::uuid) m;
  perform public.mark_my_thread_read(current_setting('t.ct')::uuid, v_seen);
  if not (select t.is_unread from public.get_my_threads() t where t.thread_id = current_setting('t.ct')::uuid) then
    raise exception 'FAIL: marking an old message read cleared a newer reply';
  end if;
  perform public.mark_my_thread_read(current_setting('t.ct')::uuid, null);
  if (select t.is_unread from public.get_my_threads() t where t.thread_id = current_setting('t.ct')::uuid) then
    raise exception 'FAIL: mark read did not clear unread';
  end if;
  -- staff names are shown to the parent
  if not exists (select 1 from public.get_my_thread_messages(current_setting('t.ct')::uuid) m where m.sender_kind = 'staff' and m.sender_name = 'Class Teacher' and m.body = 'We will follow up') then
    raise exception 'FAIL: staff reply missing or untrimmed';
  end if;

  -- the closed office thread: reply refused, reopen allowed within 14 days
  select * into r from public.get_my_threads() t where t.thread_id = current_setting('t.ad')::uuid;
  if r.status <> 'closed' or not r.can_reopen then raise exception 'FAIL: closed thread row wrong: %', r; end if;
  perform public.reopen_my_thread(current_setting('t.ad')::uuid);
  perform public.reopen_my_thread(current_setting('t.ad')::uuid); -- idempotent
  perform public.send_my_thread_message(current_setting('t.ad')::uuid, 'Thank you');
end
$pa2$;
reset role;

-- A thread closed more than 14 days ago cannot be reopened (shape it as the table owner).
update public.parent_threads set status = 'closed', closed_at = now() - interval '20 days'
where id = current_setting('t.bu')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
select public.t_expect_fail($$select public.reopen_my_thread(current_setting('t.bu')::uuid)$$, 'reopening after 14 days');
select public.t_expect_fail($$select public.send_my_thread_message(current_setting('t.bu')::uuid, 'x')$$, 'replying in a closed thread');
do $old$
begin
  if (select t.can_reopen from public.get_my_threads() t where t.thread_id = current_setting('t.bu')::uuid) then
    raise exception 'FAIL: can_reopen true after 14 days';
  end if;
end
$old$;
reset role;

-- A revoked link hides the thread from the parent but not from staff.
update public.parent_student_links set revoked_at = now()
where parent_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and student_id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $rev$
begin
  if exists (select 1 from public.get_my_threads() t where t.student_id = 'aaaaaaaa-0000-0000-0000-0000000000c1') then
    raise exception 'FAIL: thread of a revoked link still visible to the parent';
  end if;
end
$rev$;
select public.t_expect_fail($$select * from public.get_my_thread_messages(current_setting('t.ct')::uuid)$$, 'reading a thread after the link was revoked');
reset role;

rollback;
select 'parent_messages.sql: all expectations passed' as result;
