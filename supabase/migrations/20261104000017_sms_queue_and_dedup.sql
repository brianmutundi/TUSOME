-- 20261104000017_sms_queue_and_dedup.sql
--
-- 1. SMS log unique per document (receipt/statement) + phone number + message_type
--    so retrying an SMS for the same receipt/statement and recipient never creates
--    a duplicate message_log row, while still allowing the same receipt to be sent
--    to a different guardian phone number.
-- 2. log_message inserts status = 'queued' (with sent_at = null) so get_pending_sms
--    returns queued messages to the companion Android gateway and the UI remains
--    "Queued" until update_sms_status reports 'sent'/'delivered' or 'failed'.
-- 3. Finance staff (manage-fees / view-fees) can queue document-linked SMS
--    (receipts and fee statements) in addition to compose-send-sms holders.

alter table public.message_log add column if not exists document_id uuid;

-- Deduplicate any pre-existing rows with document_id before creating the unique index
delete from public.message_log a
using public.message_log b
where a.document_id is not null
  and a.tenant_id = b.tenant_id
  and a.document_id = b.document_id
  and a.phone_numbers = b.phone_numbers
  and a.message_type = b.message_type
  and a.ctid < b.ctid;

drop index if exists public.message_log_tenant_doc_type_unique;

create unique index if not exists message_log_tenant_doc_phone_type_unique
  on public.message_log (tenant_id, document_id, phone_numbers, message_type)
  where document_id is not null;

drop function if exists public.log_message(text, uuid[], text, text, text, text[], integer, integer, uuid);
drop function if exists public.log_message(text, uuid[], text, text, text, text[], integer, integer, uuid, uuid);

create or replace function public.log_message(
  p_recipient_type text,
  p_recipient_ids uuid[] default array[]::uuid[],
  p_message_type text default 'text',
  p_subject text default null,
  p_message_body text default '',
  p_phone_numbers text[] default array[]::text[],
  p_recipient_count integer default 0,
  p_credits_used integer default 0,
  p_exam_id uuid default null,
  p_document_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_caller_tenant uuid;
  v_role text;
  v_message_id uuid;
begin
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;

  begin
    v_caller_tenant := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    v_caller_tenant := null;
  end;

  if v_caller_tenant is null then
    raise exception 'Missing tenant claim';
  end if;

  if v_role is distinct from 'service_role' then
    if not (
      public.user_has_permission(auth.uid(), v_caller_tenant, 'compose-send-sms')
      or (
        p_document_id is not null
        and (
          public.user_has_permission(auth.uid(), v_caller_tenant, 'manage-fees')
          or public.user_has_permission(auth.uid(), v_caller_tenant, 'view-fees')
        )
      )
    ) then
      raise exception 'Access denied: compose-send-sms permission required' using errcode = '42501';
    end if;
  end if;

  if p_recipient_type not in (
    'all_parents', 'all_teachers', 'all_staff', 'specific_classes',
    'specific_teachers', 'specific_staff', 'specific_students', 'alumni', 'others', 'keyed_in'
  ) then
    raise exception 'Invalid recipient type';
  end if;

  if p_message_type not in ('text', 'exam_results', 'fee_info', 'graduation_class', 'credentials') then
    raise exception 'Invalid message type';
  end if;

  if btrim(coalesce(p_message_body, '')) = '' then
    raise exception 'Message body is required';
  end if;

  if p_document_id is not null then
    insert into public.message_log (
      tenant_id, sender_id, recipient_type, recipient_ids, message_type,
      subject, message_body, phone_numbers, recipient_count, credits_used,
      status, exam_id, document_id, sent_at
    )
    values (
      v_caller_tenant,
      case when v_role is distinct from 'service_role' then auth.uid() else null end,
      p_recipient_type,
      coalesce(p_recipient_ids, array[]::uuid[]),
      p_message_type,
      nullif(btrim(coalesce(p_subject, '')), ''),
      btrim(p_message_body),
      coalesce(p_phone_numbers, array[]::text[]),
      coalesce(p_recipient_count, 0),
      coalesce(p_credits_used, 0),
      'queued',
      p_exam_id,
      p_document_id,
      null
    )
    on conflict (tenant_id, document_id, phone_numbers, message_type) where document_id is not null
    do update set
      status = case when public.message_log.status = 'failed' then 'queued' else public.message_log.status end,
      message_body = case when public.message_log.status = 'failed' then excluded.message_body else public.message_log.message_body end
    returning id into v_message_id;
  else
    insert into public.message_log (
      tenant_id, sender_id, recipient_type, recipient_ids, message_type,
      subject, message_body, phone_numbers, recipient_count, credits_used,
      status, exam_id, document_id, sent_at
    )
    values (
      v_caller_tenant,
      case when v_role is distinct from 'service_role' then auth.uid() else null end,
      p_recipient_type,
      coalesce(p_recipient_ids, array[]::uuid[]),
      p_message_type,
      nullif(btrim(coalesce(p_subject, '')), ''),
      btrim(p_message_body),
      coalesce(p_phone_numbers, array[]::text[]),
      coalesce(p_recipient_count, 0),
      coalesce(p_credits_used, 0),
      'queued',
      p_exam_id,
      null,
      null
    )
    returning id into v_message_id;
  end if;

  return v_message_id;
end;
$function$;

revoke all on function public.log_message(text, uuid[], text, text, text, text[], integer, integer, uuid, uuid) from public, anon;
grant execute on function public.log_message(text, uuid[], text, text, text, text[], integer, integer, uuid, uuid) to authenticated, service_role;
