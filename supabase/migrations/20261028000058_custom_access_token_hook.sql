-- Custom access token hook: injects tenant_id (and user_role) into the JWT.
-- Must be enabled in Supabase Dashboard: Authentication -> Hooks -> Custom Access Token Hook -> public.custom_access_token_hook
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  v_tenant uuid;
  v_role text;
begin
  claims := event -> 'claims';
  select tenant_id, role into v_tenant, v_role
  from public.profiles
  where id = (event ->> 'user_id')::uuid;
  if v_tenant is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant::text));
  end if;
  if v_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
  end if;
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
