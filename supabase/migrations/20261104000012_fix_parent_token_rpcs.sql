-- Fix: parent-scoped token RPCs still called the pre-unification token functions
-- (create_receipt_share_token / create_statement_share_token), which no longer
-- exist. Introduce one internal token writer that both the staff and parent
-- entry points use, so there is a single implementation of token creation.

create or replace function public.create_document_share_token_internal(
  p_tenant_id uuid,
  p_document_type text,
  p_document_id uuid,
  p_term text,
  p_academic_year integer,
  p_expires_days integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_token text;
  v_hash text;
  v_days integer := greatest(coalesce(p_expires_days, 30), 1);
begin
  if p_document_type not in ('receipt', 'statement') then
    raise exception 'Invalid document type';
  end if;

  v_token := encode(extensions.gen_random_bytes(8), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.document_share_tokens
    (tenant_id, document_type, document_id, term, academic_year, token_hash, expires_at)
  values
    (p_tenant_id, p_document_type, p_document_id,
     case when p_document_type = 'statement' then p_term end,
     case when p_document_type = 'statement' then p_academic_year end,
     v_hash, now() + (v_days || ' days')::interval);

  return v_token;
end;
$function$;

-- Internal only: no client role may call this directly.
revoke all on function public.create_document_share_token_internal(uuid, text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.create_document_share_token_internal(uuid, text, uuid, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Staff entry point: permission-checked, then same internal writer.
-- ---------------------------------------------------------------------------
create or replace function public.create_document_share_token(
  p_document_type text,
  p_document_id uuid,
  p_term text default null,
  p_academic_year integer default null,
  p_expires_days integer default 30
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if p_document_type not in ('receipt', 'statement') then raise exception 'Invalid document type'; end if;

  if p_document_type = 'receipt' then
    select tenant_id into v_tenant from public.receipts where id = p_document_id;
    if v_tenant is null then raise exception 'Receipt not found'; end if;
  else
    select tenant_id into v_tenant from public.students where id = p_document_id;
    if v_tenant is null then raise exception 'Student not found'; end if;
  end if;

  if not (public.user_has_permission(v_uid, v_tenant, 'manage-fees')
          or public.user_has_permission(v_uid, v_tenant, 'view-fees')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return public.create_document_share_token_internal(
    v_tenant, p_document_type, p_document_id, p_term, p_academic_year, p_expires_days
  );
end;
$function$;

revoke all on function public.create_document_share_token(text, uuid, text, integer, integer) from public, anon;
grant execute on function public.create_document_share_token(text, uuid, text, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Parent entry points: ownership-checked, then same internal writer.
-- ---------------------------------------------------------------------------
create or replace function public.create_my_child_receipt_token(p_receipt_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_receipt record;
  v_student_id uuid;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;

  select * into v_receipt from public.receipts where id = p_receipt_id;
  if v_receipt.id is null then raise exception 'Receipt not found'; end if;

  select student_id into v_student_id
  from public.fee_payments where id = v_receipt.payment_id;
  if v_student_id is null then raise exception 'Receipt has no payment'; end if;

  perform public.assert_parent_of(v_student_id);

  return public.create_document_share_token_internal(
    v_receipt.tenant_id, 'receipt', p_receipt_id, null, null, 30
  );
end;
$function$;

revoke all on function public.create_my_child_receipt_token(uuid) from public, anon;
grant execute on function public.create_my_child_receipt_token(uuid) to authenticated, service_role;

create or replace function public.create_my_child_statement_token(
  p_student_id uuid,
  p_term text default null,
  p_academic_year integer default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
begin
  perform public.assert_parent_of(p_student_id);

  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null then raise exception 'Student not found'; end if;

  return public.create_document_share_token_internal(
    v_tenant, 'statement', p_student_id, p_term, p_academic_year, 7
  );
end;
$function$;

revoke all on function public.create_my_child_statement_token(uuid, text, integer) from public, anon;
grant execute on function public.create_my_child_statement_token(uuid, text, integer) to authenticated, service_role;
