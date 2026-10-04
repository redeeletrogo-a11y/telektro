-- Libera o tipo de conta "eletroposto" no cadastro (antes bloqueado). Sem mensalidade: so a taxa por recarga.
create or replace function public.create_organization_with_owner(p_name text, p_slug text, p_account_type public.account_type)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_limit integer;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if char_length(v_name) not between 1 and 120 then raise exception 'Organization name must contain 1 to 120 characters' using errcode = '22023'; end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Organization slug is invalid' using errcode = '22023'; end if;
  v_limit := case p_account_type when 'condominio' then 5 else 0 end;

  insert into public.organizations (name, slug, account_type, resident_limit, subscription_status, trial_ends_at)
  values (
    v_name, v_slug, p_account_type, v_limit,
    case when p_account_type = 'residencial' then 'trialing' else 'active' end,
    case when p_account_type = 'residencial' then now() + interval '7 days' else null end
  ) returning id into v_organization_id;
  insert into public.memberships (organization_id, user_id, role) values (v_organization_id, v_user_id, 'owner');
  return v_organization_id;
end; $$;
