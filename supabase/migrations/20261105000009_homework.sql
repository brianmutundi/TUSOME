-- Homework (slice 4).
--
-- Teachers publish homework for a class (optionally one stream) and subject. Parents
-- see it for their own child and may tick it "done". That tick is a SELF-REPORT by the
-- parent: it is never graded and never shown to the child's teachers as a result. There
-- are no attachments and no submissions.
--
-- Schema facts checked against migrations (base tables are not in them; see
-- supabase/tests/support/local_base_schema.sql for the reconstruction):
--   classes(id, tenant_id), streams(id, tenant_id, class_id), subjects(id, tenant_id, name),
--   students(id, tenant_id, class_id, stream_id), profiles(id, tenant_id, full_name, role).
--   public.teacher_has_allocation(user, class, subject) is used by 20261028000007 and
--   20261028000084 but defined in no migration; it must exist on the real database.
--   Allocation is by class + subject (stream is not part of the check).
--
-- Decisions:
--   * Permission code is 'manage-homework' (hyphen, like every code in public.permissions).
--     Teacher default gets it through default_role_catalog(); tenants whose teacher role is
--     customised (roles.permissions_customized) must tick it themselves.
--   * Admin-level roles (admin, super admin, owner, principal, director: the same list that
--     bypasses user_has_permission) may write for any class and subject. Everyone else needs
--     manage-homework AND teacher_has_allocation, and can only change homework they created.
--   * Parents read through get_my_child_homework / write one tick through
--     set_my_child_homework_done, both assert_parent_of(student, 'can_view_academics').
--   * "Today" is the Nairobi calendar day, not the database's UTC day.
--   * Tables are reachable only through the RPCs (no grants to anon/authenticated). RLS,
--     a tenant policy and the restrictive parent_block policy are kept as defence in depth.
-- Parent window: published, due within the last 14 days or later.

-- ---------------------------------------------------------------------------
-- 1. Permission
-- ---------------------------------------------------------------------------
insert into public.permissions (code, category_code, category_name, display_name, sort_order) values
  ('manage-homework', 'homework', 'Homework', 'Create and publish homework for allocated classes', 180)
on conflict (code) do update set
  category_code = excluded.category_code,
  category_name = excluded.category_name,
  display_name  = excluded.display_name,
  sort_order    = excluded.sort_order;

-- Teacher default gains manage-homework. This is 20261028000081's default_role_catalog()
-- re-created unchanged except for that one token in the 'teacher' row (fix forward).
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
          'access-students', 'search-student', 'view-student-profile', 'view-student-analysis',
          'manage-homework'
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

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.homework_assignments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  class_id     uuid not null references public.classes (id) on delete cascade,
  stream_id    uuid references public.streams (id) on delete cascade,
  subject_id   uuid not null references public.subjects (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  instructions text check (instructions is null or char_length(instructions) <= 2000),
  due_date     date not null,
  created_by   uuid references public.profiles (id) on delete set null,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists homework_assignments_class_due_idx
  on public.homework_assignments (tenant_id, class_id, due_date);

-- A row means "the parent says this child did it". Deleting the tick deletes the row.
create table if not exists public.homework_completions (
  assignment_id uuid not null references public.homework_assignments (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  marked_by     uuid references public.profiles (id) on delete set null,
  marked_at     timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create index if not exists homework_completions_student_idx
  on public.homework_completions (tenant_id, student_id);

alter table public.homework_assignments enable row level security;
alter table public.homework_completions enable row level security;

drop policy if exists homework_assignments_tenant on public.homework_assignments;
create policy homework_assignments_tenant on public.homework_assignments
  for select to authenticated
  using (tenant_id = public.my_tenant_id());

drop policy if exists homework_completions_tenant on public.homework_completions;
create policy homework_completions_tenant on public.homework_completions
  for select to authenticated
  using (tenant_id = public.my_tenant_id());

drop policy if exists parent_block on public.homework_assignments;
create policy parent_block on public.homework_assignments as restrictive for all to authenticated
  using ((select not public.is_parent())) with check ((select not public.is_parent()));

drop policy if exists parent_block on public.homework_completions;
create policy parent_block on public.homework_completions as restrictive for all to authenticated
  using ((select not public.is_parent())) with check ((select not public.is_parent()));

-- Data moves only through the RPCs below.
revoke all on public.homework_assignments from public, anon, authenticated;
revoke all on public.homework_completions from public, anon, authenticated;
grant all on public.homework_assignments to service_role;
grant all on public.homework_completions to service_role;

-- ---------------------------------------------------------------------------
-- 3. Staff write guard (internal; not callable by clients)
-- ---------------------------------------------------------------------------
-- Returns the caller's tenant. p_owner (when given) is the creator of an existing row:
-- a non-admin may only touch their own.
create or replace function public.homework_assert_staff(
  p_class_id   uuid,
  p_subject_id uuid,
  p_owner      uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_admin  boolean;
begin
  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;
  if v_tenant is null then
    raise exception 'Missing tenant claim';
  end if;
  if auth.uid() is null or public.is_parent() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if not public.user_has_permission(auth.uid(), v_tenant, 'manage-homework') then
    raise exception 'Access denied: manage-homework permission required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.classes c where c.id = p_class_id and c.tenant_id = v_tenant) then
    raise exception 'Class not found';
  end if;
  if not exists (select 1 from public.subjects s where s.id = p_subject_id and s.tenant_id = v_tenant) then
    raise exception 'Subject not found';
  end if;

  select public.normalize_role_key(p.role) in ('admin', 'super admin', 'owner', 'principal', 'director')
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.tenant_id = v_tenant
        and public.normalize_role_key(ur.role_key) in ('admin', 'super admin', 'owner', 'principal', 'director')
    )
  into v_admin
  from public.profiles p
  where p.id = auth.uid() and p.tenant_id = v_tenant;

  if coalesce(v_admin, false) then
    return v_tenant;
  end if;

  if not public.teacher_has_allocation(auth.uid(), p_class_id, p_subject_id) then
    raise exception 'Access denied: not allocated to this class and subject' using errcode = '42501';
  end if;
  if p_owner is not null and p_owner is distinct from auth.uid() then
    raise exception 'Access denied: you can only change homework you created' using errcode = '42501';
  end if;
  return v_tenant;
end;
$function$;

revoke all on function public.homework_assert_staff(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.homework_assert_staff(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Staff RPCs
-- ---------------------------------------------------------------------------
-- Class and subject pairs the caller may set homework for (all pairs for admin-level roles).
create or replace function public.get_homework_scopes()
returns table(
  class_id     uuid,
  class_name   text,
  subject_id   uuid,
  subject_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_admin  boolean;
begin
  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;
  if v_tenant is null then
    raise exception 'Missing tenant claim';
  end if;
  if auth.uid() is null or public.is_parent()
     or not public.user_has_permission(auth.uid(), v_tenant, 'manage-homework') then
    raise exception 'Access denied: manage-homework permission required' using errcode = '42501';
  end if;

  select public.normalize_role_key(p.role) in ('admin', 'super admin', 'owner', 'principal', 'director')
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.tenant_id = v_tenant
        and public.normalize_role_key(ur.role_key) in ('admin', 'super admin', 'owner', 'principal', 'director')
    )
  into v_admin
  from public.profiles p
  where p.id = auth.uid() and p.tenant_id = v_tenant;

  return query
  select c.id as class_id, c.name as class_name, s.id as subject_id, s.name as subject_name
  from public.classes c
  cross join public.subjects s
  where c.tenant_id = v_tenant
    and s.tenant_id = v_tenant
    and (coalesce(v_admin, false) or public.teacher_has_allocation(auth.uid(), c.id, s.id))
  order by c.name, s.name;
end;
$function$;

revoke all on function public.get_homework_scopes() from public, anon;
grant execute on function public.get_homework_scopes() to authenticated, service_role;

create or replace function public.create_homework(
  p_class_id     uuid,
  p_stream_id    uuid,
  p_subject_id   uuid,
  p_title        text,
  p_instructions text,
  p_due_date     date,
  p_publish      boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_title  text;
  v_instr  text;
  v_id     uuid;
begin
  v_tenant := public.homework_assert_staff(p_class_id, p_subject_id);

  v_title := btrim(coalesce(p_title, ''));
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Title is required (up to 120 characters)';
  end if;
  v_instr := nullif(btrim(coalesce(p_instructions, '')), '');
  if v_instr is not null and char_length(v_instr) > 2000 then
    raise exception 'Instructions are limited to 2000 characters';
  end if;
  if p_due_date is null then
    raise exception 'Due date is required';
  end if;
  if p_due_date < (now() at time zone 'Africa/Nairobi')::date then
    raise exception 'Due date cannot be in the past';
  end if;
  if p_stream_id is not null and not exists (
    select 1 from public.streams st
    where st.id = p_stream_id and st.class_id = p_class_id and st.tenant_id = v_tenant
  ) then
    raise exception 'Stream does not belong to this class';
  end if;

  insert into public.homework_assignments as ha
    (tenant_id, class_id, stream_id, subject_id, title, instructions, due_date, created_by, is_published)
  values
    (v_tenant, p_class_id, p_stream_id, p_subject_id, v_title, v_instr, p_due_date, auth.uid(), coalesce(p_publish, false))
  returning ha.id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.create_homework(uuid, uuid, uuid, text, text, date, boolean) from public, anon;
grant execute on function public.create_homework(uuid, uuid, uuid, text, text, date, boolean) to authenticated, service_role;

-- Class, stream and subject cannot be changed: create a new item instead.
create or replace function public.update_homework(
  p_assignment_id uuid,
  p_title         text,
  p_instructions  text,
  p_due_date      date,
  p_publish       boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_row    record;
  v_tenant uuid;
  v_title  text;
  v_instr  text;
begin
  select ha.class_id, ha.subject_id, ha.created_by, ha.due_date, ha.tenant_id
  into v_row
  from public.homework_assignments ha
  where ha.id = p_assignment_id;

  if v_row.class_id is null then
    raise exception 'Homework not found';
  end if;

  v_tenant := public.homework_assert_staff(v_row.class_id, v_row.subject_id, v_row.created_by);
  if v_tenant is distinct from v_row.tenant_id then
    raise exception 'Homework not found';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Title is required (up to 120 characters)';
  end if;
  v_instr := nullif(btrim(coalesce(p_instructions, '')), '');
  if v_instr is not null and char_length(v_instr) > 2000 then
    raise exception 'Instructions are limited to 2000 characters';
  end if;
  if p_due_date is null then
    raise exception 'Due date is required';
  end if;
  if p_due_date is distinct from v_row.due_date
     and p_due_date < (now() at time zone 'Africa/Nairobi')::date then
    raise exception 'Due date cannot be in the past';
  end if;

  update public.homework_assignments ha
  set title = v_title,
      instructions = v_instr,
      due_date = p_due_date,
      is_published = coalesce(p_publish, ha.is_published),
      updated_at = now()
  where ha.id = p_assignment_id and ha.tenant_id = v_tenant;

  return true;
end;
$function$;

revoke all on function public.update_homework(uuid, text, text, date, boolean) from public, anon;
grant execute on function public.update_homework(uuid, text, text, date, boolean) to authenticated, service_role;

-- Deleting also removes the parents' ticks (cascade).
create or replace function public.delete_homework(p_assignment_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_row    record;
  v_tenant uuid;
begin
  select ha.class_id, ha.subject_id, ha.created_by, ha.tenant_id
  into v_row
  from public.homework_assignments ha
  where ha.id = p_assignment_id;

  if v_row.class_id is null then
    raise exception 'Homework not found';
  end if;

  v_tenant := public.homework_assert_staff(v_row.class_id, v_row.subject_id, v_row.created_by);
  if v_tenant is distinct from v_row.tenant_id then
    raise exception 'Homework not found';
  end if;

  delete from public.homework_assignments ha
  where ha.id = p_assignment_id and ha.tenant_id = v_tenant;

  return true;
end;
$function$;

revoke all on function public.delete_homework(uuid) from public, anon;
grant execute on function public.delete_homework(uuid) to authenticated, service_role;

-- Homework due from p_from (default: 30 days ago) onwards. Admin-level roles see every
-- item in the school; teachers see what they created. done_count is how many parents of
-- children currently in the class/stream ticked it: a self-report, not a result.
create or replace function public.list_homework(p_from date default null)
returns table(
  assignment_id   uuid,
  class_id        uuid,
  class_name      text,
  stream_id       uuid,
  stream_name     text,
  subject_id      uuid,
  subject_name    text,
  title           text,
  instructions    text,
  due_date        date,
  is_published    boolean,
  created_by_name text,
  student_count   integer,
  done_count      integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_admin  boolean;
  v_from   date;
begin
  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;
  if v_tenant is null then
    raise exception 'Missing tenant claim';
  end if;
  if auth.uid() is null or public.is_parent()
     or not public.user_has_permission(auth.uid(), v_tenant, 'manage-homework') then
    raise exception 'Access denied: manage-homework permission required' using errcode = '42501';
  end if;

  select public.normalize_role_key(p.role) in ('admin', 'super admin', 'owner', 'principal', 'director')
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.tenant_id = v_tenant
        and public.normalize_role_key(ur.role_key) in ('admin', 'super admin', 'owner', 'principal', 'director')
    )
  into v_admin
  from public.profiles p
  where p.id = auth.uid() and p.tenant_id = v_tenant;

  v_from := coalesce(p_from, (now() at time zone 'Africa/Nairobi')::date - 30);

  return query
  select
    ha.id            as assignment_id,
    ha.class_id      as class_id,
    c.name           as class_name,
    ha.stream_id     as stream_id,
    st.name          as stream_name,
    ha.subject_id    as subject_id,
    sub.name         as subject_name,
    ha.title         as title,
    ha.instructions  as instructions,
    ha.due_date      as due_date,
    ha.is_published  as is_published,
    cp.full_name     as created_by_name,
    cnt.students     as student_count,
    cnt.done         as done_count
  from public.homework_assignments ha
  join public.classes c on c.id = ha.class_id and c.tenant_id = v_tenant
  join public.subjects sub on sub.id = ha.subject_id and sub.tenant_id = v_tenant
  left join public.streams st on st.id = ha.stream_id and st.tenant_id = v_tenant
  left join public.profiles cp on cp.id = ha.created_by and cp.tenant_id = v_tenant
  cross join lateral (
    select
      count(s.id)::integer as students,
      count(hc.student_id)::integer as done
    from public.students s
    left join public.homework_completions hc
      on hc.assignment_id = ha.id and hc.student_id = s.id
    where s.tenant_id = v_tenant
      and s.class_id = ha.class_id
      and (ha.stream_id is null or s.stream_id = ha.stream_id)
  ) cnt
  where ha.tenant_id = v_tenant
    and ha.due_date >= v_from
    and (coalesce(v_admin, false) or ha.created_by = auth.uid())
  order by ha.due_date desc, ha.created_at desc;
end;
$function$;

revoke all on function public.list_homework(date) from public, anon;
grant execute on function public.list_homework(date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Parent RPCs
-- ---------------------------------------------------------------------------
-- Published homework for the child's class (whole class, or the child's own stream), due
-- within the last 14 days or later, soonest first. is_done is the parent's own tick.
create or replace function public.get_my_child_homework(p_student_id uuid)
returns table(
  assignment_id uuid,
  subject_name  text,
  title         text,
  instructions  text,
  due_date      date,
  teacher_name  text,
  is_done       boolean,
  done_at       timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_class  uuid;
  v_stream uuid;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_academics');

  select s.class_id, s.stream_id
    into v_class, v_stream
  from public.students s
  where s.id = p_student_id
    and s.tenant_id = v_tenant;

  if v_class is null then
    return;
  end if;

  return query
  select
    ha.id          as assignment_id,
    sub.name       as subject_name,
    ha.title       as title,
    ha.instructions as instructions,
    ha.due_date    as due_date,
    tp.full_name   as teacher_name,
    (hc.student_id is not null) as is_done,
    hc.marked_at   as done_at
  from public.homework_assignments ha
  join public.subjects sub
    on sub.id = ha.subject_id and sub.tenant_id = v_tenant
  left join public.profiles tp
    on tp.id = ha.created_by and tp.tenant_id = v_tenant
  left join public.homework_completions hc
    on hc.assignment_id = ha.id and hc.student_id = p_student_id
  where ha.tenant_id = v_tenant
    and ha.is_published
    and ha.class_id = v_class
    and (ha.stream_id is null or ha.stream_id = v_stream)
    and ha.due_date >= (now() at time zone 'Africa/Nairobi')::date - 14
  order by ha.due_date, ha.created_at, ha.id;
end;
$function$;

revoke all on function public.get_my_child_homework(uuid) from public, anon;
grant execute on function public.get_my_child_homework(uuid) to authenticated, service_role;

-- Ticks or unticks one item for one child. Self-report only.
create or replace function public.set_my_child_homework_done(
  p_assignment_id uuid,
  p_student_id    uuid,
  p_done          boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_class  uuid;
  v_stream uuid;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_academics');

  select s.class_id, s.stream_id
    into v_class, v_stream
  from public.students s
  where s.id = p_student_id
    and s.tenant_id = v_tenant;

  -- Only items this child can actually see in get_my_child_homework.
  if v_class is null or not exists (
    select 1
    from public.homework_assignments ha
    where ha.id = p_assignment_id
      and ha.tenant_id = v_tenant
      and ha.is_published
      and ha.class_id = v_class
      and (ha.stream_id is null or ha.stream_id = v_stream)
      and ha.due_date >= (now() at time zone 'Africa/Nairobi')::date - 14
  ) then
    raise exception 'Homework not found';
  end if;

  if coalesce(p_done, false) then
    insert into public.homework_completions as hc (assignment_id, student_id, tenant_id, marked_by)
    values (p_assignment_id, p_student_id, v_tenant, auth.uid())
    on conflict (assignment_id, student_id) do nothing;
  else
    delete from public.homework_completions hc
    where hc.assignment_id = p_assignment_id
      and hc.student_id = p_student_id
      and hc.tenant_id = v_tenant;
  end if;

  return coalesce(p_done, false);
end;
$function$;

revoke all on function public.set_my_child_homework_done(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_my_child_homework_done(uuid, uuid, boolean) to authenticated, service_role;
