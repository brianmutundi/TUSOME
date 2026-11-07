-- Deputy principals and parent messages (slice 7, migration 20261106000004). Run with ON_ERROR_STOP=1:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parent_deputy_messages.sql
-- Needs migrations up to 20261106000004 and the test-only base schema. Rolls back.
begin;

create function public.t_expect_fail(p_sql text, p_label text) returns void
language plpgsql as $f$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'FAIL: % was allowed', p_label;
end
$f$;
grant execute on function public.t_expect_fail(text, text) to authenticated;

-- users: pa parent; ct class teacher of Grade 7; dp deputy principal (primary role, written the way
-- the UI may store it); dj teacher with a junction deputy role; tx plain teacher; db deputy of school B.
do $seed$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
begin
  insert into public.tenants (id, name) values (a, 'School A'), (b, 'School B');
  insert into auth.users (id) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000f1'),
    ('aaaaaaaa-0000-0000-0000-0000000000d1'), ('aaaaaaaa-0000-0000-0000-0000000000d2'),
    ('aaaaaaaa-0000-0000-0000-0000000000f2'), ('bbbbbbbb-0000-0000-0000-0000000000d1');
  insert into public.profiles (id, tenant_id, full_name, role) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1', a, 'Parent A', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000f1', a, 'Class Teacher', 'teacher'),
    ('aaaaaaaa-0000-0000-0000-0000000000d1', a, 'Deputy Primary', 'Deputy_Principal'),
    ('aaaaaaaa-0000-0000-0000-0000000000d2', a, 'Deputy Junction', 'teacher'),
    ('aaaaaaaa-0000-0000-0000-0000000000f2', a, 'Other Teacher', 'teacher'),
    ('bbbbbbbb-0000-0000-0000-0000000000d1', b, 'Deputy B', 'deputy principal');
  insert into public.user_roles (tenant_id, user_id, role_key) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000d2', 'deputy_principal');
  insert into public.classes (id, tenant_id, name) values ('aaaaaaaa-0000-0000-0000-0000000000c7', a, 'Grade 7');
  insert into public.students (id, tenant_id, admission_no, full_name, class_id) values
    ('aaaaaaaa-0000-0000-0000-0000000000c1', a, 'A1', 'Kid One', 'aaaaaaaa-0000-0000-0000-0000000000c7');
  insert into public.parent_student_links (tenant_id, parent_id, student_id, can_message_school) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', true);
  insert into public.class_teacher_assignments (tenant_id, class_id, stream_id, teacher_id, academic_year) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000f1', extract(year from (now() at time zone 'Africa/Nairobi'))::integer);
end
$seed$;

do $static$
begin
  if not ('reply-parent-messages' = any (public.role_permissions_for('aaaaaaaa-0000-0000-0000-000000000001', 'deputy principal'))) then
    raise exception 'FAIL: the deputy principal default lacks reply-parent-messages';
  end if;
end
$static$;

-- Parent opens one thread to each audience.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $p$
declare r record;
begin
  select * into r from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1', 'class_teacher', 'To teacher', 'Hello teacher');
  perform set_config('t.ct', r.new_thread_id::text, true);
  select * into r from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1', 'bursar', 'To bursar', 'Hello bursar');
  perform set_config('t.bu', r.new_thread_id::text, true);
  select * into r from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1', 'admin', 'To office', 'Hello office');
  perform set_config('t.ad', r.new_thread_id::text, true);
end
$p$;
reset role;

-- Deputy (primary role) and deputy (junction role) each see all three threads and may reply and close.
do $both$
declare
  who text;
begin
  foreach who in array array['aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d2'] loop
    perform set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', who), true);
    set local role authenticated;
    if (select count(*) from public.list_parent_threads()) <> 3 then
      raise exception 'FAIL: deputy % should see all 3 threads, got %', who, (select count(*) from public.list_parent_threads());
    end if;
    if (select count(*) from public.get_parent_thread_messages(current_setting('t.bu')::uuid)) <> 1 then
      raise exception 'FAIL: deputy % cannot read the bursar thread', who;
    end if;
    perform public.reply_parent_thread(current_setting('t.ad')::uuid, 'Reply from deputy ' || who);
    reset role;
  end loop;
end
$both$;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000d1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $c$
begin
  perform public.close_parent_thread(current_setting('t.bu')::uuid);
  perform public.set_parent_thread_flag(current_setting('t.ct')::uuid, true);
end
$c$;
reset role;

-- A plain teacher who is not the class teacher still sees nothing.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000f2","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $t$
begin
  if exists (select 1 from public.list_parent_threads()) then raise exception 'FAIL: a plain teacher sees threads'; end if;
end
$t$;
select public.t_expect_fail($$select * from public.get_parent_thread_messages(current_setting('t.ad')::uuid)$$, 'a plain teacher reading an office thread');
reset role;

-- A deputy of another school sees nothing of school A.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000d1","tenant_id":"bbbbbbbb-0000-0000-0000-000000000001"}', true);
do $b$
begin
  if exists (select 1 from public.list_parent_threads()) then raise exception 'FAIL: tenant B deputy sees tenant A threads'; end if;
end
$b$;
select public.t_expect_fail($$select * from public.get_parent_thread_messages(current_setting('t.ad')::uuid)$$, 'tenant B deputy reading a tenant A thread');
select public.t_expect_fail($$select public.reply_parent_thread(current_setting('t.ad')::uuid, 'x')$$, 'tenant B deputy replying in tenant A');
reset role;

-- A deputy cannot use the parent side.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000d1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $own$
begin
  -- The parent list is "my own threads": a deputy has none, and the school's threads do not leak into it.
  if exists (select 1 from public.get_my_threads()) then raise exception 'FAIL: the parent thread list showed a deputy other people''s threads'; end if;
end
$own$;
select public.t_expect_fail($$select * from public.get_my_thread_messages(current_setting('t.ad')::uuid)$$, 'a deputy using the parent message read');
reset role;

rollback;
select 'parent_deputy_messages.sql: all expectations passed' as result;
