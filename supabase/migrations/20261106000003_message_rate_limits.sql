-- Slice 7: per-message rate limits on parent messaging.
--   * a parent: 30 messages per Nairobi day across all threads (thread openers count, and
--     create_my_thread keeps its own cap of 10 new threads a day);
--   * a staff member: 200 replies per Nairobi day.
-- Replaces send_my_thread_message and reply_parent_thread from 20261105000010 with the same
-- behaviour plus the cap; signatures and grants are unchanged.

create index if not exists parent_messages_sender_day_idx
  on public.parent_messages (sender_id, created_at);

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
  v_today  integer;
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

  -- Daily cap (Nairobi day) on one parent's messages, counted across all threads. The lock stops
  -- parallel requests racing past it. Wording starts with "You have reached today" so the app shows it.
  perform pg_advisory_xact_lock(hashtext('parent_messages:' || auth.uid()::text));
  select count(*)::integer into v_today
  from public.parent_messages m
  where m.sender_id = auth.uid()
    and m.tenant_id = v_tenant
    and m.sender_kind = 'parent'
    and m.created_at >= ((now() at time zone 'Africa/Nairobi')::date)::timestamp at time zone 'Africa/Nairobi';
  if v_today >= 30 then
    raise exception 'You have reached today''s limit of 30 messages. Please try again tomorrow.';
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
  v_today  integer;
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

  -- Daily cap (Nairobi day) on one staff member's replies: a guard against a runaway script or a
  -- stuck button, well above what a person sends.
  perform pg_advisory_xact_lock(hashtext('parent_messages:' || auth.uid()::text));
  select count(*)::integer into v_today
  from public.parent_messages m
  where m.sender_id = auth.uid()
    and m.tenant_id = v_tenant
    and m.sender_kind = 'staff'
    and m.created_at >= ((now() at time zone 'Africa/Nairobi')::date)::timestamp at time zone 'Africa/Nairobi';
  if v_today >= 200 then
    raise exception 'You have reached today''s limit of 200 replies. Please try again tomorrow.';
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
