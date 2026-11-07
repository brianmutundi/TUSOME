-- Per-message rate limits (slice 7, migration 20261106000003). Run with ON_ERROR_STOP=1:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parent_message_limits.sql
-- Needs migrations up to 20261106000003 and the test-only base schema. Rolls back.
begin;

-- t_expect_msg(sql, like_pattern, label): runs sql; raises FAIL unless it errors with matching text.
create function public.t_expect_msg(p_sql text, p_like text, p_label text) returns void
language plpgsql as $f$
begin
  begin execute p_sql; exception when others then
    if sqlerrm like p_like then return; end if;
    raise exception 'FAIL: % failed with the wrong message: %', p_label, sqlerrm;
  end;
  raise exception 'FAIL: % was allowed', p_label;
end
$f$;
grant execute on function public.t_expect_msg(text, text, text) to authenticated;

do $seed$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  insert into public.tenants (id, name) values (a, 'School A');
  insert into auth.users (id) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000a2'),
    ('aaaaaaaa-0000-0000-0000-0000000000f1');
  insert into public.profiles (id, tenant_id, full_name, role) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1', a, 'Parent A1', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000a2', a, 'Parent A2', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000f1', a, 'Class Teacher', 'teacher');
  insert into public.classes (id, tenant_id, name) values ('aaaaaaaa-0000-0000-0000-0000000000c7', a, 'Grade 7');
  insert into public.students (id, tenant_id, admission_no, full_name, class_id) values
    ('aaaaaaaa-0000-0000-0000-0000000000c1', a, 'A1', 'Kid One', 'aaaaaaaa-0000-0000-0000-0000000000c7'),
    ('aaaaaaaa-0000-0000-0000-0000000000c2', a, 'A2', 'Kid Two', 'aaaaaaaa-0000-0000-0000-0000000000c7');
  insert into public.parent_student_links (tenant_id, parent_id, student_id, can_message_school) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', true),
    (a, 'aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000c2', true);
  insert into public.class_teacher_assignments (tenant_id, class_id, stream_id, teacher_id, academic_year) values
    (a, 'aaaaaaaa-0000-0000-0000-0000000000c7', null, 'aaaaaaaa-0000-0000-0000-0000000000f1', extract(year from (now() at time zone 'Africa/Nairobi'))::integer);
end
$seed$;

-- Parent A1 opens a thread (1 message today).
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $o$
declare r record;
begin
  select * into r from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c1', 'class_teacher', 'Hello', 'First');
  perform set_config('t.th', r.new_thread_id::text, true);
end
$o$;
reset role;

-- Filler as the table owner: 20 parent messages from yesterday (must not count) and 28 from today
-- (with the opener that makes 29 today).
do $fill$
declare t uuid := current_setting('t.th')::uuid;
begin
  insert into public.parent_messages (thread_id, tenant_id, sender_id, sender_kind, body, created_at)
  select t, 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'parent', 'old ' || g,
         ((now() at time zone 'Africa/Nairobi')::date)::timestamp at time zone 'Africa/Nairobi' - interval '2 hours'
  from generate_series(1, 20) g;
  insert into public.parent_messages (thread_id, tenant_id, sender_id, sender_kind, body)
  select t, 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'parent', 'today ' || g
  from generate_series(1, 28) g;
end
$fill$;

-- Parent A1: the 30th message today goes through, the 31st is refused.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $p$
begin
  perform public.send_my_thread_message(current_setting('t.th')::uuid, 'message 30');
end
$p$;
select public.t_expect_msg($$select public.send_my_thread_message(current_setting('t.th')::uuid, 'message 31')$$, 'You have reached today%', 'a parent''s 31st message today');
-- Validation errors still come first and keep their own text.
select public.t_expect_msg($$select public.send_my_thread_message(current_setting('t.th')::uuid, '   ')$$, 'Message is required%', 'a blank message');
reset role;

-- Parent A2 is not affected by A1's count.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a2","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $p2$
declare r record;
begin
  select * into r from public.create_my_thread('aaaaaaaa-0000-0000-0000-0000000000c2', 'class_teacher', 'Hi', 'Hello');
  perform public.send_my_thread_message(r.new_thread_id, 'second message');
end
$p2$;
reset role;

-- Staff: 199 replies today by the class teacher, then the 200th is fine and the 201st is refused.
do $fill2$
begin
  insert into public.parent_messages (thread_id, tenant_id, sender_id, sender_kind, body)
  select current_setting('t.th')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'staff', 'r ' || g
  from generate_series(1, 199) g;
end
$fill2$;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000f1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $s$
begin
  perform public.reply_parent_thread(current_setting('t.th')::uuid, 'reply 200');
end
$s$;
select public.t_expect_msg($$select public.reply_parent_thread(current_setting('t.th')::uuid, 'reply 201')$$, 'You have reached today%', 'a staff member''s 201st reply today');
reset role;

rollback;
select 'parent_message_limits.sql: all expectations passed' as result;
