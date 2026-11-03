-- Multi-role permission UNION tests.
-- Runs against the linked DB inside a transaction; every fixture is rolled back.
-- Usage: supabase db query --linked -f supabase/tests/multi_role_union.sql
begin;
set local "request.jwt.claims" = '{"role":"authenticated","tenant_id":"951758c7-2646-47b6-91c9-33b2699b7313"}';

create temporary table multi_role_results(name text, passed boolean, detail text) on commit drop;

-- Fixture: existing teacher in the demo tenant.
do $$
declare
  v_tenant constant uuid := '951758c7-2646-47b6-91c9-33b2699b7313';
  v_user uuid;
  v_prof jsonb;
  v_perms text[];
begin
  select id into v_user from public.profiles
  where tenant_id = v_tenant and public.normalize_role_key(role) = 'teacher'
  order by created_at nulls last limit 1;
  if v_user is null then raise exception 'No teacher fixture found'; end if;

  delete from public.user_roles where user_id = v_user;

  -- 1. Baseline: teacher has teacher permission, not DOS-only manage-exams.
  v_prof := public.get_user_permission_profile(v_user);
  v_perms := array(select jsonb_array_elements_text(v_prof -> 'effective_permissions'));
  insert into multi_role_results values (
    'baseline teacher has view-teacher-dashboard',
    'view-teacher-dashboard' = any(v_perms), v_perms::text);
  insert into multi_role_results values (
    'baseline teacher lacks manage-exams',
    not ('manage-exams' = any(v_perms)), v_perms::text);
  insert into multi_role_results values (
    'baseline user_has_permission(manage-exams) = false',
    not public.user_has_permission(v_user, v_tenant, 'manage-exams'), '');

  -- 2. teacher + DOS => union includes both roles.
  insert into public.user_roles(tenant_id, user_id, role_key)
  values (v_tenant, v_user, 'dos');
  v_prof := public.get_user_permission_profile(v_user);
  v_perms := array(select jsonb_array_elements_text(v_prof -> 'effective_permissions'));
  insert into multi_role_results values (
    'teacher+DOS keeps teacher permission',
    'view-teacher-dashboard' = any(v_perms), v_perms::text);
  insert into multi_role_results values (
    'teacher+DOS gains DOS manage-exams',
    'manage-exams' = any(v_perms), v_perms::text);
  insert into multi_role_results values (
    'teacher+DOS user_has_permission(manage-exams) = true',
    public.user_has_permission(v_user, v_tenant, 'manage-exams'), '');

  -- 3. custom tenant role + built-in primary role.
  insert into public.roles(tenant_id, key, display_name, permissions_customized)
  values (v_tenant, 'customdos', 'Custom DOS', true);
  insert into public.role_permissions(role_id, permission_code)
  select id, 'delete-exam' from public.roles where tenant_id = v_tenant and key = 'customdos';
  insert into public.user_roles(tenant_id, user_id, role_key)
  values (v_tenant, v_user, 'customdos');
  v_prof := public.get_user_permission_profile(v_user);
  v_perms := array(select jsonb_array_elements_text(v_prof -> 'effective_permissions'));
  insert into multi_role_results values (
    'custom role adds delete-exam',
    'delete-exam' = any(v_perms), v_perms::text);
  insert into multi_role_results values (
    'custom + built-in keeps built-in DOS manage-exams',
    'manage-exams' = any(v_perms), v_perms::text);
  insert into multi_role_results values (
    'custom + built-in keeps teacher permission',
    'view-teacher-dashboard' = any(v_perms), v_perms::text);

  -- 4. Removing one additional role leaves the others intact.
  delete from public.user_roles where user_id = v_user and role_key = 'customdos';
  v_prof := public.get_user_permission_profile(v_user);
  v_perms := array(select jsonb_array_elements_text(v_prof -> 'effective_permissions'));
  insert into multi_role_results values (
    'removing customdos removes delete-exam',
    not ('delete-exam' = any(v_perms)), v_perms::text);
  insert into multi_role_results values (
    'removing customdos keeps DOS manage-exams',
    'manage-exams' = any(v_perms), v_perms::text);
  insert into multi_role_results values (
    'removing customdos keeps teacher permission',
    'view-teacher-dashboard' = any(v_perms), v_perms::text);

  delete from public.user_roles where user_id = v_user;
end $$;

select
  (select json_agg(json_build_object('name', name, 'passed', passed)) from multi_role_results) as results,
  case when bool_and(passed) then 'MULTI_ROLE_UNION: ALL PASS'
       else 'MULTI_ROLE_UNION: FAILURES' end as summary
from multi_role_results;

rollback;
