create or replace function public.bulk_create_students(p_students jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_student jsonb;
  v_count int := 0;
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;

  begin
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_caller_tenant := null;
  end;

  if v_role is distinct from 'service_role' then
    if v_caller_tenant is null then
      raise exception 'Missing tenant claim';
    end if;
    -- permission check: add-students
    if not public.user_has_permission(auth.uid(), v_caller_tenant, 'add-students') then
      raise exception 'Access denied: add-students permission required';
    end if;
  end if;

  if jsonb_typeof(p_students) <> 'array' then
    raise exception 'p_students must be an array';
  end if;

  for v_student in select * from jsonb_array_elements(p_students) loop
    -- create student (inline create_student logic)
    insert into public.students (tenant_id, admission_no, full_name, gender, class_id, stream_id, academic_year, date_of_birth, guardian_name, guardian_relation, primary_phone, previous_school)
    values (
      v_caller_tenant,
      v_student ->> 'admission_no',
      v_student ->> 'full_name',
      nullif(v_student ->> 'gender', ''),
      nullif(v_student ->> 'class_id', '')::uuid,
      nullif(v_student ->> 'stream_id', '')::uuid,
      nullif(v_student ->> 'academic_year', '')::int,
      nullif(v_student ->> 'date_of_birth', '')::date,
      nullif(v_student ->> 'guardian_name', ''),
      nullif(v_student ->> 'guardian_relation', ''),
      nullif(v_student ->> 'primary_phone', ''),
      nullif(v_student ->> 'previous_school', '')
    )
    returning id into v_id;
    v_ids := v_ids || v_id;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('count', v_count, 'ids', v_ids);
end;
$function$;

revoke all on function public.bulk_create_students(jsonb) from public, anon;
grant execute on function public.bulk_create_students(jsonb) to authenticated, service_role;
