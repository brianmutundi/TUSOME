-- TUSOME analytics: tenant-scoped filter options in one RPC
--
-- STATUS: repository migration. Applied only to the isolated local stack
-- (local/lib/apply.mjs). Never applied to production from here.
--
-- Why this exists
-- ---------------
-- The dashboard loaded its filter dropdowns with direct PostgREST reads:
--
--   from('exams').select(...).eq('status','published')
--   from('classes').select(...)
--   from('streams').select(...)
--
-- Those reads are only tenant-safe if row level security policies exist on
-- those tables. The analytics RPCs enforce auth.jwt()->>'tenant_id' themselves,
-- so a missing policy produces the worst combination: another school's exam
-- titles appear in the dropdown, and every analytics call for them then fails
-- with "Access denied to exam from different tenant". That is exactly what the
-- local stack reproduced once the local anon key was wired up.
--
-- This function makes the filter list obey the same rule as every other
-- analytics entry point: the caller's tenant comes from the verified JWT, and
-- rows from any other tenant are never returned. It also keeps the browser from
-- depending on RLS for a security-relevant read.
--
-- Scope: published exams only (draft/reopened exams stay invisible), classes and
-- streams for the caller's tenant. No student or mark data is exposed.

create or replace function public.get_analytics_filters()
returns jsonb
language plpgsql
stable
as $function$
declare
  v_tenant uuid;
begin
  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;

  if v_tenant is null then
    raise exception 'Missing tenant claim';
  end if;

  return jsonb_build_object(
    'exams', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', e.id,
                   'name', e.name,
                   'term', e.term,
                   'academic_year', e.academic_year,
                   'assessment_component', e.assessment_component,
                   'status', e.status,
                   'published_at', e.created_at
                 )
                 order by e.academic_year desc nulls last, e.created_at desc nulls last
               )
        from public.exams e
        where e.tenant_id = v_tenant
          and e.status = 'published'
      ),
      '[]'::jsonb
    ),
    'classes', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('id', c.id, 'name', c.name)
                 order by c.name
               )
        from public.classes c
        where c.tenant_id = v_tenant
      ),
      '[]'::jsonb
    ),
    'streams', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('id', s.id, 'class_id', s.class_id, 'name', s.name)
                 order by s.name
               )
        from public.streams s
        where s.tenant_id = v_tenant
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

-- New function: no legacy caller exists, so remove the implicit PUBLIC grant
-- instead of inheriting it. This mirrors the intent of
-- 20261028000002_revoke_anon_execute_analytics.sql for the older functions.
revoke all on function public.get_analytics_filters() from public;
revoke all on function public.get_analytics_filters() from anon;
grant execute on function public.get_analytics_filters() to authenticated;
grant execute on function public.get_analytics_filters() to service_role;
