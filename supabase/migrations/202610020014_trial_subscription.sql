-- 7-day free trial and subscription status for Residencial accounts.
-- Payment (Mercado Pago) is not wired yet: support activates accounts manually (see bottom).

alter table public.organizations
  add column subscription_status text not null default 'active'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  add column trial_ends_at timestamptz,
  add column current_period_end timestamptz,
  add column subscription_provider text,            -- e.g. 'mercadopago' (future)
  add column subscription_external_id text;         -- provider subscription id (future)

comment on column public.organizations.subscription_status is
  'trialing | active | past_due | canceled. Existing organizations stay active. Residencial signups start as trialing.';

-- Access rule: only Residencial accounts are gated. Others are always allowed for now.
create function public.org_has_access(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organizations o
    where o.id = target_organization_id
      and (
        o.account_type <> 'residencial'
        or o.subscription_status = 'active'
        or (o.subscription_status = 'trialing' and o.trial_ends_at > now())
        or (o.subscription_status in ('past_due', 'canceled') and o.current_period_end > now())
      )
  );
$$;
revoke all on function public.org_has_access(uuid) from public, anon;
grant execute on function public.org_has_access(uuid) to authenticated;

-- Signup: Residencial starts a 7-day trial.
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
  if p_account_type = 'eletroposto' then raise exception 'ACCOUNT_TYPE_UNAVAILABLE' using errcode = '22023'; end if;
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

-- Block new start requests when access is blocked. Stop and read commands stay allowed.
drop policy "Operators can request commands" on public.commands;
create policy "Operators can request commands" on public.commands
  for insert to authenticated with check (
    requested_by = (select auth.uid())
    and public.has_org_role(organization_id, array['owner', 'admin', 'operator', 'technician']::public.organization_role[])
    and (action = 'RemoteStopTransaction' or public.org_has_access(organization_id))
  );

-- SUPPORT: activate or extend an account manually (replace the name):
--   update public.organizations set subscription_status = 'active', current_period_end = now() + interval '30 days'
--    where name = 'NOME DA CONTA';
-- Extend a trial:
--   update public.organizations set trial_ends_at = now() + interval '7 days' where name = 'NOME DA CONTA';
-- Block:
--   update public.organizations set subscription_status = 'canceled', current_period_end = null where name = 'NOME DA CONTA';
