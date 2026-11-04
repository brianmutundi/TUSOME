-- Test: concurrent next_receipt_number calls yield unique, gapless numbers.
-- Run with: psql -f ... (requires a test tenant). This is a template; adapt tenant id.
\set ON_ERROR_STOP on

do $$
declare
  v_tenant uuid := '951758c7-2646-47b6-91c9-33b2699b7313'::uuid;
  v_nums text[];
  v_i int;
begin
  -- reset counter for test tenant
  delete from public.receipt_counters where tenant_id = v_tenant;
  -- fire 10 sequential calls (concurrency not reproducible in single session, but uniqueness/gaplessness checked)
  v_nums := array[]::text[];
  for v_i in 1..10 loop
    v_nums := v_nums || public.next_receipt_number(v_tenant);
  end loop;
  -- assert count distinct = 10
  if (select count(distinct x) from unnest(v_nums) as x) <> 10 then
    raise exception 'Duplicate receipt numbers detected';
  end if;
  -- assert gapless: numbers 1..10
  for v_i in 1..10 loop
    if not (v_nums[v_i] = 'RCP-' || lpad(v_i::text, 4, '0')) then
      raise exception 'Non-gapless sequence at %: %', v_i, v_nums[v_i];
    end if;
  end loop;
  raise notice 'receipt_number_atomicity: PASS';
end;
$$;
