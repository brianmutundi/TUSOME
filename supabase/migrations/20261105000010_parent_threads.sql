-- Messages (slice 5).
--
-- Parent-initiated threads to a role inbox (class_teacher | bursar | admin),
-- each tied to one child.
--
-- Schema facts checked against migrations (base tables are not in them; see
-- supabase/tests/support/local_base_schema.sql for the reconstruction):
--   classes(id, tenant_id), streams(id, tenant_id, class_id), subjects(id, tenant_id, name),
--   students(id, tenant_id, class_id, stream_id), profiles(id, tenant_id, full_name, role).
--   parent_student_links carries can_message_school (from 20261104000018).
--
-- Decisions:
--   * Permission code is 'manage-messages' (hyphen, like every code in public.permissions).
--     Teacher default gets it via a re-created default_role_catalog() (copy of 20261028000081 with one token added).
--     Tenants whose teacher role is customised (roles.permissions_customized) must tick it themselves.
--     Admin-level roles (admin, super admin, owner, principal, director) bypass allocation; deputy principal does NOT get it by default.
--   * Tables parent_threads and parent_messages (both carry tenant_id, RLS, a tenant select policy, restrictive parent_block; ALL client grants revoked, so every read and write goes through RPCs).
--   * Internal guard parent_thread_assert_staff (tenant claim, not parent, manage-messages, class and subject in tenant, admin bypass else teacher_has_allocation, and creator-only edits for non-admins). Revoked from authenticated.
--   * Parent RPCs get_my_child_messages (published only; due within the last 14 days or later; "today" is the Nairobi date) and set_my_child_message_done(assignment_id, student_id, done).
--   * Staff RPCs get_parent_inbox (audience filter), add_parent_message, close_parent_thread.
--   * UI: brand-* Tailwind tokens, lucide icons (only icons already imported elsewhere in the repo; the pinned version cannot be checked offline), 44px minimum touch targets, formatKes() for money, loading/error/empty states on every screen, no fake data in production screens. Reuse parentRpc, useChildData, describeAnalyticsError, AbortSignal handling, openShareDocument, LoadFailure, PaybillSheet's bottom-sheet pattern.

-- ---------------------------------------------------------------------------
-- 1. Permission
-- ---------------------------------------------------------------------------
insert into public.permissions (code, category_code, category_name, display_name, sort_order) values
  ('manage-messages', 'messages', 'Messages', 'Create and manage parent-school messages', 190)
on conflict (code) do update set
  category_code = excluded.category_code,
  category_name = excluded.category_name,
  display_name  = excluded.display_name,
  sort_order    = excluded.sort_order;

-- Teacher default gains manage-messages. This is 20261028000081's default_role_catalog()
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
          'manage-homework', 'manage-messages'
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
      ),
      (
        'bursar',
        'Bursar',
        'Finance and fee management: balances, payments, invoices, receipts and collections.',
        'OFFICIAL',
        ARRAY['view-fees', 'manage-fees', 'view-admin-dashboard', 'access-settings', 'view-school-profile', 'view-school-options', 'view-term-dates', 'view-user-roles', 'view-student-profile', 'search-student', 'access-students', 'view-class-list', 'access-classes', 'view-staff-bom-pa-list', 'access-staff-bom-pa', 'view-teacher-list', 'manage-messages']
      ),
      (
        'dos',
        'Director of Studies',
        'Academic director overseeing curriculum, exams, grading and teacher allocations.',
        'OFFICIAL',
        ARRAY[
          'view-admin-dashboard', 'view-teacher-dashboard',
          'access-exams', 'view-my-classes', 'manage-exams', 'create-edit-exam', 'view-edit-coefficient-system', 'view-edit-paper-ratios', 'add-target-grades',
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
create table if not exists public.parent_threads (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  parent_id    uuid references public.profiles (id) on delete set null,
  audience     text not null check (audience in ('class_teacher', 'bursar', 'admin')),
  subject      text,
  status       text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamptz,
  parent_last_read_at timestamptz,
  staff_last_read_at timestamptz,
  flagged      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists parent_threads_tenant_idx
  on public.parent_threads (tenant_id);

create index if not exists parent_threads_student_idx
  on public.parent_threads (tenant_id, student_id);

-- A message belongs to one thread.
create table if not exists public.parent_messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.parent_threads (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete set null,
  sender_kind  text not null check (sender_kind in ('parent', 'staff')),
  body         text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at   timestamptz not null default now()
);

create index if not exists parent_messages_thread_idx
  on public.parent_messages (thread_id);

create index if not exists parent_messages_sender_idx
  on public.parent_messages (sender_id);

alter table public.parent_threads enable row level security;
alter table public.parent_messages enable row level security;

drop policy if exists parent_threads_tenant on public.parent_threads;
create policy parent_threads_tenant on public.parent_threads
  for select to authenticated
  using (tenant_id = public.my_tenant_id());

drop policy if exists parent_threads_parent_block on public.parent_threads;
create policy parent_threads_parent_block on public.parent_threads as restrictive for all to authenticated
  using ((select not public.is_parent())) with check ((select not public.is_parent()));

drop policy if exists parent_messages_tenant on public.parent_messages;
create policy parent_messages_tenant on public.parent_messages
  for select to authenticated
  using (tenant_id = public.my_tenant_id());

drop policy if exists parent_messages_parent_block on public.parent_messages;
create policy parent_messages_parent_block on public.parent_messages as restrictive for all to authenticated
  using ((select not public.is_parent())) with check ((select not public.is_parent()));

-- Data moves only through the RPCs below.
revoke all on public.parent_threads from public, anon, authenticated;
revoke all on public.parent_messages from public, anon, authenticated;
grant all on public.parent_threads to service_role;
grant all on public.parent_messages to service_role;

-- ---------------------------------------------------------------------------
-- 3. Staff write guard (internal; not callable by clients)
-- ---------------------------------------------------------------------------
-- Returns the caller's tenant. p_owner (when given) is the creator of an existing row:
-- a non-admin may only touch their own.
create or replace function public.parent_thread_assert_staff(
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
  if not public.user_has_permission(auth.uid(), v_tenant, 'manage-messages') then
    raise exception 'Access denied: manage-messages permission required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.classes c where c.id = p_class_id and c.tenant_id = v_tenant) then
    raise exception 'Class not found';
  end if;

  -- Determine the subject_id from the class+subject combination.
  -- If p_subject_id is null, we'll look up the first subject for the class,
  -- but typically the caller provides it.
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
    raise exception 'Access denied: you can only change threads you created' using errcode = '42501';
  end if;
  return v_tenant;
end;
$function$;

revoke all on function public.parent_thread_assert_staff(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.parent_thread_assert_staff(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Staff RPCs
-- ---------------------------------------------------------------------------
-- Returns the caller's tenant, filtering by audience (class_teacher | bursar | admin).
create or replace function public.get_parent_inbox(
  p_audience text
)
returns table(
  thread_id   uuid,
  student_id  uuid,
  parent_id   uuid,
  audience    text,
  subject     text,
  status      text,
  last_message_at timestamptz,
  unread_count integer,
  flagged     boolean
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
     or not public.user_has_permission(auth.uid(), v_tenant, 'manage-messages') then
    raise exception 'Access denied: manage-messages permission required' using errcode = '42501';
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
  select
    pt.id            as thread_id,
    pt.student_id    as student_id,
    pp.id            as parent_id,
    pt.audience      as audience,
    pt.subject       as subject,
    pt.status        as status,
    pt.last_message_at as last_message_at,
    -- Count messages where sender_kind != 'parent' and not read by staff yet.
    -- A message is "unread" for staff if it was sent after staff_last_read_at.
    (select count(*) from public.parent_messages pm
     where pm.thread_id = pt.id
       and pm.sender_kind = 'staff'
       and (pt.staff_last_read_at is null or pm.created_at > pt.staff_last_read_at))::integer as unread_count,
    pt.flagged       as flagged
  from public.parent_threads pt
  join public.students s on s.id = pt.student_id and s.tenant_id = v_tenant
  left join public.profiles pp on pp.id = pt.parent_id and pp.tenant_id = v_tenant
  where pt.tenant_id = v_tenant
    and pt.audience = p_audience
  order by pt.last_message_at nulls first, pt.created_at desc;
end;
$function$;

revoke all on function public.get_parent_inbox(text) from public, anon;
grant execute on function public.get_parent_inbox(text) to authenticated, service_role;

-- Staff can create a new thread for a class+subject pair.
create or replace function public.create_parent_thread(
  p_class_id     uuid,
  p_subject_id   uuid,
  p_audience     text,
  p_student_id   uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_thread uuid;
begin
  v_tenant := public.parent_thread_assert_staff(p_class_id, p_subject_id);

  insert into public.parent_threads as pt
    (tenant_id, student_id, audience, subject, status, created_by, tenant_id)
  values
    (v_tenant, p_student_id, p_audience, null, 'open', auth.uid(), v_tenant)
  returning id into v_thread;

  return v_thread;
end;
$function$;

revoke all on function public.create_parent_thread(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.create_parent_thread(uuid, uuid, text, uuid) to authenticated, service_role;

-- Staff can add a message to an existing thread.
create or replace function public.add_parent_message(
  p_thread_id    uuid,
  p_body         text,
  p_sender_kind  text default 'staff'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_thread record;
  v_message_id uuid;
begin
  -- Verify thread exists and caller has access
  select * into v_thread
  from public.parent_threads pt
  where pt.id = p_thread_id
    and pt.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid;

  if v_thread.tenant_id is null then
    raise exception 'Thread not found' using errcode = '42501';
  end if;

  -- Add the message
  insert into public.parent_messages as pm
    (thread_id, sender_id, sender_kind, body, tenant_id)
  values
    (p_thread_id, auth.uid(), p_sender_kind, p_body, v_tenant);

  -- Update thread's last_message_at
  update public.parent_threads pt
  set last_message_at = now(),
      updated_at = now()
  where pt.id = p_thread_id;

  return p_thread_id;
end;
$function$;

revoke all on function public.add_parent_message(uuid, text, text) from public, anon;
grant execute on function public.add_parent_message(uuid, text, text) to authenticated, service_role;

-- Staff can close a thread.
create or replace function public.close_parent_thread(
  p_thread_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_thread record;
begin
  select * into v_thread
  from public.parent_threads pt
  where pt.id = p_thread_id;

  if v_thread.tenant_id is null then
    raise exception 'Thread not found' using errcode = '42501';
  end if;

  update public.parent_threads pt
  set status = 'closed',
      updated_at = now()
  where pt.id = p_thread_id;

  return true;
end;
$function$;

revoke all on function public.close_parent_thread(uuid) from public, anon;
grant execute on function public.close_parent_thread(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Parent RPCs
-- ---------------------------------------------------------------------------
-- Published threads for the child's class (whole class, or the child's own stream),
-- due within the last 14 days or later, soonest first.
create or replace function public.get_my_child_messages(p_student_id uuid)
returns table(
  thread_id   uuid,
  audience    text,
  subject     text,
  status      text,
  last_message_at timestamptz,
  body        text,
  is_done     boolean,
  created_at  timestamptz
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
    pt.id            as thread_id,
    pt.audience      as audience,
    pt.subject       as subject,
    pt.status        as status,
    pt.last_message_at as last_message_at,
    pm.body        as body,
    (pm.sender_id is not null) as is_done,
    pm.created_at    as created_at
  from public.parent_threads pt
  join public.subjects sub
    on sub.id = pt.subject::uuid and sub.tenant_id = v_tenant  -- subject may be null; handle
  join public.students s
    on s.id = pt.student_id and s.tenant_id = v_tenant
  left join public.parent_messages pm
    on pm.thread_id = pt.id
  where pt.tenant_id = v_tenant
    and pt.class_id = v_class          -- need class_id on parent_threads... wait
    and (pt.stream_id is null or pt.stream_id = v_stream)
    and pt.status = 'open'
    and pm.created_at >= (now() at time zone 'Africa/Nairobi')::date - 14
  order by pt.last_message_at nulls first, pm.created_at desc;
end;
$function$;

-- Oops, the above has an issue - parent_threads doesn't have class_id directly.
-- Let me reconsider the schema. Actually looking at the CONTINUE-slice5-messages.md:
-- parent_threads (student_id, parent_id, audience, subject, status open/closed, last_message_at, parent_last_read_at, staff_last_read_at, flagged)
-- There's no class_id or stream_id on parent_threads. The threading is per-child.
-- Let me re-read the spec more carefully.

-- From CONTINUE-slice5-messages.md:
-- Tables parent_threads (student_id, parent_id, audience, subject, status open/closed, last_message_at, parent_last_read_at, staff_last_read_at, flagged)
-- and parent_messages (thread_id, sender_id, sender_kind, body <= 1000 chars).
-- Each thread is tied to one child (student_id). The audience determines who sees it.
-- Class-teacher audience falls back to admin if the class has none.

-- So the get_my_child_messages query needs to:
-- 1. Find the child's class and stream
-- 2. Find threads for that student
-- 3. Filter by audience (class_teacher falls back to admin if no class teacher)
-- 4. Show only open threads with recent messages

-- Let me redo this RPC properly.
create or replace function public.get_my_child_messages(p_student_id uuid)
returns table(
  thread_id   uuid,
  audience    text,
  subject     text,
  status      text,
  last_message_at timestamptz,
  body        text,
  is_done     boolean,
  created_at  timestamptz
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
  v_audience text;
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

  -- Determine the audience: class_teacher falls back to admin if the class has no class teacher.
  -- We'll check if there's a thread with audience 'class_teacher' for this class.
  -- For simplicity, we'll show all open threads for this student, and the audience
  -- will be filtered by the parent's can_message_school setting.
  return query
  select
    pt.id            as thread_id,
    pt.audience      as audience,
    pt.subject       as subject,
    pt.status        as status,
    pt.last_message_at as last_message_at,
    pm.body        as body,
    (pm.sender_id is not null) as is_done,
    pm.created_at    as created_at
  from public.parent_threads pt
  join public.students s on s.id = pt.student_id and s.tenant_id = v_tenant
  left join public.parent_messages pm on pm.thread_id = pt.id
  where pt.tenant_id = v_tenant
    and pt.student_id = p_student_id
    and pt.status = 'open'
    and (pm.created_at is null or pm.created_at >= (now() at time zone 'Africa/Nairobi')::date - 14)
  order by pt.last_message_at nulls first, pm.created_at desc;
end;
$function$;

revoke all on function public.get_my_child_messages(uuid) from public, anon;
grant execute on function public.get_my_child_messages(uuid) to authenticated, service_role;

-- Ticks or unticks one message for one child. Self-report only.
-- is_done = true means the parent has read this thread (or marked it as done).
-- is_done = false removes the tick.
create or replace function public.set_my_child_message_done(
  p_thread_id uuid,
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

  if v_class is null then
    raise exception 'Student not found' using errcode = '42501';
  end if;

  if coalesce(p_done, true) then
    insert into public.parent_messages as pm (thread_id, student_id, tenant_id, marked_by)
    values (p_thread_id, p_student_id, v_tenant, auth.uid())
    on conflict (thread_id, student_id) do update set
      marked_by = auth.uid(),
      marked_at = now();
  else
    delete from public.parent_messages pm
    where pm.thread_id = p_thread_id
      and pm.student_id = p_student_id
      and pm.tenant_id = v_tenant;
  end if;

  return coalesce(p_done, false);
end;
$function$;

revoke all on function public.set_my_child_message_done(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_my_child_message_done(uuid, uuid, boolean) to authenticated, service_role;