-- 20261104000019_parent_portal_rpcs.sql
--
-- Fixed and new parent-portal RPCs for Phase 1.
--
-- FIXES:
--   get_my_child_fees     — per-line balance via payment_allocations
--   create_my_child_receipt_token — no longer requires payment_id
-- NEW:
--   get_current_term
--   get_my_child_overview
--   get_my_child_exam_summary
--   get_my_child_attendance (term-scoped)
--   get_my_child_absences
--   get_my_notices
--   mark_notices_read
--   get_my_child_report
--   log_parent_access

-- ---------------------------------------------------------------------------
-- helper: get_current_term(p_tenant_id)
-- ---------------------------------------------------------------------------
create or replace function public.get_current_term(p_tenant_id uuid)
returns table(academic_year integer, term text)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  return query
  select td.academic_year, td.term
  from public.term_dates td
  where td.tenant_id = p_tenant_id
  order by
    case
      when current_date between td.opening_date and td.closing_date then 0
      when td.opening_date <= current_date then 1
      else 2
    end,
    td.opening_date desc
  limit 1;
end;
$function$;

revoke all on function public.get_current_term(uuid) from public, anon;
grant execute on function public.get_current_term(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- helper: log_parent_access
-- ---------------------------------------------------------------------------
create or replace function public.log_parent_access(
  p_student_id uuid,
  p_section    text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
begin
  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;

  if v_tenant is null then return; end if;

  insert into public.audit_events (
    tenant_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    v_tenant,
    auth.uid(),
    'parent_view',
    p_section,
    p_student_id,
    jsonb_build_object('student_id', p_student_id, 'section', p_section)
  )
  on conflict do nothing;
exception when others then
  -- logging must never break the actual read
  null;
end;
$function$;

revoke all on function public.log_parent_access(uuid, text) from public, anon;
grant execute on function public.log_parent_access(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_my_child_fees — FIXED: per-line balance via payment_allocations
-- ---------------------------------------------------------------------------
create or replace function public.get_my_child_fees(
  p_student_id  uuid,
  p_academic_year integer default null,
  p_term          text    default null
)
returns table(
  vote_head_id   uuid,
  vote_head_name text,
  charged        numeric,
  paid           numeric,
  waived         numeric,
  balance        numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant  uuid;
  v_period  record;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_fees');

  -- Resolve term if not supplied
  if p_academic_year is null or p_term is null then
    select ct.academic_year, ct.term into v_period
    from public.get_current_term(v_tenant) ct;
  else
    v_period.academic_year := p_academic_year;
    v_period.term          := p_term;
  end if;

  if v_period.academic_year is null then
    return;
  end if;

  return query
  select
    fs.id                               as vote_head_id,
    fs.name                             as vote_head_name,
    fs.amount                           as charged,
    coalesce(alloc.paid, 0)             as paid,
    coalesce(wv.waived, 0)              as waived,
    fs.amount
      - coalesce(alloc.paid, 0)
      - coalesce(wv.waived, 0)          as balance
  from public.fee_structures fs
  join public.students s
    on s.id        = p_student_id
   and s.class_id  = fs.class_id
   and s.tenant_id = fs.tenant_id
  -- Net paid per fee-structure line via payment_allocations
  left join lateral (
    select
      coalesce(sum(
        case when coalesce(fp.type, 'payment') = 'reversal'
             then -pa.amount
             else  pa.amount
        end
      ), 0) as paid
    from public.payment_allocations pa
    join public.fee_payments fp on fp.id = pa.payment_id
    where pa.fee_structure_id = fs.id
      and fp.student_id       = p_student_id
      and fp.tenant_id        = v_tenant
  ) alloc on true
  -- Approved waivers scoped per fee-structure line
  left join lateral (
    select coalesce(sum(fw.amount), 0) as waived
    from public.fee_waivers fw
    where fw.student_id      = p_student_id
      and fw.tenant_id       = v_tenant
      and fw.fee_structure_id = fs.id
      and fw.status          = 'approved'
      and fw.applied_at      is not null
  ) wv on true
  where fs.tenant_id      = v_tenant
    and fs.is_active       = true
    and fs.academic_year   = v_period.academic_year
    and fs.term            = v_period.term
  order by fs.name;

  perform public.log_parent_access(p_student_id, 'fees');
end;
$function$;

revoke all on function public.get_my_child_fees(uuid, integer, text) from public, anon;
grant execute on function public.get_my_child_fees(uuid, integer, text) to authenticated, service_role;

-- Drop old single-arg version if it exists
drop function if exists public.get_my_child_fees(uuid);

-- ---------------------------------------------------------------------------
-- get_my_child_overview
-- ---------------------------------------------------------------------------
create or replace function public.get_my_child_overview(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant       uuid;
  v_link         record;
  v_period       record;
  v_balance      numeric := null;
  v_exam_name    text    := null;
  v_exam_mean    numeric := null;
  v_attend_rate  numeric := null;
  v_notices      integer := 0;
  v_result       jsonb;
begin
  -- assert_parent_of with no right: just check link exists
  v_tenant := public.assert_parent_of(p_student_id);

  -- Load link rights
  select psl.*
  into v_link
  from public.parent_student_links psl
  where psl.parent_id  = auth.uid()
    and psl.student_id = p_student_id
    and psl.revoked_at is null
  limit 1;

  -- Current term
  select ct.academic_year, ct.term into v_period
  from public.get_current_term(v_tenant) ct;

  -- Balance owed (fees)
  if v_link.can_view_fees and v_period.academic_year is not null then
    select coalesce(sum(greatest(f.balance, 0)), 0)
    into v_balance
    from public.get_my_child_fees(p_student_id, v_period.academic_year, v_period.term) f;
  end if;

  -- Latest published exam mean
  if v_link.can_view_academics then
    select e.name, ep.mean_score
    into v_exam_name, v_exam_mean
    from public.exam_performance ep
    join public.exams e on e.id = ep.exam_id
    where ep.student_id = p_student_id
      and ep.tenant_id  = v_tenant
      and e.status      = 'published'
    order by e.created_at desc
    limit 1;
  end if;

  -- Attendance rate this term
  if v_link.can_view_attendance and v_period.academic_year is not null then
    select
      round(
        100.0 * sum(case when da.status = 'present' then 1 else 0 end)
             / nullif(count(*), 0),
        1
      )
    into v_attend_rate
    from public.daily_attendance da
    where da.student_id    = p_student_id
      and da.tenant_id     = v_tenant
      and extract(year from da.date) = v_period.academic_year;
  end if;

  -- Unread notices
  select count(*)
  into v_notices
  from public.notices n
  where n.tenant_id   = v_tenant
    and n.is_published = true
    and (n.expires_at is null or n.expires_at > now())
    and n.audience    in ('all', 'parents')
    and not exists (
      select 1 from public.parent_notice_reads r
      where r.parent_id = auth.uid() and r.notice_id = n.id
    );

  v_result := jsonb_build_object(
    'balance_owed',         v_balance,
    'latest_exam_name',     v_exam_name,
    'latest_exam_mean',     v_exam_mean,
    'attendance_rate',      v_attend_rate,
    'unread_notices_count', v_notices,
    'academic_year',        v_period.academic_year,
    'term',                 v_period.term
  );

  perform public.log_parent_access(p_student_id, 'overview');
  return v_result;
end;
$function$;

revoke all on function public.get_my_child_overview(uuid) from public, anon;
grant execute on function public.get_my_child_overview(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_my_child_exam_summary
-- ---------------------------------------------------------------------------
create or replace function public.get_my_child_exam_summary(p_student_id uuid)
returns table(
  exam_id        uuid,
  exam_name      text,
  term           text,
  academic_year  integer,
  mean_score     numeric,
  cbc_level      text,
  grade          text,
  class_position integer,
  class_size     integer,
  published_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant  uuid;
  v_show_pos boolean := false;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_academics');

  -- Read visibility setting
  select coalesce(pps.show_class_position, false)
  into v_show_pos
  from public.parent_portal_settings pps
  where pps.tenant_id = v_tenant
  limit 1;

  return query
  select
    e.id,
    e.name,
    e.term,
    e.academic_year,
    ep.mean_score,
    ep.cbc_level,
    ep.grade,
    case when v_show_pos then ep.class_position else null end,
    case when v_show_pos then ep.class_size     else null end,
    e.published_at
  from public.exam_performance ep
  join public.exams e on e.id = ep.exam_id and e.tenant_id = v_tenant
  where ep.student_id = p_student_id
    and ep.tenant_id  = v_tenant
    and e.status      = 'published'
    and (
      e.results_release_date is null
      or e.results_release_date <= now()
    )
  order by e.academic_year desc nulls last, e.term desc nulls last, e.created_at desc;

  perform public.log_parent_access(p_student_id, 'results');
end;
$function$;

revoke all on function public.get_my_child_exam_summary(uuid) from public, anon;
grant execute on function public.get_my_child_exam_summary(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_my_child_attendance (term-scoped, replaces the old version)
-- ---------------------------------------------------------------------------
drop function if exists public.get_my_child_attendance(uuid, integer);

create or replace function public.get_my_child_attendance(
  p_student_id    uuid,
  p_academic_year integer default null,
  p_term          text    default null
)
returns table(
  status text,
  days   bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
  v_period record;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_attendance');

  if p_academic_year is null then
    select ct.academic_year, ct.term into v_period
    from public.get_current_term(v_tenant) ct;
  else
    v_period.academic_year := p_academic_year;
    v_period.term          := p_term;
  end if;

  return query
  select da.status, count(*)::bigint as days
  from public.daily_attendance da
  where da.student_id = p_student_id
    and da.tenant_id  = v_tenant
    and extract(year from da.date)::integer = coalesce(v_period.academic_year, extract(year from current_date)::integer)
  group by da.status
  order by da.status;

  perform public.log_parent_access(p_student_id, 'attendance');
end;
$function$;

revoke all on function public.get_my_child_attendance(uuid, integer, text) from public, anon;
grant execute on function public.get_my_child_attendance(uuid, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_my_child_absences
-- ---------------------------------------------------------------------------
create or replace function public.get_my_child_absences(
  p_student_id    uuid,
  p_academic_year integer default null,
  p_term          text    default null
)
returns table(
  absence_date date,
  status       text,
  reason       text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
  v_period record;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_attendance');

  if p_academic_year is null then
    select ct.academic_year, ct.term into v_period
    from public.get_current_term(v_tenant) ct;
  else
    v_period.academic_year := p_academic_year;
    v_period.term          := p_term;
  end if;

  return query
  select
    da.date,
    da.status,
    da.absence_reason
  from public.daily_attendance da
  where da.student_id = p_student_id
    and da.tenant_id  = v_tenant
    and da.status     <> 'present'
    and extract(year from da.date)::integer = coalesce(v_period.academic_year, extract(year from current_date)::integer)
  order by da.date desc
  limit 200;
end;
$function$;

revoke all on function public.get_my_child_absences(uuid, integer, text) from public, anon;
grant execute on function public.get_my_child_absences(uuid, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_my_notices
-- ---------------------------------------------------------------------------
create or replace function public.get_my_notices(
  p_limit  integer default 20,
  p_before uuid    default null
)
returns table(
  notice_id    uuid,
  title        text,
  content      text,
  is_urgent    boolean,
  audience     text,
  created_at   timestamptz,
  is_read      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant   uuid;
  v_classes  uuid[];
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;
  if v_tenant is null then raise exception 'Missing tenant claim'; end if;

  -- Collect classes of linked children
  select array_agg(distinct s.class_id)
  into v_classes
  from public.parent_student_links psl
  join public.students s on s.id = psl.student_id
  where psl.parent_id  = auth.uid()
    and psl.tenant_id  = v_tenant
    and psl.revoked_at is null;

  return query
  select
    n.id,
    n.title,
    n.content,
    coalesce(n.is_urgent, false),
    n.audience,
    n.created_at,
    exists (
      select 1 from public.parent_notice_reads r
      where r.parent_id = auth.uid() and r.notice_id = n.id
    ) as is_read
  from public.notices n
  where n.tenant_id    = v_tenant
    and n.is_published  = true
    and (n.expires_at is null or n.expires_at > now())
    and n.audience      in ('all', 'parents')
    and (
      n.target_class_id  is null
      or n.target_class_id = any(v_classes)
    )
    and (
      p_before is null
      or n.created_at < (select n2.created_at from public.notices n2 where n2.id = p_before)
    )
  order by coalesce(n.is_urgent, false) desc, n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end;
$function$;

revoke all on function public.get_my_notices(integer, uuid) from public, anon;
grant execute on function public.get_my_notices(integer, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- mark_notices_read
-- ---------------------------------------------------------------------------
create or replace function public.mark_notices_read(p_notice_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then v_tenant := null; end;
  if v_tenant is null then raise exception 'Missing tenant claim'; end if;

  insert into public.parent_notice_reads (tenant_id, parent_id, notice_id)
  select v_tenant, auth.uid(), unnest(p_notice_ids)
  on conflict (parent_id, notice_id) do nothing;
end;
$function$;

revoke all on function public.mark_notices_read(uuid[]) from public, anon;
grant execute on function public.mark_notices_read(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_my_child_report
-- ---------------------------------------------------------------------------
create or replace function public.get_my_child_report(
  p_student_id uuid,
  p_exam_id    uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant   uuid;
  v_settings record;
  v_balance  numeric;
  v_report   jsonb;
begin
  v_tenant := public.assert_parent_of(p_student_id, 'can_view_academics');

  -- Check visibility settings
  select pps.hold_report_until_fees_cleared,
         coalesce(pps.hold_threshold_amount, 0) as hold_threshold_amount
  into v_settings
  from public.parent_portal_settings pps
  where pps.tenant_id = v_tenant
  limit 1;

  if coalesce(v_settings.hold_report_until_fees_cleared, false) then
    select coalesce(sum(greatest(f.balance, 0)), 0)
    into v_balance
    from public.get_my_child_fees(p_student_id) f;

    if v_balance > coalesce(v_settings.hold_threshold_amount, 0) then
      return jsonb_build_object(
        'held', true,
        'reason', 'Report card available after fees are cleared. Contact the school office.'
      );
    end if;
  end if;

  -- Verify exam is published
  if not exists (
    select 1 from public.exams e
    where e.id = p_exam_id and e.tenant_id = v_tenant and e.status = 'published'
  ) then
    raise exception 'Exam not found or not published';
  end if;

  -- Delegate to existing get_student_report (staff function reused)
  select public.get_student_report(p_student_id, p_exam_id) into v_report;

  perform public.log_parent_access(p_student_id, 'report_card');
  return v_report;
exception
  when sqlstate 'P0001' then
    raise; -- re-raise expected exceptions
end;
$function$;

revoke all on function public.get_my_child_report(uuid, uuid) from public, anon;
grant execute on function public.get_my_child_report(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_my_child_receipt_token — FIXED: authorise via student link
-- ---------------------------------------------------------------------------
create or replace function public.create_my_child_receipt_token(p_receipt_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  v_tenant     uuid;
  v_receipt    record;
  v_student_id uuid;
  v_token      text;
  v_hash       text;
  v_expires    timestamptz;
begin
  -- Load receipt
  select r.*, fp.student_id as payment_student_id
  into v_receipt
  from public.receipts r
  left join public.fee_payments fp on fp.id = r.payment_id
  where r.id = p_receipt_id;

  if not found then
    raise exception 'Receipt not found';
  end if;

  -- Resolve student_id: prefer payment's student, fall back to receipt's own
  v_student_id := coalesce(v_receipt.payment_student_id, v_receipt.student_id);

  if v_student_id is null then
    raise exception 'Receipt has no student reference';
  end if;

  -- Auth: caller must be a linked parent of that student
  v_tenant := public.assert_parent_of(v_student_id, 'can_view_fees');

  -- Generate or return existing token
  v_expires := now() + interval '30 days';
  v_token   := encode(gen_random_bytes(24), 'base64url');
  v_hash    := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.document_share_tokens (
    tenant_id, document_id, document_type, token_hash, expires_at
  ) values (
    v_tenant, p_receipt_id, 'receipt', v_hash, v_expires
  )
  on conflict (token_hash) do nothing;

  return v_token;
end;
$function$;

revoke all on function public.create_my_child_receipt_token(uuid) from public, anon;
grant execute on function public.create_my_child_receipt_token(uuid) to authenticated, service_role;
