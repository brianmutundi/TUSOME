-- Extend get_parent_student_links with parent_phone (profiles.phone precedence).
-- Drop the duplicate get_student_guardian_contacts (client now uses this).
drop function if exists public.get_parent_student_links(uuid, uuid);

create or replace function public.get_parent_student_links(p_student_id uuid default null, p_parent_id uuid default null)
returns table(
  link_id uuid,
  parent_id uuid,
  parent_name text,
  parent_email text,
  parent_phone text,
  student_id uuid,
  student_name text,
  admission_no text,
  relationship text,
  is_primary boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
begin
  begin v_role := auth.role(); exception when others then v_role := null; end;
  if v_role is distinct from 'service_role' then
    begin v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid; exception when others then v_caller_tenant := null; end;
    if v_caller_tenant is null then raise exception 'Missing tenant claim'; end if;
  end if;

  return query
  select
    psl.id as link_id,
    psl.parent_id,
    pp.full_name as parent_name,
    pp.email as parent_email,
    pp.phone as parent_phone,
    psl.student_id,
    s.full_name as student_name,
    s.admission_no,
    psl.relationship,
    psl.is_primary,
    psl.created_at
  from public.parent_student_links psl
  left join public.profiles pp on pp.id = psl.parent_id
  left join public.students s on s.id = psl.student_id
  where (v_role = 'service_role' or psl.tenant_id = v_caller_tenant)
    and (p_student_id is null or psl.student_id = p_student_id)
    and (p_parent_id is null or psl.parent_id = p_parent_id)
  order by s.full_name, pp.full_name;
end;
$function$;

revoke all on function public.get_parent_student_links(uuid, uuid) from public, anon;
grant execute on function public.get_parent_student_links(uuid, uuid) to authenticated, service_role;

-- Drop the duplicate
drop function if exists public.get_student_guardian_contacts(uuid);
