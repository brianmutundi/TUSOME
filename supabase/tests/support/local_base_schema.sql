-- ===========================================================================
-- LOCAL TEST SUPPORT ONLY -- NOT A MIGRATION -- DO NOT RUN ON PRODUCTION
-- ===========================================================================
-- The TUSOME repository contains only the analytics migrations, not the base
-- application schema. This file reconstructs the *minimum* base objects the
-- analytics migrations and tests depend on, so they can be executed against a
-- disposable PostgreSQL instance.
--
-- It was derived from schema metadata previously read from the live project
-- (column names, nullability, constraints, helper functions and RLS policy
-- shape). It is NOT a faithful copy of production, it creates no
-- supabase_migrations rows, and it must never be applied to a real project.
--
-- Known simplifications vs. production:
--   * auth.users has only (id, email); production has the full GoTrue table.
--   * audit/notification/teacher-assignment tables and triggers are omitted.
--   * policies keep the tenant/ownership shape but not every production clause.
--   * only the marks "published exam" guard trigger is reproduced.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Roles (Supabase-managed in production)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin noinherit';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin noinherit';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'create role service_role nologin noinherit bypassrls';
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- auth schema shims (production: GoTrue + PostgREST helpers)
-- ---------------------------------------------------------------------------
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    current_user::text
  )
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role()
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Core tenant tables
-- ---------------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  full_name text,
  role text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table streams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  admission_no text not null,
  full_name text not null,
  class_id uuid references classes (id) on delete set null,
  stream_id uuid references streams (id) on delete set null,
  gender text,
  created_at timestamptz not null default now()
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  term text,
  academic_year integer
    check (academic_year is null or (academic_year between 2000 and 2100)),
  assessment_component text
    check (assessment_component is null
           or assessment_component in ('test_exam', 'mid_term', 'end_term', 'annual')),
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'reopened')),
  created_at timestamptz not null default now()
);

create table exam_classes (
  exam_id uuid not null references exams (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  primary key (exam_id, class_id)
);

create table student_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  academic_year integer not null,
  class_id uuid not null references classes (id) on delete cascade,
  stream_id uuid references streams (id) on delete set null,
  created_at timestamptz not null default now()
);

create table marks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  exam_id uuid not null references exams (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 100),
  created_at timestamptz not null default now(),
  unique (exam_id, student_id, subject_id)
);

create table grading_configurations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  mode text,
  active boolean not null default true,
  school_level text not null default 'default',
  grade_level text,
  created_at timestamptz not null default now()
);

-- Production enforces one active configuration per tenant/school level.
create unique index grading_configurations_active_level_uniq
  on grading_configurations (tenant_id, school_level)
  where active;

create table grading_configuration_levels (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references grading_configurations (id) on delete cascade,
  code text not null,
  min_percent numeric not null,
  max_percent numeric not null,
  points integer,
  name text not null,
  broad text,
  color text,
  sort_order integer
);

-- ---------------------------------------------------------------------------
-- Helper functions (production: SECURITY DEFINER, read the caller's profile)
-- ---------------------------------------------------------------------------
create or replace function public.my_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

grant execute on function public.my_tenant_id(), public.is_admin()
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Marks guard: published exams are read-only (mirrors production trigger;
-- tests disable user triggers while loading fixtures, as they would locally).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_marks_editable()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.exams where id = new.exam_id;
  if v_status = 'published' then
    raise exception 'Marks cannot be modified for a published exam';
  end if;
  return new;
end;
$$;

create trigger marks_editable_guard
  before insert or update on public.marks
  for each row execute function public.enforce_marks_editable();

-- ---------------------------------------------------------------------------
-- Row level security (tenant-scoped shape as verified in production)
-- ---------------------------------------------------------------------------
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table classes enable row level security;
alter table streams enable row level security;
alter table subjects enable row level security;
alter table students enable row level security;
alter table exams enable row level security;
alter table exam_classes enable row level security;
alter table student_enrollments enable row level security;
alter table marks enable row level security;
alter table grading_configurations enable row level security;
alter table grading_configuration_levels enable row level security;

create policy tenants_tenant on tenants
  for select using (id = my_tenant_id());

create policy profiles_tenant on profiles
  for select using (tenant_id = my_tenant_id() or id = auth.uid());

create policy classes_tenant on classes
  for select using (tenant_id = my_tenant_id());

create policy streams_tenant on streams
  for select using (
    tenant_id = my_tenant_id()
    and exists (select 1 from classes c where c.id = streams.class_id and c.tenant_id = my_tenant_id())
  );

create policy subjects_tenant on subjects
  for select using (tenant_id = my_tenant_id());

create policy students_tenant on students
  for select using (tenant_id = my_tenant_id());

create policy exams_tenant on exams
  for select using (tenant_id = my_tenant_id());

create policy exam_classes_tenant on exam_classes
  for select using (
    exists (select 1 from exams e where e.id = exam_classes.exam_id and e.tenant_id = my_tenant_id())
  );

create policy student_enrollments_tenant on student_enrollments
  for select using (
    tenant_id = my_tenant_id()
    and exists (select 1 from students s where s.id = student_enrollments.student_id and s.tenant_id = my_tenant_id())
    and exists (select 1 from classes c where c.id = student_enrollments.class_id and c.tenant_id = my_tenant_id())
  );

create policy marks_select_scoped on marks
  for select using (
    tenant_id = my_tenant_id()
    and exists (select 1 from exams e where e.id = marks.exam_id and e.tenant_id = my_tenant_id())
    and exists (select 1 from students s where s.id = marks.student_id and s.tenant_id = my_tenant_id())
  );

create policy grading_configurations_tenant on grading_configurations
  for select using (tenant_id = my_tenant_id());

create policy grading_configuration_levels_tenant on grading_configuration_levels
  for select using (
    config_id in (select id from grading_configurations where tenant_id = my_tenant_id())
  );

-- Table privileges. Production grants broad privileges to authenticated and
-- relies on RLS; anon has no analytics access.
grant select on tenants, profiles, classes, streams, subjects, students, exams,
  exam_classes, student_enrollments, marks, grading_configurations,
  grading_configuration_levels
  to authenticated, service_role;
