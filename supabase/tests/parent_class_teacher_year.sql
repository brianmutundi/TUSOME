-- Class-teacher lookup uses the current academic year (migration 20261106000005). Run with ON_ERROR_STOP=1:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parent_class_teacher_year.sql
-- Needs migrations up to 20261106000005 and the test-only base schema. Rolls back.
begin;

do $t$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  c7 constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000c7';
  c8 constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000c8';
  t_now constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000f1';
  t_old constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000f2';
  yr integer := extract(year from (now() at time zone 'Africa/Nairobi'))::integer;
  got uuid[];
begin
  insert into public.tenants (id, name) values (a, 'School A');
  insert into auth.users (id) values (t_now), (t_old);
  insert into public.profiles (id, tenant_id, full_name, role) values
    (t_now, a, 'Current Teacher', 'teacher'), (t_old, a, 'Last Year Teacher', 'teacher');
  insert into public.classes (id, tenant_id, name) values (c7, a, 'Grade 7'), (c8, a, 'Grade 8');
  insert into public.class_teacher_assignments (tenant_id, class_id, stream_id, teacher_id, academic_year) values
    (a, c7, null, t_now, yr),
    (a, c7, null, t_old, yr - 1),   -- last year's teacher must not be returned
    (a, c8, null, t_old, yr - 1);   -- Grade 8 has only last year's assignment

  select coalesce(array_agg(teacher_id), '{}') into got from public.parent_msg_class_teachers(a, c7, null);
  if got <> array[t_now] then raise exception 'FAIL: Grade 7 should return only the current-year teacher, got %', got; end if;

  select coalesce(array_agg(teacher_id), '{}') into got from public.parent_msg_class_teachers(a, c8, null);
  if cardinality(got) <> 0 then raise exception 'FAIL: Grade 8 has no current-year teacher, got %', got; end if;
end
$t$;

rollback;
