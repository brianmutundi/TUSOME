-- get_my_phone (slice 7). Run with ON_ERROR_STOP=1:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parent_phone.sql
-- Needs migration 20261106000002 and the test-only base schema. Rolls back.
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
begin
  insert into public.tenants (id, name) values (a, 'School A');
  insert into auth.users (id) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000a2');
  insert into public.profiles (id, tenant_id, full_name, role) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1', a, 'Parent A1', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000a2', a, 'Parent A2', 'parent');
end
$seed$;

do $static$
begin
  if has_function_privilege('anon', 'public.get_my_phone()', 'execute') then
    raise exception 'FAIL: anon can execute get_my_phone';
  end if;
end
$static$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $a1$
begin
  if public.get_my_phone() is not null then raise exception 'FAIL: no number saved should return null'; end if;
  perform public.set_my_phone('0712 345 678');
  if public.get_my_phone() is distinct from public.normalize_ke_phone('0712 345 678') or public.get_my_phone() is null then raise exception 'FAIL: saved number not returned, got %', public.get_my_phone(); end if;
end
$a1$;
reset role;

-- Another parent sees only their own (empty) number.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a2","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $a2$
begin
  if public.get_my_phone() is not null then raise exception 'FAIL: parent A2 sees another parent''s number'; end if;
end
$a2$;
reset role;

-- Not signed in.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select public.t_expect_fail($$select public.get_my_phone()$$, 'get_my_phone without a signed-in user');
reset role;

rollback;
select 'parent_phone.sql: all expectations passed' as result;
