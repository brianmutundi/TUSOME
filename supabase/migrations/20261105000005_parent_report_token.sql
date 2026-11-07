-- Parent-side report card link, mirroring create_my_child_statement_token.
--
-- The public /report/[token] page resolves report_share_tokens through
-- get_shared_report. The staff creator (create_report_share_token) is admin-only,
-- so parents had no way to open a report card. This adds a parent entry point:
-- the caller must be a parent of the child with academics access, and the exam
-- must be published in the child's tenant.
--
-- report_share_tokens is only referenced (never created) in the repository
-- migrations, so it is created here if missing. If it already exists the
-- statement is a no-op. RLS is on with no policies: only SECURITY DEFINER
-- functions and service_role touch it.
-- Not run against a database here.

create table if not exists public.report_share_tokens (
  token      text primary key,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  exam_id    uuid not null references public.exams (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.report_share_tokens enable row level security;

create or replace function public.create_my_child_report_token(
  p_student_id uuid,
  p_exam_id    uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_token  text;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_academics');

  if not exists (
    select 1
    from public.exams e
    where e.id = p_exam_id
      and e.tenant_id = v_tenant
      and e.status = 'published'
  ) then
    raise exception 'Exam not found or not published';
  end if;

  -- The child must actually have marks in this exam.
  if not exists (
    select 1
    from public.marks m
    where m.exam_id = p_exam_id
      and m.student_id = p_student_id
      and m.tenant_id = v_tenant
  ) then
    raise exception 'No results for this exam';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.report_share_tokens (token, tenant_id, student_id, exam_id, expires_at)
  values (v_token, v_tenant, p_student_id, p_exam_id, now() + interval '7 days');

  return v_token;
end;
$function$;

revoke all on function public.create_my_child_report_token(uuid, uuid) from public, anon;
grant execute on function public.create_my_child_report_token(uuid, uuid) to authenticated, service_role;
