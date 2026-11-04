-- Public fee statement rows resolved from a statement share token.
create or replace function public.get_fee_statement_by_token(p_token text, p_ip text default null)
returns table(
  row_kind text,
  description text,
  term text,
  academic_year integer,
  occurred_at timestamptz,
  receipt_number text,
  payment_method text,
  paid_by text,
  amount numeric,
  running_balance numeric
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_hash text;
  v_row record;
  v_recent int;
  v_student uuid;
  v_term text;
  v_year integer;
begin
  if p_token is null or length(p_token) = 0 then
    raise exception 'Invalid token';
  end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select count(*) into v_recent
  from public.receipt_token_access_log
  where token_hash = v_hash
    and accessed_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Rate limit exceeded' using errcode = 'P0001';
  end if;
  insert into public.receipt_token_access_log (token_hash, ip) values (v_hash, p_ip);

  select * into v_row
  from public.statement_share_tokens
  where token_hash = v_hash
    and revoked = false
    and expires_at > now();
  if not found then
    raise exception 'Invalid or expired link';
  end if;

  v_student := v_row.student_id;
  v_term := v_row.term;
  v_year := v_row.academic_year;

  -- delegate to get_fee_statement logic by re-querying
  return query
  select * from public.get_fee_statement(v_student, v_term, v_year);
end;
$function$;

revoke all on function public.get_fee_statement_by_token(text, text) from public, anon;
grant execute on function public.get_fee_statement_by_token(text, text) to anon, authenticated, service_role;
