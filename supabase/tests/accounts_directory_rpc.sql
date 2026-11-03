-- Zeraki-parity roles, permissions, accounts & section heads RPC tests.
--
-- Run against a LOCAL / DISPOSABLE database only, after
-- 20261028000006_accounts_directory_rpc.sql has been applied:
--
--   npm run db:test
--   -- or --
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/accounts_directory_rpc.sql
--
-- Expect: ALL ACCOUNT DIRECTORY CHECKS PASSED
--
-- Everything runs in one transaction and is rolled back.
--
-- NEVER run this against project fzwexcgsyzdqyauwccah (production).
begin;

-- ---------------------------------------------------------------------------
-- 0. Grants and function properties (SECURITY INVOKER, no anon EXECUTE)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  fn_list text[] := array[
    'get_account_directory',
    'get_permission_catalogue',
    'get_roles_with_permissions',
    'upsert_custom_role',
    'delete_custom_role',
    'get_user_permission_profile',
    'save_user_permission_overrides',
    'set_user_access_revoked',
    'invite_or_create_account',
    'update_account_profile',
    'get_section_heads',
    'upsert_section_head',
    'delete_section_head'
  ];
begin
  if (select count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'get_account_directory') <> 1 then
    raise exception 'FAIL grants: expected 1 account directory function';
  end if;

  for r in
    select p.oid, p.proname, p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(fn_list)
  loop
    if r.prosecdef then
      raise exception 'FAIL security: % is SECURITY DEFINER', r.proname;
    end if;
    if has_function_privilege('anon', r.oid, 'EXECUTE') then
      raise exception 'FAIL grants: anon can execute %', r.proname;
    end if;
    if not has_function_privilege('authenticated', r.oid, 'EXECUTE') then
      raise exception 'FAIL grants: authenticated cannot execute %', r.proname;
    end if;
    if not has_function_privilege('service_role', r.oid, 'EXECUTE') then
      raise exception 'FAIL grants: service_role cannot execute %', r.proname;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into tenants (id, name) values
  ('d0000000-0000-0000-0000-0000000000a1', 'Accounts School A'),
  ('d0000000-0000-0000-0000-0000000000b1', 'Accounts School B');

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-0000000000f1', 'zara@school-a.local'),
  ('d0000000-0000-0000-0000-0000000000f2', 'alice@school-a.local'),
  ('d0000000-0000-0000-0000-0000000000f3', 'bob@school-a.local'),
  ('d0000000-0000-0000-0000-0000000000f4', 'unnamed@school-a.local'),
  ('d0000000-0000-0000-0000-0000000000f5', 'cara@school-b.local');

insert into profiles (id, tenant_id, full_name, role, is_active, created_at) values
  ('d0000000-0000-0000-0000-0000000000f1', 'd0000000-0000-0000-0000-0000000000a1', 'Zara Admin',     'admin',     true,  '2026-01-01T08:00:00Z'),
  ('d0000000-0000-0000-0000-0000000000f2', 'd0000000-0000-0000-0000-0000000000a1', 'Alice Teacher',  'teacher',   true,  '2026-02-01T08:00:00Z'),
  ('d0000000-0000-0000-0000-0000000000f3', 'd0000000-0000-0000-0000-0000000000a1', 'Bob Teacher',    'teacher',   false, '2026-03-01T08:00:00Z'),
  ('d0000000-0000-0000-0000-0000000000f4', 'd0000000-0000-0000-0000-0000000000a1', null,             null,        true,  '2026-04-01T08:00:00Z'),
  ('d0000000-0000-0000-0000-0000000000f5', 'd0000000-0000-0000-0000-0000000000b1', 'Cara Principal', 'principal', true,  '2026-05-01T08:00:00Z');

do $$
begin
  update public.profiles
  set email = 'zara@school-a.local', staff_type = 'OFFICIAL'
  where id = 'd0000000-0000-0000-0000-0000000000f1';

  update public.profiles
  set staff_type = 'TEACHER'
  where id in ('d0000000-0000-0000-0000-0000000000f2', 'd0000000-0000-0000-0000-0000000000f3');

  update public.profiles
  set email = 'cara@school-b.local', staff_type = 'OFFICIAL'
  where id = 'd0000000-0000-0000-0000-0000000000f5';
end $$;

-- ---------------------------------------------------------------------------
-- 1. Account directory, emails, staff types & permission catalogue
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-0000000000f1","role":"authenticated","tenant_id":"d0000000-0000-0000-0000-0000000000a1"}',
  true
);

do $$
declare
  r record;
  names text[] := array[]::text[];
  alice record;
  bob record;
  unnamed record;
  perm_count int;
begin
  for r in select * from public.get_account_directory() loop
    names := array_append(names, coalesce(r.full_name, '<null>'));
  end loop;

  if names <> array['<null>', 'Alice Teacher', 'Bob Teacher', 'Zara Admin'] then
    raise exception 'FAIL directory order/count for School A: got %', names;
  end if;

  -- Alice has null profiles.email -> resolved from auth.users.email.
  select * into alice from public.get_account_directory()
  where account_id = 'd0000000-0000-0000-0000-0000000000f2';
  if alice.email <> 'alice@school-a.local' or alice.staff_type <> 'TEACHER' then
    raise exception 'FAIL Alice email/staff_type: % / %', alice.email, alice.staff_type;
  end if;

  select * into bob from public.get_account_directory()
  where account_id = 'd0000000-0000-0000-0000-0000000000f3';
  if bob.role <> 'teacher' or bob.is_active <> false or bob.access_revoked <> false then
    raise exception 'FAIL Bob row: role=% active=% revoked=%', bob.role, bob.is_active, bob.access_revoked;
  end if;

  select * into unnamed from public.get_account_directory()
  where account_id = 'd0000000-0000-0000-0000-0000000000f4';
  if unnamed.full_name is not null or unnamed.role is not null or unnamed.email <> 'unnamed@school-a.local' then
    raise exception 'FAIL unnamed row: name=% role=% email=%',
      unnamed.full_name, unnamed.role, unnamed.email;
  end if;

  select count(*) into perm_count from public.get_permission_catalogue();
  if perm_count < 50 then
    raise exception 'FAIL permission catalogue count: expected >= 50, got %', perm_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Custom roles, role permissions, per-user overrides & access revocation
-- ---------------------------------------------------------------------------
do $$
declare
  v_role_id uuid;
  v_role_row record;
  v_prof jsonb;
  v_new_user uuid;
  v_sh_id uuid;
  v_sh_count int;
begin
  -- Create a custom role with 2 permissions.
  v_role_id := public.upsert_custom_role(
    'academic dean',
    'Academic Dean',
    'Oversees curriculum and exams',
    'OFFICIAL',
    array['access-exams', 'manage-exams']
  );

  select * into v_role_row
  from public.get_roles_with_permissions()
  where role_key = 'academic dean';

  if v_role_row.scope <> 'CUSTOM'
     or v_role_row.display_name <> 'Academic Dean'
     or v_role_row.permission_codes <> array['access-exams', 'manage-exams'] then
    raise exception 'FAIL custom role row: %', v_role_row;
  end if;

  -- Global roles cannot be deleted.
  begin
    perform public.delete_custom_role('admin');
    raise exception 'FAIL global role delete allowed';
  exception when others then
    if sqlerrm = 'FAIL global role delete allowed' then raise; end if;
    if sqlerrm <> 'Global roles cannot be deleted' then
      raise exception 'FAIL global role delete message: %', sqlerrm;
    end if;
  end;

  -- Delete the unassigned custom role succeeds.
  if not public.delete_custom_role('academic dean') then
    raise exception 'FAIL delete_custom_role returned false';
  end if;

  -- Per-user permission overrides on Alice (teacher):
  -- Grant 'edit-user-roles', deny 'view-merit-list' (which teachers have by default).
  v_prof := public.save_user_permission_overrides(
    'd0000000-0000-0000-0000-0000000000f2',
    array['edit-user-roles'],
    array['view-merit-list'],
    array[]::text[]
  );

  if not ((v_prof -> 'effective_permissions') ? 'edit-user-roles') then
    raise exception 'FAIL grant override missing from effective_permissions: %', v_prof;
  end if;
  if (v_prof -> 'effective_permissions') ? 'view-merit-list' then
    raise exception 'FAIL denied override still in effective_permissions: %', v_prof;
  end if;

  -- Revoking all access empties effective_permissions.
  perform public.set_user_access_revoked('d0000000-0000-0000-0000-0000000000f2', true);
  v_prof := public.get_user_permission_profile('d0000000-0000-0000-0000-0000000000f2');
  if (v_prof ->> 'access_revoked')::boolean <> true
     or jsonb_array_length(v_prof -> 'effective_permissions') <> 0 then
    raise exception 'FAIL revoke access profile: %', v_prof;
  end if;

  -- Restoring access restores effective_permissions.
  perform public.set_user_access_revoked('d0000000-0000-0000-0000-0000000000f2', false);
  v_prof := public.get_user_permission_profile('d0000000-0000-0000-0000-0000000000f2');
  if (v_prof ->> 'access_revoked')::boolean <> false
     or not ((v_prof -> 'effective_permissions') ? 'edit-user-roles') then
    raise exception 'FAIL restore access profile: %', v_prof;
  end if;

  -- Invite/create a new account and update it.
  v_new_user := public.invite_or_create_account(
    'David Bursar',
    'david@school-a.local',
    'bursar',
    'WORKER'
  );
  perform public.update_account_profile(
    v_new_user,
    'David Senior Bursar',
    'david.senior@school-a.local',
    'bursar',
    'OFFICIAL',
    true
  );

  if not exists (
    select 1 from public.get_account_directory()
    where account_id = v_new_user
      and full_name = 'David Senior Bursar'
      and email = 'david.senior@school-a.local'
      and staff_type = 'OFFICIAL'
  ) then
    raise exception 'FAIL invite/update account not reflected in directory';
  end if;

  -- Section heads: assign, read, delete.
  v_sh_id := public.upsert_section_head('JUNIOR_SCHOOL', 'd0000000-0000-0000-0000-0000000000f2');
  select count(*) into v_sh_count from public.get_section_heads() where section_head_id = v_sh_id;
  if v_sh_count <> 1 then
    raise exception 'FAIL section head upsert/get: count=%', v_sh_count;
  end if;

  perform public.delete_section_head(v_sh_id);
  select count(*) into v_sh_count from public.get_section_heads() where section_head_id = v_sh_id;
  if v_sh_count <> 0 then
    raise exception 'FAIL section head delete: count=%', v_sh_count;
  end if;
end $$;

-- Non-admin (Alice Teacher) is denied write RPCs.
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-0000000000f2","role":"authenticated","tenant_id":"d0000000-0000-0000-0000-0000000000a1"}',
  true
);
do $$
begin
  begin
    perform public.upsert_custom_role('hacker', 'Hacker', '', 'OFFICIAL', array[]::text[]);
    raise exception 'FAIL non-admin upsert_custom_role allowed';
  exception when others then
    if sqlerrm = 'FAIL non-admin upsert_custom_role allowed' then raise; end if;
    if sqlerrm not ilike '%administrator role required%' then
      raise exception 'FAIL non-admin message: %', sqlerrm;
    end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Tenant isolation (School B caller & explicit guard as table owner)
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-0000000000f5","role":"authenticated","tenant_id":"d0000000-0000-0000-0000-0000000000b1"}',
  true
);
do $$
declare
  n int;
begin
  select count(*) into n from public.get_account_directory();
  if n <> 1 then
    raise exception 'FAIL School B count: expected 1, got %', n;
  end if;
end $$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-0000000000f5","role":"authenticated","tenant_id":"d0000000-0000-0000-0000-0000000000b1"}',
  true
);
do $$
declare
  n int;
begin
  select count(*) into n from public.get_account_directory();
  if n <> 1 then
    raise exception 'FAIL explicit guard as owner: expected 1 row for School B, got %', n;
  end if;

  begin
    perform public.get_user_permission_profile('d0000000-0000-0000-0000-0000000000f1');
    raise exception 'FAIL cross-tenant get_user_permission_profile allowed';
  exception when others then
    if sqlerrm = 'FAIL cross-tenant get_user_permission_profile allowed' then raise; end if;
    if sqlerrm not ilike '%Access denied%' then
      raise exception 'FAIL cross-tenant message: %', sqlerrm;
    end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Missing/malformed claims, service_role bypass, and anon privilege block
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-0000000000f1","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform count(*) from public.get_account_directory();
    raise exception 'FAIL missing tenant claim: call allowed';
  exception when others then
    if sqlerrm = 'FAIL missing tenant claim: call allowed' then raise; end if;
    if sqlerrm <> 'Missing tenant claim' then
      raise exception 'FAIL missing tenant claim message: %', sqlerrm;
    end if;
  end;
end $$;

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  n int;
begin
  select count(*) into n from public.get_account_directory();
  if n <> 6 then
    raise exception 'FAIL service_role directory: expected 6 rows across tenants, got %', n;
  end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform count(*) from public.get_account_directory();
    raise exception 'FAIL anon: call allowed';
  exception when others then
    if sqlerrm = 'FAIL anon: call allowed' then raise; end if;
    if sqlerrm not ilike '%permission denied%' then
      raise exception 'FAIL anon message: %', sqlerrm;
    end if;
  end;
end $$;

reset role;
select 'ALL ACCOUNT DIRECTORY CHECKS PASSED' as result;
rollback;
