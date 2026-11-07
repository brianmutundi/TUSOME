-- Parent preferences RPC isolation (slice 6). Seeds two tenants, runs as the authenticated
-- role, rolls back. Run with ON_ERROR_STOP=1:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parent_preferences.sql
-- Needs migration 20261106000001 and a test-only base schema. Verified on PostgreSQL 16 (scratch DB, base schema + migrations) after slice 6.
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
begin
  insert into public.tenants (id, name) values (a, 'School A'), (b, 'School B');
  insert into auth.users (id) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000a2'),
    ('aaaaaaaa-0000-0000-0000-0000000000f1'), ('bbbbbbbb-0000-0000-0000-0000000000b1');
  insert into public.profiles (id, tenant_id, full_name, role) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1', a, 'Parent A1', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000a2', a, 'Parent A2', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000f1', a, 'Teacher A', 'teacher'),
    ('bbbbbbbb-0000-0000-0000-0000000000b1', b, 'Parent B', 'parent');
end
$seed$;

do $static$
begin
  if has_function_privilege('anon', 'public.get_my_preferences()', 'execute')
     or has_function_privilege('anon', 'public.set_my_preferences(boolean,boolean,boolean,boolean,boolean,boolean)', 'execute') then
    raise exception 'FAIL: anon can execute a preferences RPC';
  end if;
  if has_table_privilege('authenticated', 'public.parent_preferences', 'select')
     or has_table_privilege('anon', 'public.parent_preferences', 'select') then
    raise exception 'FAIL: a client role holds a table grant on parent_preferences';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'parent_preferences' and policyname = 'parent_block') then
    raise exception 'FAIL: parent_block policy missing';
  end if;
end
$static$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $a1$
declare r record;
begin
  select * into r from public.get_my_preferences();
  if not (r.homework_due_tomorrow and r.event_reminders and r.reply_notifications)
     or r.sms_homework_due_tomorrow or r.sms_event_reminders or r.sms_reply_notifications then
    raise exception 'FAIL: defaults wrong (in-app on, SMS off): %', r;
  end if;
  perform public.set_my_preferences(true, false, true, false, true, false);
  select * into r from public.get_my_preferences();
  if r.event_reminders or not r.sms_event_reminders or not r.homework_due_tomorrow then
    raise exception 'FAIL: saved values not returned: %', r;
  end if;
  -- null keeps the stored value
  perform public.set_my_preferences(null, null, false, null, null, null);
  select * into r from public.get_my_preferences();
  if r.reply_notifications or r.event_reminders or not r.sms_event_reminders then
    raise exception 'FAIL: null should keep stored values: %', r;
  end if;
end
$a1$;
select public.t_expect_fail($$select count(*) from public.parent_preferences$$, 'direct table read by a parent');
select public.t_expect_fail($$update public.parent_preferences set event_reminders = true$$, 'direct table write by a parent');
reset role;

-- Another parent in the same school keeps their own defaults.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a2","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $a2$
declare r record;
begin
  select * into r from public.get_my_preferences();
  if not r.event_reminders or r.sms_event_reminders then raise exception 'FAIL: parent A2 sees parent A1 choices: %', r; end if;
end
$a2$;
reset role;

-- Tenant B parent: own defaults; a tenant-A claim with a tenant-B profile is refused.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000b1","tenant_id":"bbbbbbbb-0000-0000-0000-000000000001"}', true);
do $b$
declare r record;
begin
  select * into r from public.get_my_preferences();
  if not r.event_reminders then raise exception 'FAIL: tenant B parent sees tenant A choices'; end if;
end
$b$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000b1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
select public.t_expect_fail($$select * from public.get_my_preferences()$$, 'a parent using another tenant''s claim');
select public.t_expect_fail($$select public.set_my_preferences(true,true,true,true,true,true)$$, 'a parent writing under another tenant''s claim');
reset role;

-- Staff are not parents: the parent preferences are not theirs to read or write.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000f1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
select public.t_expect_fail($$select * from public.get_my_preferences()$$, 'a teacher reading parent preferences');
select public.t_expect_fail($$select public.set_my_preferences(true,true,true,true,true,true)$$, 'a teacher writing parent preferences');
reset role;

rollback;
select 'parent_preferences.sql: all expectations passed' as result;
