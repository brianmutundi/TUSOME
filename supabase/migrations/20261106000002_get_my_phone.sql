-- Slice 7: let a signed-in user read back the phone number saved by set_my_phone.
-- Reads only the caller's own profile row. Returns null when no number is saved.
create or replace function public.get_my_phone()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select p.phone into v_phone from public.profiles p where p.id = auth.uid();
  return nullif(v_phone, '');
end;
$function$;

revoke all on function public.get_my_phone() from public, anon;
grant execute on function public.get_my_phone() to authenticated, service_role;
