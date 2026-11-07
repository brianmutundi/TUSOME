-- get_my_children now returns class_id, stream_id and stream_name so the
-- timetable (and later homework) can be fetched for the child's class.
-- Same caller checks and ordering as the definition in 20261028000055.
-- Not run against a database here.

drop function if exists public.get_my_children();

create or replace function public.get_my_children()
returns table(
  student_id   uuid,
  full_name    text,
  admission_no text,
  class_name   text,
  relationship text,
  is_primary   boolean,
  class_id     uuid,
  stream_id    uuid,
  stream_name  text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_caller_tenant uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  begin
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_caller_tenant := null;
  end;

  if v_caller_tenant is null then
    raise exception 'Missing tenant claim';
  end if;

  return query
  select
    s.id,
    s.full_name,
    s.admission_no,
    c.name,
    psl.relationship,
    psl.is_primary,
    s.class_id,
    s.stream_id,
    st.name
  from public.parent_student_links psl
  join public.profiles p on p.id = psl.parent_id
  join public.students s on s.id = psl.student_id and s.tenant_id = v_caller_tenant
  left join public.classes c on c.id = s.class_id
  left join public.streams st on st.id = s.stream_id
  where psl.parent_id = auth.uid()
    and psl.tenant_id = v_caller_tenant
    and psl.revoked_at is null
    and p.tenant_id = v_caller_tenant
    and p.is_active = true
    and p.access_revoked = false
    and public.normalize_role_key(p.role) = 'parent'
  order by psl.is_primary desc, s.full_name;
end;
$function$;

revoke all on function public.get_my_children() from public, anon;
grant execute on function public.get_my_children() to authenticated, service_role;
