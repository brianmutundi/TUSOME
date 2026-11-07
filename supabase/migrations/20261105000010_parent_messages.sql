-- Parent messages (slice 5).
--
-- A parent starts a thread about ONE child and sends it to a role inbox: the child's class
-- teacher, the bursar, or the school office (admin). Text only (1000 characters per
-- message), no attachments, no SMS. Staff reply from an inbox; parents can read and reply
-- but never delete anything.
--
-- Schema facts checked against migrations (base tables are not in them; see
-- supabase/tests/support/local_base_schema.sql for the reconstruction):
--   students(id, tenant_id, full_name, admission_no, class_id, stream_id), classes(id, name),
--   profiles(id, tenant_id, full_name, role, is_active, access_revoked),
--   parent_student_links(parent_id, student_id, tenant_id, relationship, revoked_at,
--     can_message_school)  [20261104000018],
--   class_teacher_assignments(tenant_id, class_id, stream_id null, teacher_id, academic_year)
--     [20261028000008], user_roles(tenant_id, user_id, role_key) [20261028000081].
--
-- Decisions:
--   * Permission code is 'reply-parent-messages' (hyphen, like every code in public.permissions;
--     the brief said reply_parent_messages). Teacher and bursar defaults get it through
--     default_role_catalog(); tenants whose roles are customised (roles.permissions_customized)
--     must tick it themselves. Admin-level roles hold every permission.
--   * Who sees a thread (all enforced in SQL, never in the client):
--       - admin-level roles (admin, super admin, owner, principal, director): every thread in
--         their school, whatever the audience (oversight, and nothing is ever orphaned);
--       - bursar (role or junction role 'bursar'): threads addressed to 'bursar';
--       - a class teacher of the child's class (class_teacher_assignments, class-wide or the
--         child's own stream, latest academic_year on file for that class): threads addressed
--         to 'class_teacher'.
--     Staff also need reply-parent-messages. (Deputy principals are admin-level for messaging since 20261106000004.) Other custom roles only
--     see threads through one of the routes above.
--   * Class-teacher threads fall back to 'admin' when the class has no active class teacher
--     at the moment the thread is created. The stored audience is the effective one.
--   * Limits: at most 10 new threads per parent per Nairobi day; a parent may reopen a closed
--     thread within 14 days of closing; staff can close and flag; nobody deletes.
--   * can_message_school is enforced on every parent call through assert_parent_of. A parent
--     whose link loses that right no longer sees the thread either (it stays for staff).
--   * Read state: parent_last_read_at / staff_last_read_at are "seen up to" marks; a thread is
--     unread for the parent when a staff message is newer than the mark, and unread for staff
--     (one shared mark for everyone who can see the thread) when a parent message is newer.
--   * Tables are reachable only through the RPCs (no grants to anon/authenticated). RLS, a
--     tenant policy and the restrictive parent_block policy are kept as defence in depth.
--   * Messages raised on purpose use the default error code so the text reaches the client.

-- ---------------------------------------------------------------------------
-- 1. Permission
-- ---------------------------------------------------------------------------
insert into public.permissions (code, category_code, category_name, display_name, sort_order) values
  ('reply-parent-messages', 'messages', 'Parent messages', 'Read and reply to messages from parents', 190)
on conflict (code) do update set
  category_code = excluded.category_code,
  category_name = excluded.category_name,
  display_name  = excluded.display_name,
  sort_order    = excluded.sort_order;

-- Teacher and bursar defaults gain reply-parent-messages. This is 20261105000009's
-- default_role_catalog() re-created unchanged except for that one token in the 'teacher' and
-- 'bursar' rows (fix forward).
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
          'manage-homework', 'reply-parent-messages'
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
        ARRAY['view-fees', 'manage-fees', 'view-admin-dashboard', 'access-settings', 'view-school-profile', 'view-school-options', 'view-term-dates', 'view-user-roles', 'view-student-profile', 'search-student', 'access-students', 'view-class-list', 'access-classes', 'view-staff-bom-pa-list', 'access-staff-bom-pa', 'view-teacher-list', 'reply-parent-messages']
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
create table if not exists public.parent_threads (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  student_id          uuid not null references public.students (id) on delete cascade,
  parent_id           uuid not null references public.profiles (id) on delete cascade,
  audience            text not null check (audience in ('class_teacher', 'bursar', 'admin')),
  subject             text not null check (char_length(btrim(subject)) between 1 and 120),
  status              text not null default 'open' check (status in ('open', 'closed')),
  closed_at           timestamptz,
  closed_by           uuid references public.profiles (id) on delete set null,
  flagged             boolean not null default false,
  last_message_at     timestamptz not null default now(),
  parent_last_read_at timestamptz,
  staff_last_read_at  timestamptz,
  created_at          timestamptz not null default now(),
  constraint parent_threads_closed_at_matches_status check ((status = 'closed') = (closed_at is not null))
);

create index if not exists parent_threads_parent_idx
  on public.parent_threads (tenant_id, parent_id, last_message_at desc);
create index if not exists parent_threads_inbox_idx
  on public.parent_threads (tenant_id, audience, status, last_message_at desc);
create index if not exists parent_threads_rate_idx
  on public.parent_threads (parent_id, created_at);

create table if not exists public.parent_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.parent_threads (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  sender_id   uuid references public.profiles (id) on delete set null,
  sender_kind text not null check (sender_kind in ('parent', 'staff')),
  body        text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index if not exists parent_messages_thread_idx
  on public.parent_messages (thread_id, created_at);

alter table public.parent_threads enable row level security;
alter table public.parent_messages enable row level security;

drop policy if exists parent_threads_tenant on public.parent_threads;
create policy parent_threads_tenant on public.parent_threads
  for select to authenticated
  using (tenant_id = public.my_tenant_id());

drop policy if exists parent_messages_tenant on public.parent_messages;
create policy parent_messages_tenant on public.parent_messages
  for select to authenticated
  using (tenant_id = public.my_tenant_id());

drop policy if exists parent_block on public.parent_threads;
create policy parent_block on public.parent_threads as restrictive for all to authenticated
  using ((select not public.is_parent())) with check ((select not public.is_parent()));

drop policy if exists parent_block on public.parent_messages;
create policy parent_block on public.parent_messages as restrictive for all to authenticated
  using ((select not public.is_parent())) with check ((select not public.is_parent()));

-- Data moves only through the RPCs below.
revoke all on public.parent_threads from public, anon, authenticated;
revoke all on public.parent_messages from public, anon, authenticated;
grant all on public.parent_threads to service_role;
grant all on public.parent_messages to service_role;

-- ---------------------------------------------------------------------------
-- 3. Internal helpers (not callable by clients; they run inside the definer RPCs)
-- ---------------------------------------------------------------------------
-- Active class teachers for a child's class (and stream). Uses the latest academic_year on
-- file for the class so a school that has not re-assigned for a new year is not orphaned.
create or replace function public.parent_msg_class_teachers(
  p_tenant uuid,
  p_class  uuid,
  p_stream uuid
)
returns table(teacher_id uuid)
language sql
stable
set search_path = ''
as $function$
  select distinct cta.teacher_id as teacher_id
  from public.class_teacher_assignments cta
  join public.profiles tp
    on tp.id = cta.teacher_id and tp.tenant_id = p_tenant
  where cta.tenant_id = p_tenant
    and cta.class_id = p_class
    and (cta.stream_id is null or cta.stream_id = p_stream)
    and tp.is_active
    and not coalesce(tp.access_revoked, false)
    and cta.academic_year = (
      select max(c2.academic_year)
      from public.class_teacher_assignments c2
      where c2.tenant_id = p_tenant and c2.class_id = p_class
    )
$function$;

-- The same admin-level list that bypasses user_has_permission (and homework_assert_staff).
create or replace function public.parent_msg_is_admin_level(p_tenant uuid)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce((
    select public.normalize_role_key(p.role) in ('admin', 'super admin', 'owner', 'principal', 'director')
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.tenant_id = p_tenant
          and public.normalize_role_key(ur.role_key) in ('admin', 'super admin', 'owner', 'principal', 'director')
      )
    from public.profiles p
    where p.id = auth.uid() and p.tenant_id = p_tenant
  ), false)
$function$;

create or replace function public.parent_msg_is_bursar(p_tenant uuid)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce((
    select public.normalize_role_key(p.role) = 'bursar'
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.tenant_id = p_tenant
          and public.normalize_role_key(ur.role_key) = 'bursar'
      )
    from public.profiles p
    where p.id = auth.uid() and p.tenant_id = p_tenant
  ), false)
$function$;

-- Can the signed-in staff member see a thread with this audience about this child?
create or replace function public.parent_msg_staff_can_see(
  p_tenant   uuid,
  p_audience text,
  p_student  uuid
)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select case
    when public.parent_msg_is_admin_level(p_tenant) then true
    when p_audience = 'bursar' then public.parent_msg_is_bursar(p_tenant)
    when p_audience = 'class_teacher' then exists (
      select 1
      from public.students s,
           public.parent_msg_class_teachers(p_tenant, s.class_id, s.stream_id) ct
      where s.id = p_student
        and s.tenant_id = p_tenant
        and ct.teacher_id = auth.uid()
    )
    else false
  end
$function$;

-- Staff guard. Returns the caller's tenant. With a thread id it also checks the thread is in
-- that tenant and that this staff member may see it (admin-level, the bursar for bursar
-- threads, a class teacher of the child for class-teacher threads).
create or replace function public.parent_msg_assert_staff(p_thread_id uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_thread record;
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
  if not public.user_has_permission(auth.uid(), v_tenant, 'reply-parent-messages') then
    raise exception 'Access denied: reply-parent-messages permission required' using errcode = '42501';
  end if;

  if p_thread_id is null then
    return v_tenant;
  end if;

  select t.tenant_id, t.audience, t.student_id
    into v_thread
  from public.parent_threads t
  where t.id = p_thread_id;

  if v_thread.tenant_id is null or v_thread.tenant_id <> v_tenant then
    raise exception 'Conversation not found';
  end if;
  if not public.parent_msg_staff_can_see(v_tenant, v_thread.audience, v_thread.student_id) then
    raise exception 'Conversation not found';
  end if;
  return v_tenant;
end;
$function$;

revoke all on function public.parent_msg_class_teachers(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.parent_msg_is_admin_level(uuid) from public, anon, authenticated;
revoke all on function public.parent_msg_is_bursar(uuid) from public, anon, authenticated;
revoke all on function public.parent_msg_staff_can_see(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.parent_msg_assert_staff(uuid) from public, anon, authenticated;
grant execute on function public.parent_msg_class_teachers(uuid, uuid, uuid) to service_role;
grant execute on function public.parent_msg_is_admin_level(uuid) to service_role;
grant execute on function public.parent_msg_is_bursar(uuid) to service_role;
grant execute on function public.parent_msg_staff_can_see(uuid, text, uuid) to service_role;
grant execute on function public.parent_msg_assert_staff(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Parent RPCs
-- ---------------------------------------------------------------------------
-- One row per linked child: may the parent message the school about them, and who is the
-- child's class teacher right now (null when there is none: such threads go to the office).
create or replace function public.get_my_message_options()
returns table(
  student_id         uuid,
  can_message_school boolean,
  class_teacher_name text
)
language plpgsql
stable
security definer
set search_path = ''
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
    s.id                 as student_id,
    psl.can_message_school as can_message_school,
    (
      select string_agg(distinct tp.full_name, ', ' order by tp.full_name)
      from public.parent_msg_class_teachers(v_caller_tenant, s.class_id, s.stream_id) ct
      join public.profiles tp on tp.id = ct.teacher_id
    )                    as class_teacher_name
  from public.parent_student_links psl
  join public.profiles p on p.id = psl.parent_id
  join public.students s on s.id = psl.student_id and s.tenant_id = v_caller_tenant
  where psl.parent_id = auth.uid()
    and psl.tenant_id = v_caller_tenant
    and psl.revoked_at is null
    and p.tenant_id = v_caller_tenant
    and p.is_active = true
    and p.access_revoked = false
    and public.normalize_role_key(p.role) = 'parent'
  order by s.full_name;
end;
$function$;

revoke all on function public.get_my_message_options() from public, anon;
grant execute on function public.get_my_message_options() to authenticated, service_role;

-- All of the caller's threads (every child they may message about), newest activity first.
-- is_unread: a staff message newer than the parent's own read mark.
create or replace function public.get_my_threads()
returns table(
  thread_id            uuid,
  student_id           uuid,
  student_name         text,
  audience             text,
  subject              text,
  status               text,
  closed_at            timestamptz,
  can_reopen           boolean,
  last_message_at      timestamptz,
  last_message_preview text,
  last_sender_kind     text,
  is_unread            boolean,
  created_at           timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
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
    t.id                      as thread_id,
    t.student_id              as student_id,
    s.full_name               as student_name,
    t.audience                as audience,
    t.subject                 as subject,
    t.status                  as status,
    t.closed_at               as closed_at,
    (t.status = 'closed' and t.closed_at >= now() - interval '14 days') as can_reopen,
    t.last_message_at         as last_message_at,
    left(lm.body, 120)        as last_message_preview,
    lm.sender_kind            as last_sender_kind,
    exists (
      select 1
      from public.parent_messages m
      where m.thread_id = t.id
        and m.sender_kind = 'staff'
        and (t.parent_last_read_at is null or m.created_at > t.parent_last_read_at)
    )                         as is_unread,
    t.created_at              as created_at
  from public.parent_threads t
  join public.parent_student_links psl
    on psl.student_id = t.student_id
   and psl.parent_id = auth.uid()
   and psl.tenant_id = v_caller_tenant
   and psl.revoked_at is null
   and psl.can_message_school
  join public.profiles p on p.id = psl.parent_id
  join public.students s on s.id = t.student_id and s.tenant_id = v_caller_tenant
  left join lateral (
    select m2.body as body, m2.sender_kind as sender_kind
    from public.parent_messages m2
    where m2.thread_id = t.id
    order by m2.created_at desc, m2.id desc
    limit 1
  ) lm on true
  where t.tenant_id = v_caller_tenant
    and t.parent_id = auth.uid()
    and p.tenant_id = v_caller_tenant
    and p.is_active = true
    and p.access_revoked = false
    and public.normalize_role_key(p.role) = 'parent'
  order by t.last_message_at desc, t.id
  limit 100;
end;
$function$;

revoke all on function public.get_my_threads() from public, anon;
grant execute on function public.get_my_threads() to authenticated, service_role;

-- Messages of one of the caller's own threads, oldest first (the latest 500 at most).
create or replace function public.get_my_thread_messages(p_thread_id uuid)
returns table(
  message_id  uuid,
  sender_kind text,
  sender_name text,
  body        text,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_thread record;
  v_tenant uuid;
begin
  select t.tenant_id, t.student_id, t.parent_id
    into v_thread
  from public.parent_threads t
  where t.id = p_thread_id;

  if v_thread.student_id is null then
    raise exception 'Conversation not found';
  end if;

  v_tenant := public.assert_parent_of(v_thread.student_id, 'can_message_school');
  if v_thread.tenant_id is distinct from v_tenant or v_thread.parent_id is distinct from auth.uid() then
    raise exception 'Conversation not found';
  end if;

  return query
  select x.mid as message_id, x.kind as sender_kind, x.sname as sender_name, x.mbody as body, x.mcreated as created_at
  from (
    select
      m.id          as mid,
      m.sender_kind as kind,
      sp.full_name  as sname,
      m.body        as mbody,
      m.created_at  as mcreated
    from public.parent_messages m
    left join public.profiles sp on sp.id = m.sender_id and sp.tenant_id = v_tenant
    where m.thread_id = p_thread_id
      and m.tenant_id = v_tenant
    order by m.created_at desc, m.id desc
    limit 500
  ) x
  order by x.mcreated, x.mid;
end;
$function$;

revoke all on function public.get_my_thread_messages(uuid) from public, anon;
grant execute on function public.get_my_thread_messages(uuid) to authenticated, service_role;

-- Starts a thread about one child. p_audience is class_teacher, bursar or admin; a
-- class_teacher thread for a class with no active class teacher is routed to admin.
-- Returns the thread id and where it was actually routed.
create or replace function public.create_my_thread(
  p_student_id uuid,
  p_audience   text,
  p_subject    text,
  p_body       text
)
returns table(
  new_thread_id    uuid,
  routed_audience  text
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant  uuid;
  v_subject text;
  v_body    text;
  v_class   uuid;
  v_stream  uuid;
  v_route   text;
  v_today   integer;
  v_id      uuid;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_message_school');

  if p_audience is null or p_audience not in ('class_teacher', 'bursar', 'admin') then
    raise exception 'Choose who to message';
  end if;
  v_subject := btrim(coalesce(p_subject, ''));
  if char_length(v_subject) < 1 or char_length(v_subject) > 120 then
    raise exception 'Subject is required (up to 120 characters)';
  end if;
  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'Message is required (up to 1000 characters)';
  end if;

  -- One parent cannot race past the daily limit with parallel requests.
  perform pg_advisory_xact_lock(hashtext('parent_threads:' || auth.uid()::text));

  select count(*)::integer
    into v_today
  from public.parent_threads t
  where t.parent_id = auth.uid()
    and t.tenant_id = v_tenant
    and t.created_at >= ((now() at time zone 'Africa/Nairobi')::date)::timestamp at time zone 'Africa/Nairobi';
  if v_today >= 10 then
    raise exception 'You have reached today''s limit of 10 new messages. Please reply in an existing conversation or try again tomorrow.';
  end if;

  select s.class_id, s.stream_id
    into v_class, v_stream
  from public.students s
  where s.id = p_student_id and s.tenant_id = v_tenant;

  v_route := p_audience;
  if p_audience = 'class_teacher'
     and (v_class is null or not exists (
       select 1 from public.parent_msg_class_teachers(v_tenant, v_class, v_stream)
     )) then
    v_route := 'admin';
  end if;

  insert into public.parent_threads as pt
    (tenant_id, student_id, parent_id, audience, subject)
  values
    (v_tenant, p_student_id, auth.uid(), v_route, v_subject)
  returning pt.id into v_id;

  insert into public.parent_messages as pm
    (thread_id, tenant_id, sender_id, sender_kind, body)
  values
    (v_id, v_tenant, auth.uid(), 'parent', v_body);

  return query select v_id as new_thread_id, v_route as routed_audience;
end;
$function$;

revoke all on function public.create_my_thread(uuid, text, text, text) from public, anon;
grant execute on function public.create_my_thread(uuid, text, text, text) to authenticated, service_role;

-- Parent reply in an open thread. A closed thread must be reopened first.
create or replace function public.send_my_thread_message(p_thread_id uuid, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_thread record;
  v_tenant uuid;
  v_body   text;
  v_id     uuid;
begin
  select t.tenant_id, t.student_id, t.parent_id, t.status
    into v_thread
  from public.parent_threads t
  where t.id = p_thread_id;

  if v_thread.student_id is null then
    raise exception 'Conversation not found';
  end if;

  v_tenant := public.assert_parent_of(v_thread.student_id, 'can_message_school');
  if v_thread.tenant_id is distinct from v_tenant or v_thread.parent_id is distinct from auth.uid() then
    raise exception 'Conversation not found';
  end if;
  if v_thread.status <> 'open' then
    raise exception 'This conversation is closed. Reopen it to reply.';
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'Message is required (up to 1000 characters)';
  end if;

  insert into public.parent_messages as pm
    (thread_id, tenant_id, sender_id, sender_kind, body)
  values
    (p_thread_id, v_tenant, auth.uid(), 'parent', v_body)
  returning pm.id into v_id;

  update public.parent_threads as t
  set last_message_at = now()
  where t.id = p_thread_id and t.tenant_id = v_tenant;

  return v_id;
end;
$function$;

revoke all on function public.send_my_thread_message(uuid, text) from public, anon;
grant execute on function public.send_my_thread_message(uuid, text) to authenticated, service_role;

-- Parent reopens a closed thread within 14 days of its closing. Idempotent on an open one.
create or replace function public.reopen_my_thread(p_thread_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_thread record;
  v_tenant uuid;
begin
  select t.tenant_id, t.student_id, t.parent_id, t.status, t.closed_at
    into v_thread
  from public.parent_threads t
  where t.id = p_thread_id;

  if v_thread.student_id is null then
    raise exception 'Conversation not found';
  end if;

  v_tenant := public.assert_parent_of(v_thread.student_id, 'can_message_school');
  if v_thread.tenant_id is distinct from v_tenant or v_thread.parent_id is distinct from auth.uid() then
    raise exception 'Conversation not found';
  end if;

  if v_thread.status = 'open' then
    return true;
  end if;
  if v_thread.closed_at < now() - interval '14 days' then
    raise exception 'This conversation was closed more than 14 days ago and cannot be reopened. Please start a new message.';
  end if;

  update public.parent_threads as t
  set status = 'open', closed_at = null, closed_by = null
  where t.id = p_thread_id and t.tenant_id = v_tenant;

  return true;
end;
$function$;

revoke all on function public.reopen_my_thread(uuid) from public, anon;
grant execute on function public.reopen_my_thread(uuid) to authenticated, service_role;

-- Marks the thread read up to p_seen_up_to (the newest message the parent actually saw;
-- null = now). Never moves the mark backwards or into the future.
create or replace function public.mark_my_thread_read(p_thread_id uuid, p_seen_up_to timestamptz default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_thread record;
  v_tenant uuid;
begin
  select t.tenant_id, t.student_id, t.parent_id
    into v_thread
  from public.parent_threads t
  where t.id = p_thread_id;

  if v_thread.student_id is null then
    raise exception 'Conversation not found';
  end if;

  v_tenant := public.assert_parent_of(v_thread.student_id, 'can_message_school');
  if v_thread.tenant_id is distinct from v_tenant or v_thread.parent_id is distinct from auth.uid() then
    raise exception 'Conversation not found';
  end if;

  update public.parent_threads as t
  set parent_last_read_at = greatest(
        coalesce(t.parent_last_read_at, '-infinity'::timestamptz),
        least(coalesce(p_seen_up_to, now()), now())
      )
  where t.id = p_thread_id and t.tenant_id = v_tenant;

  return true;
end;
$function$;

revoke all on function public.mark_my_thread_read(uuid, timestamptz) from public, anon;
grant execute on function public.mark_my_thread_read(uuid, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Staff RPCs (inbox)
-- ---------------------------------------------------------------------------
-- Threads this staff member may see, newest activity first (300 at most). p_status filters
-- to 'open' or 'closed'; null returns both. is_unread: a parent message newer than the
-- shared staff read mark.
create or replace function public.list_parent_threads(p_status text default null)
returns table(
  thread_id            uuid,
  student_id           uuid,
  student_name         text,
  admission_no         text,
  class_name           text,
  parent_name          text,
  relationship         text,
  audience             text,
  subject              text,
  status               text,
  flagged              boolean,
  last_message_at      timestamptz,
  last_message_preview text,
  last_sender_kind     text,
  is_unread            boolean,
  created_at           timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_admin  boolean;
  v_bursar boolean;
begin
  v_tenant := public.parent_msg_assert_staff();

  if p_status is not null and p_status not in ('open', 'closed') then
    raise exception 'Invalid status filter';
  end if;

  v_admin := public.parent_msg_is_admin_level(v_tenant);
  v_bursar := public.parent_msg_is_bursar(v_tenant);

  return query
  select
    t.id                     as thread_id,
    t.student_id             as student_id,
    s.full_name              as student_name,
    s.admission_no           as admission_no,
    c.name                   as class_name,
    pp.full_name             as parent_name,
    rel.relationship         as relationship,
    t.audience               as audience,
    t.subject                as subject,
    t.status                 as status,
    t.flagged                as flagged,
    t.last_message_at        as last_message_at,
    left(lm.body, 120)       as last_message_preview,
    lm.sender_kind           as last_sender_kind,
    exists (
      select 1
      from public.parent_messages m
      where m.thread_id = t.id
        and m.sender_kind = 'parent'
        and (t.staff_last_read_at is null or m.created_at > t.staff_last_read_at)
    )                        as is_unread,
    t.created_at             as created_at
  from public.parent_threads t
  join public.students s on s.id = t.student_id and s.tenant_id = v_tenant
  left join public.classes c on c.id = s.class_id
  left join public.profiles pp on pp.id = t.parent_id and pp.tenant_id = v_tenant
  left join lateral (
    select l.relationship as relationship
    from public.parent_student_links l
    where l.parent_id = t.parent_id and l.student_id = t.student_id and l.tenant_id = v_tenant
    order by l.revoked_at is not null, l.created_at desc
    limit 1
  ) rel on true
  left join lateral (
    select m2.body as body, m2.sender_kind as sender_kind
    from public.parent_messages m2
    where m2.thread_id = t.id
    order by m2.created_at desc, m2.id desc
    limit 1
  ) lm on true
  where t.tenant_id = v_tenant
    and (p_status is null or t.status = p_status)
    and (
      v_admin
      or (t.audience = 'bursar' and v_bursar)
      or (t.audience = 'class_teacher' and exists (
            select 1
            from public.parent_msg_class_teachers(v_tenant, s.class_id, s.stream_id) ct
            where ct.teacher_id = auth.uid()
          ))
    )
  order by t.last_message_at desc, t.id
  limit 300;
end;
$function$;

revoke all on function public.list_parent_threads(text) from public, anon;
grant execute on function public.list_parent_threads(text) to authenticated, service_role;

create or replace function public.get_parent_thread_messages(p_thread_id uuid)
returns table(
  message_id  uuid,
  sender_kind text,
  sender_name text,
  body        text,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.parent_msg_assert_staff(p_thread_id);

  return query
  select x.mid as message_id, x.kind as sender_kind, x.sname as sender_name, x.mbody as body, x.mcreated as created_at
  from (
    select
      m.id          as mid,
      m.sender_kind as kind,
      sp.full_name  as sname,
      m.body        as mbody,
      m.created_at  as mcreated
    from public.parent_messages m
    left join public.profiles sp on sp.id = m.sender_id and sp.tenant_id = v_tenant
    where m.thread_id = p_thread_id
      and m.tenant_id = v_tenant
    order by m.created_at desc, m.id desc
    limit 500
  ) x
  order by x.mcreated, x.mid;
end;
$function$;

revoke all on function public.get_parent_thread_messages(uuid) from public, anon;
grant execute on function public.get_parent_thread_messages(uuid) to authenticated, service_role;

-- Staff reply. A closed thread cannot be replied to: the parent may reopen it for 14 days.
create or replace function public.reply_parent_thread(p_thread_id uuid, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_status text;
  v_body   text;
  v_id     uuid;
begin
  v_tenant := public.parent_msg_assert_staff(p_thread_id);

  select t.status into v_status
  from public.parent_threads t
  where t.id = p_thread_id and t.tenant_id = v_tenant;
  if v_status is distinct from 'open' then
    raise exception 'This conversation is closed.';
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'Message is required (up to 1000 characters)';
  end if;

  insert into public.parent_messages as pm
    (thread_id, tenant_id, sender_id, sender_kind, body)
  values
    (p_thread_id, v_tenant, auth.uid(), 'staff', v_body)
  returning pm.id into v_id;

  update public.parent_threads as t
  set last_message_at = now()
  where t.id = p_thread_id and t.tenant_id = v_tenant;

  return v_id;
end;
$function$;

revoke all on function public.reply_parent_thread(uuid, text) from public, anon;
grant execute on function public.reply_parent_thread(uuid, text) to authenticated, service_role;

create or replace function public.close_parent_thread(p_thread_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.parent_msg_assert_staff(p_thread_id);

  update public.parent_threads as t
  set status = 'closed', closed_at = now(), closed_by = auth.uid()
  where t.id = p_thread_id and t.tenant_id = v_tenant and t.status = 'open';

  return true;
end;
$function$;

revoke all on function public.close_parent_thread(uuid) from public, anon;
grant execute on function public.close_parent_thread(uuid) to authenticated, service_role;

create or replace function public.set_parent_thread_flag(p_thread_id uuid, p_flagged boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.parent_msg_assert_staff(p_thread_id);

  update public.parent_threads as t
  set flagged = coalesce(p_flagged, false)
  where t.id = p_thread_id and t.tenant_id = v_tenant;

  return coalesce(p_flagged, false);
end;
$function$;

revoke all on function public.set_parent_thread_flag(uuid, boolean) from public, anon;
grant execute on function public.set_parent_thread_flag(uuid, boolean) to authenticated, service_role;

-- Same "seen up to" rule as the parent's mark; one mark shared by every staff member who
-- can see the thread.
create or replace function public.mark_parent_thread_read_staff(p_thread_id uuid, p_seen_up_to timestamptz default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.parent_msg_assert_staff(p_thread_id);

  update public.parent_threads as t
  set staff_last_read_at = greatest(
        coalesce(t.staff_last_read_at, '-infinity'::timestamptz),
        least(coalesce(p_seen_up_to, now()), now())
      )
  where t.id = p_thread_id and t.tenant_id = v_tenant;

  return true;
end;
$function$;

revoke all on function public.mark_parent_thread_read_staff(uuid, timestamptz) from public, anon;
grant execute on function public.mark_parent_thread_read_staff(uuid, timestamptz) to authenticated, service_role;
