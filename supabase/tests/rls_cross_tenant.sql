-- Cross-tenant RLS tests per table family.
-- A user whose JWT tenant is school B must not SELECT/INSERT/UPDATE/DELETE school A rows.
-- Runs in a transaction and rolls back all fixtures.
-- Usage: supabase db query --linked -f supabase/tests/rls_cross_tenant.sql

begin;

-- Create school B as the admin connection, then drop to the RLS-enforcing role.
insert into public.tenants(id, name)
values ('b0000000-0000-0000-0000-0000000000b1', 'Cross Tenant School B');
set local role authenticated;

create temporary table cross_tenant_results(table_name text, operation text, passed boolean, detail text) on commit drop;

do $$
declare
  v_a constant uuid := '951758c7-2646-47b6-91c9-33b2699b7313'; -- school A (demo data)
  v_b constant uuid := 'b0000000-0000-0000-0000-0000000000b1';      -- school B (empty)
  t text;
  n integer;
  v_tables text[] := array[
    'students', 'student_enrollments',           -- students family
    'classes', 'exams', 'marks',                 -- academics family
    'profiles',                                  -- staff family
    'fee_payments', 'invoices',                  -- finance family
    'daily_attendance'                           -- attendance family
  ];
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'tenant_id', v_b)::text, true);

  foreach t in array v_tables loop
    -- SELECT
    execute format('select count(*) from public.%I where tenant_id = $1', t) into n using v_a;
    insert into cross_tenant_results values (t, 'select', n = 0, 'rows visible: ' || n);

    -- UPDATE (must affect zero rows)
    execute format('update public.%I set tenant_id = tenant_id where tenant_id = $1', t) using v_a;
    get diagnostics n = row_count;
    insert into cross_tenant_results values (t, 'update', n = 0, 'rows updated: ' || n);

    -- DELETE (must affect zero rows)
    execute format('delete from public.%I where tenant_id = $1', t) using v_a;
    get diagnostics n = row_count;
    insert into cross_tenant_results values (t, 'delete', n = 0, 'rows deleted: ' || n);

    -- INSERT (copy a school A row with a fresh id but school A tenant_id; WITH CHECK must reject)
    begin
      execute format(
        'insert into public.%1$I select (jsonb_populate_record(null::public.%1$I, to_jsonb(s) || jsonb_build_object(''id'', gen_random_uuid(), ''tenant_id'', $1))).* from public.%1$I s where s.tenant_id = $1 limit 1',
        t
      ) using v_a;
      get diagnostics n = row_count;
      insert into cross_tenant_results values (t, 'insert', n = 0, 'rows inserted: ' || n);
    exception
      when sqlstate '42501' then
        insert into cross_tenant_results values (t, 'insert', true, 'RLS WITH CHECK rejected');
      when others then
        insert into cross_tenant_results values (t, 'insert', false, sqlstate || ': ' || left(sqlerrm, 100));
    end;
  end loop;
end $$;

select
  (select json_agg(json_build_object('table', table_name, 'operation', operation, 'passed', passed, 'detail', detail)) from cross_tenant_results) as results,
  case when bool_and(passed) then 'CROSS_TENANT_RLS: ALL PASS' else 'CROSS_TENANT_RLS: FAILURES' end as summary
from cross_tenant_results;

rollback;
