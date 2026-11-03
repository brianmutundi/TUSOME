-- Batch 3: missing roles (DOS, student, parent) + multi-role junction table

CREATE OR REPLACE FUNCTION public.default_role_catalog()
RETURNS TABLE(
  role_key text,
  display_name text,
  description text,
  staff_type text,
  scope text,
  default_permissions text[]
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    v.role_key,
    v.display_name,
    v.description,
    v.staff_type,
    'GLOBAL'::text AS scope,
    v.default_permissions
  FROM (
    VALUES
      (
        'admin',
        'Administrator',
        'Full school administration, exam publishing, role & permission management.',
        'OFFICIAL',
        ARRAY(SELECT p.code FROM public.permissions p ORDER BY p.sort_order, p.code)
      ),
      (
        'principal',
        'Principal',
        'Head of school with full visibility across exams, reports, staff and settings.',
        'OFFICIAL',
        ARRAY(SELECT p.code FROM public.permissions p ORDER BY p.sort_order, p.code)
      ),
      (
        'deputy principal',
        'Deputy principal',
        'Academic and administrative deputy head overseeing exams, classes and staff.',
        'OFFICIAL',
        ARRAY[
          'view-admin-dashboard', 'view-teacher-dashboard',
          'access-exams', 'view-my-classes', 'manage-exams', 'create-edit-exam', 'view-edit-grading-system',
          'access-printouts', 'view-merit-list', 'view-evaluation-report', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-classes', 'manage-classes', 'edit-classes', 'assign-subject-teachers', 'assign-class-teachers', 'assign-class-supervisors', 'access-subjects',
          'access-students', 'add-students', 'search-student', 'view-student-profile', 'view-student-analysis', 'edit-student-profile', 'move-students',
          'access-teachers', 'view-teacher-profile', 'view-teacher-list', 'access-staff-bom-pa', 'view-staff-bom-pa-list',
          'access-settings', 'view-school-profile', 'view-school-options', 'view-user-roles', 'view-term-dates'
        ]
      ),
      (
        'director',
        'Director',
        'School director with oversight of dashboards, printouts, staff and settings.',
        'OFFICIAL',
        ARRAY[
          'view-admin-dashboard',
          'access-exams', 'view-my-classes',
          'access-printouts', 'view-merit-list', 'view-evaluation-report', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-students', 'search-student', 'view-student-profile', 'view-student-analysis',
          'access-teachers', 'view-teacher-profile', 'view-teacher-list', 'access-staff-bom-pa', 'view-staff-bom-pa-list',
          'access-settings', 'view-school-profile', 'view-school-options', 'view-user-roles', 'edit-user-roles', 'can-manage-user-permissions', 'view-term-dates'
        ]
      ),
      (
        'secretary',
        'Secretary',
        'Front-office and records management for students, class lists and printouts.',
        'WORKER',
        ARRAY[
          'view-secretary-dashboard',
          'access-printouts', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-classes', 'access-students', 'add-students', 'search-student', 'view-student-profile', 'edit-student-profile',
          'access-teachers', 'view-teacher-list', 'access-staff-bom-pa', 'view-staff-bom-pa-list',
          'access-settings', 'view-school-profile', 'view-term-dates'
        ]
      ),
      (
        'teacher',
        'Teacher',
        'Subject and class teacher access to exams, mark sheets, student analytics and reports.',
        'TEACHER',
        ARRAY[
          'view-teacher-dashboard',
          'access-exams', 'view-my-classes',
          'access-printouts', 'view-merit-list', 'view-evaluation-report', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-classes', 'access-subjects',
          'access-students', 'search-student', 'view-student-profile', 'view-student-analysis'
        ]
      ),
      (
        'worker',
        'Non-teaching staff',
        'Support and operational school staff.',
        'WORKER',
        ARRAY[
          'view-secretary-dashboard',
          'access-students', 'search-student'
        ]
      )
      ,
      (
        'bursar',
        'Bursar',
        'Finance and fee management: balances, payments, invoices, receipts and collections.',
        'OFFICIAL',
        ARRAY['view-fees', 'manage-fees', 'view-admin-dashboard', 'access-settings', 'view-school-profile', 'view-school-options', 'view-term-dates', 'view-user-roles', 'view-student-profile', 'search-student', 'access-students', 'view-class-list', 'access-classes', 'view-staff-bom-pa-list', 'access-staff-bom-pa', 'view-teacher-list']
      )

      ,
      (
        'dos',
        'Director of Studies',
        'Academic director overseeing curriculum, exams, grading and teacher allocations.',
        'OFFICIAL',
        ARRAY[
          'view-admin-dashboard', 'view-teacher-dashboard',
          'access-exams', 'view-my-classes', 'manage-exams', 'create-edit-exam', 'view-edit-grading-system', 'view-edit-coefficient-system', 'view-edit-paper-ratios', 'add-target-grades',
          'access-printouts', 'view-merit-list', 'view-evaluation-report', 'view-report-forms', 'view-class-list', 'view-printout-filters', 'view-transcripts',
          'access-classes', 'manage-classes', 'edit-classes', 'assign-subject-teachers', 'assign-class-teachers', 'assign-class-supervisors', 'access-subjects',
          'access-students', 'add-students', 'search-student', 'view-student-profile', 'view-student-analysis', 'edit-student-profile', 'move-students',
          'access-teachers', 'view-teacher-profile', 'view-teacher-list', 'add-teachers', 'edit-teacher-profile',
          'access-settings', 'view-school-profile', 'view-school-options', 'view-user-roles', 'view-term-dates'
        ]
      ),
      (
        'student',
        'Student',
        'Student self-service access (own results and profile).',
        'TEACHER',
        ARRAY['view-student-dashboard']
      ),
      (
        'parent',
        'Parent / Guardian',
        'Parent / guardian access to linked children data.',
        'WORKER',
        ARRAY['view-student-dashboard']
      )

  ) AS v(role_key, display_name, description, staff_type, default_permissions)
$function$;

-- Batch 3: multi-role support via user_roles junction table
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id),
  unique (tenant_id, user_id, role_key)
);

create index if not exists idx_user_roles_tenant on public.user_roles(tenant_id);
create index if not exists idx_user_roles_user on public.user_roles(user_id);

alter table public.user_roles enable row level security;

create policy user_roles_select on public.user_roles
  for select using (tenant_id = (select my_tenant_id()));
create policy user_roles_insert on public.user_roles
  for insert with check (
    tenant_id = (select my_tenant_id())
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.tenant_id = (select my_tenant_id()) and me.is_active = true and me.access_revoked = false and public.normalize_role_key(me.role) in ('admin','super admin','owner','principal','director'))
  );
create policy user_roles_delete on public.user_roles
  for delete using (
    tenant_id = (select my_tenant_id())
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.tenant_id = (select my_tenant_id()) and me.is_active = true and me.access_revoked = false and public.normalize_role_key(me.role) in ('admin','super admin','owner','principal','director'))
  );

create or replace function public.user_has_role(p_user_id uuid, p_role_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $func$
declare
  v_caller uuid := auth.uid();
  v_caller_tenant uuid;
  v_target_tenant uuid;
  v_is_admin boolean := false;
begin
  if v_caller is null then
    return false;
  end if;
  select tenant_id into v_caller_tenant from public.profiles where id = v_caller;
  select tenant_id into v_target_tenant from public.profiles where id = p_user_id;
  if v_target_tenant is null or v_caller_tenant is distinct from v_target_tenant then
    return false;
  end if;
  if v_caller <> p_user_id then
    select exists (
      select 1 from public.profiles me
      where me.id = v_caller and me.tenant_id = v_caller_tenant
        and me.is_active = true and me.access_revoked = false
        and public.normalize_role_key(me.role) in ('admin','super admin','owner','principal','director')
    ) into v_is_admin;
    if not coalesce(v_is_admin, false) then
      return false;
    end if;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id = p_user_id and public.normalize_role_key(p.role) = public.normalize_role_key(p_role_key)
  ) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id and public.normalize_role_key(ur.role_key) = public.normalize_role_key(p_role_key)
  );
end;
$func$;

revoke all on function public.user_has_role(uuid, text) from public, anon;
grant execute on function public.user_has_role(uuid, text) to authenticated, service_role;
