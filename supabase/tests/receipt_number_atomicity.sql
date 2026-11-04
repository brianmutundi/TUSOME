-- Test: next_receipt_number yields unique, gapless RCP-{YY}-{6 digits} numbers
-- per (tenant_id, year). Uses isolated test year 1999 and cleans up its counter row.

do $$
declare
  v_tenant uuid := '951758c7-2646-47b6-91c9-33b2699b7313'::uuid;
  v_year smallint := 1999;
  v_nums text[];
  v_i int;
begin
  delete from public.receipt_counters where tenant_id = v_tenant and year = v_year;
  v_nums := array[]::text[];
  for v_i in 1..10 loop
    v_nums := v_nums || public.next_receipt_number(v_tenant, v_year);
  end loop;
  if (select count(distinct x) from unnest(v_nums) as x) <> 10 then
    raise exception 'Duplicate receipt numbers detected: %', v_nums;
  end if;
  for v_i in 1..10 loop
    if v_nums[v_i] <> ('RCP-99-' || lpad(v_i::text, 6, '0')) then
      raise exception 'Non-gapless sequence at %: %', v_i, v_nums[v_i];
    end if;
  end loop;
  delete from public.receipt_counters where tenant_id = v_tenant and year = v_year;
end;
$$;

select 'receipt_number_atomicity: PASS' as result;
