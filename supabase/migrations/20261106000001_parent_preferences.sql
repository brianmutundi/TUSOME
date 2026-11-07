-- Parent preferences (slice 6).
--
-- One row per parent: which reminders they want, in the app and by SMS. In-app is on by
-- default, SMS is opt-in (off by default). Three categories:
--   homework_due_tomorrow, event_reminders, reply_notifications
-- (columns of the same name are the in-app choice; sms_* are the SMS choice).
--
-- IMPORTANT: this stores choices only. No job exists that sends a homework or event
-- reminder, and nothing sends parents SMS. The only preference with an effect today is
-- reply_notifications (in-app): the parent app hides the unread-reply count when it is off.
--
-- Decisions:
--   * Per parent (profile), not per child: it follows the caller's own auth.uid() and tenant
--     claim, so there is no student id and no assert_parent_of call. The guard checks the
--     caller is an active parent in the claimed tenant.
--   * No row means defaults; get_my_preferences returns the defaults without writing.
--   * set_my_preferences takes all six values (null keeps the stored or default value) and
--     upserts. Tables are reachable only through the RPCs (no grants to anon/authenticated);
--     RLS, a tenant policy and the restrictive parent_block policy are defence in depth.
-- Not run against a database here.

create table if not exists public.parent_preferences (
  parent_id                uuid primary key references public.profiles (id) on delete cascade,
  tenant_id                uuid not null references public.tenants (id) on delete cascade,
  homework_due_tomorrow    boolean not null default true,
  event_reminders          boolean not null default true,
  reply_notifications      boolean not null default true,
  sms_homework_due_tomorrow boolean not null default false,
  sms_event_reminders      boolean not null default false,
  sms_reply_notifications  boolean not null default false,
  updated_at               timestamptz not null default now()
);

alter table public.parent_preferences enable row level security;

drop policy if exists parent_preferences_tenant on public.parent_preferences;
create policy parent_preferences_tenant on public.parent_preferences
  for select to authenticated
  using (tenant_id = public.my_tenant_id());

drop policy if exists parent_block on public.parent_preferences;
create policy parent_block on public.parent_preferences as restrictive for all to authenticated
  using ((select not public.is_parent())) with check ((select not public.is_parent()));

revoke all on public.parent_preferences from public, anon, authenticated;
grant all on public.parent_preferences to service_role;

create or replace function public.get_my_preferences()
returns table(
  homework_due_tomorrow     boolean,
  event_reminders           boolean,
  reply_notifications       boolean,
  sms_homework_due_tomorrow boolean,
  sms_event_reminders       boolean,
  sms_reply_notifications   boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;
  if v_tenant is null then
    raise exception 'Missing tenant claim';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.tenant_id = v_tenant
      and p.is_active = true
      and p.access_revoked = false
      and public.normalize_role_key(p.role) = 'parent'
  ) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
  select
    coalesce(pp.homework_due_tomorrow, true),
    coalesce(pp.event_reminders, true),
    coalesce(pp.reply_notifications, true),
    coalesce(pp.sms_homework_due_tomorrow, false),
    coalesce(pp.sms_event_reminders, false),
    coalesce(pp.sms_reply_notifications, false)
  from (select 1) one
  left join public.parent_preferences pp
    on pp.parent_id = auth.uid() and pp.tenant_id = v_tenant;
end;
$function$;

revoke all on function public.get_my_preferences() from public, anon;
grant execute on function public.get_my_preferences() to authenticated, service_role;

create or replace function public.set_my_preferences(
  p_homework_due_tomorrow     boolean,
  p_event_reminders           boolean,
  p_reply_notifications       boolean,
  p_sms_homework_due_tomorrow boolean,
  p_sms_event_reminders       boolean,
  p_sms_reply_notifications   boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  begin
    v_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_tenant := null;
  end;
  if v_tenant is null then
    raise exception 'Missing tenant claim';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.tenant_id = v_tenant
      and p.is_active = true
      and p.access_revoked = false
      and public.normalize_role_key(p.role) = 'parent'
  ) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  insert into public.parent_preferences as pp (
    parent_id, tenant_id,
    homework_due_tomorrow, event_reminders, reply_notifications,
    sms_homework_due_tomorrow, sms_event_reminders, sms_reply_notifications
  ) values (
    auth.uid(), v_tenant,
    coalesce(p_homework_due_tomorrow, true),
    coalesce(p_event_reminders, true),
    coalesce(p_reply_notifications, true),
    coalesce(p_sms_homework_due_tomorrow, false),
    coalesce(p_sms_event_reminders, false),
    coalesce(p_sms_reply_notifications, false)
  )
  on conflict (parent_id) do update set
    homework_due_tomorrow     = coalesce(p_homework_due_tomorrow, pp.homework_due_tomorrow),
    event_reminders           = coalesce(p_event_reminders, pp.event_reminders),
    reply_notifications       = coalesce(p_reply_notifications, pp.reply_notifications),
    sms_homework_due_tomorrow = coalesce(p_sms_homework_due_tomorrow, pp.sms_homework_due_tomorrow),
    sms_event_reminders       = coalesce(p_sms_event_reminders, pp.sms_event_reminders),
    sms_reply_notifications   = coalesce(p_sms_reply_notifications, pp.sms_reply_notifications),
    updated_at                = now()
  where pp.tenant_id = v_tenant;

  return true;
end;
$function$;

revoke all on function public.set_my_preferences(boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_my_preferences(boolean, boolean, boolean, boolean, boolean, boolean) to authenticated, service_role;
