-- New accounts no longer get an automatic organization. They choose an account type
-- (Residencial / Condominio) at first login, or join a condominio through an invite.
-- Existing organizations and memberships are untouched.
create or replace function public.initialize_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
