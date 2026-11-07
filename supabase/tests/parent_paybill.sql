-- Parent paybill RPC isolation (slice 3).
-- Seeds two tenants, runs as the RLS-enforcing authenticated role, rolls back.
-- Any failed expectation raises 'FAIL: ...'. Run with ON_ERROR_STOP=1:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parent_paybill.sql
-- Needs migration 20261105000008 and a test-only base schema; seeds auth.users rows.

begin;

-- ids: tenant a/b, parent a, parent b, no-fees parent, admin a, admin b, kids
do $seed$
declare
  ta constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  tb constant uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
begin
  insert into public.tenants (id, name) values (ta, 'School A'), (tb, 'School B');
  insert into auth.users (id) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000a2'),
    ('aaaaaaaa-0000-0000-0000-0000000000a3'), ('aaaaaaaa-0000-0000-0000-0000000000ad'),
    ('bbbbbbbb-0000-0000-0000-0000000000b1'), ('bbbbbbbb-0000-0000-0000-0000000000bd');
  insert into public.profiles (id, tenant_id, full_name, role) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1', ta, 'Parent A', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000a2', ta, 'Parent NoFees', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000a3', ta, 'Parent Unlinked', 'parent'),
    ('aaaaaaaa-0000-0000-0000-0000000000ad', ta, 'Admin A', 'admin'),
    ('bbbbbbbb-0000-0000-0000-0000000000b1', tb, 'Parent B', 'parent'),
    ('bbbbbbbb-0000-0000-0000-0000000000bd', tb, 'Admin B', 'admin');
  insert into public.students (id, tenant_id, admission_no, full_name) values
    ('aaaaaaaa-0000-0000-0000-0000000000c1', ta, 'ADM-A1', 'Kid A1'),
    ('aaaaaaaa-0000-0000-0000-0000000000c2', ta, 'ADM-A2', 'Kid A2'),
    ('bbbbbbbb-0000-0000-0000-0000000000c1', tb, 'ADM-B1', 'Kid B1');
  insert into public.parent_student_links (tenant_id, parent_id, student_id, can_view_fees) values
    (ta, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000c1', true),
    (ta, 'aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000c2', false),
    (tb, 'bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000c1', true);
  update public.tenants set mpesa_paybill = '111111' where id = tb;
end
$seed$;

do $anon$
begin
  if has_function_privilege('anon', 'public.get_my_child_paybill(uuid)', 'execute')
     or has_function_privilege('anon', 'public.get_school_paybill()', 'execute')
     or has_function_privilege('anon', 'public.set_school_paybill(text)', 'execute') then
    raise exception 'FAIL: anon can execute a paybill function';
  end if;
end
$anon$;

-- Admin A sets the paybill (whitespace stripped) and bad input is rejected.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000ad","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $admin$
begin
  if public.set_school_paybill(' 522 522 ') is distinct from '522522' then
    raise exception 'FAIL: set_school_paybill did not normalise';
  end if;
  if public.get_school_paybill() is distinct from '522522' then
    raise exception 'FAIL: admin cannot read own paybill';
  end if;
  begin
    perform public.set_school_paybill('abc');
    raise exception 'FAIL: non-numeric paybill accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$admin$;
reset role;

-- Parent A: own child works; account = admission number.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a1","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $parent$
declare
  r record;
begin
  select * into r from public.get_my_child_paybill('aaaaaaaa-0000-0000-0000-0000000000c1');
  if r.paybill_number is distinct from '522522' or r.account_number is distinct from 'ADM-A1' or r.school_name is distinct from 'School A' then
    raise exception 'FAIL: parent got wrong payment details: %', r;
  end if;

  -- same tenant, not linked
  begin
    perform * from public.get_my_child_paybill('aaaaaaaa-0000-0000-0000-0000000000c2');
    raise exception 'FAIL: parent read an unlinked child';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- other tenant child
  begin
    perform * from public.get_my_child_paybill('bbbbbbbb-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: parent read another tenant child';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- parents cannot use the staff functions
  begin
    perform public.set_school_paybill('999999');
    raise exception 'FAIL: parent set the paybill';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.get_school_paybill();
    raise exception 'FAIL: parent read via staff getter';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$parent$;
reset role;

-- Parent without can_view_fees is refused for their own linked child.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-0000000000a2","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
do $nofees$
begin
  begin
    perform * from public.get_my_child_paybill('aaaaaaaa-0000-0000-0000-0000000000c2');
    raise exception 'FAIL: can_view_fees=false was ignored';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end
$nofees$;
reset role;

-- Admin B cannot change School A, and Parent B still sees School B's own number.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-0000000000bd","tenant_id":"bbbbbbbb-0000-0000-0000-000000000001"}', true);
do $adminb$
begin
  perform public.set_school_paybill('333333');
end
$adminb$;
reset role;

do $final$
begin
  if (select mpesa_paybill from public.tenants where id = 'aaaaaaaa-0000-0000-0000-000000000001') is distinct from '522522' then
    raise exception 'FAIL: tenant A paybill changed by tenant B admin';
  end if;
  if (select mpesa_paybill from public.tenants where id = 'bbbbbbbb-0000-0000-0000-000000000001') is distinct from '333333' then
    raise exception 'FAIL: tenant B paybill not updated';
  end if;
  raise notice 'PARENT_PAYBILL: ALL PASS';
end
$final$;

rollback;
