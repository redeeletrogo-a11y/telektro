-- Account types (residencial / condominio / eletroposto), resident invites and resident-scoped access.
-- No payments here. Support raises limits manually: update public.organizations set resident_limit = N where slug = '...';

create type public.account_type as enum ('residencial', 'condominio', 'eletroposto');

alter table public.organizations
  add column account_type public.account_type not null default 'residencial',
  add column resident_limit integer check (resident_limit is null or resident_limit >= 0);

comment on column public.organizations.resident_limit is
  'Maximum number of resident (morador) members. NULL means unlimited. Raised manually by support.';

-- Organizations that existed before account types keep working without limits.
update public.organizations set account_type = 'eletroposto', resident_limit = null;

-- Staff = any member except residents.
create function public.is_org_staff(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
      and m.role::text <> 'resident'
  );
$$;
revoke all on function public.is_org_staff(uuid) from public, anon;
grant execute on function public.is_org_staff(uuid) to authenticated;

-- Residents only see their own membership row; staff see all.
drop policy "Members can read organization memberships" on public.memberships;
create policy "Staff read all memberships, residents read their own" on public.memberships
  for select to authenticated using (user_id = (select auth.uid()) or public.is_org_staff(organization_id));

-- Operational data: staff only. Residents get their own sessions.
drop policy "Members can read sessions" on public.sessions;
create policy "Staff can read sessions" on public.sessions
  for select to authenticated using (public.is_org_staff(organization_id));
create policy "Residents can read their own sessions" on public.sessions
  for select to authenticated using (authorized_user_id = (select auth.uid()) and public.is_org_member(organization_id));

drop policy "Members can read meter values" on public.meter_values;
create policy "Staff can read meter values" on public.meter_values
  for select to authenticated using (public.is_org_staff(organization_id));
drop policy "Members can read commands" on public.commands;
create policy "Staff can read commands" on public.commands
  for select to authenticated using (public.is_org_staff(organization_id));
drop policy "Members can read OCPP audit metadata" on public.ocpp_messages;
create policy "Staff can read OCPP audit metadata" on public.ocpp_messages
  for select to authenticated using (public.is_org_staff(organization_id));
drop policy "Members can read vehicles" on public.vehicles;
create policy "Staff can read vehicles" on public.vehicles
  for select to authenticated using (public.is_org_staff(organization_id));
drop policy "Members can read tariffs" on public.tariffs;
create policy "Staff can read tariffs" on public.tariffs
  for select to authenticated using (public.is_org_staff(organization_id));
drop policy "Members can read energy readings" on public.energy_readings;
create policy "Staff can read energy readings" on public.energy_readings
  for select to authenticated using (public.is_org_staff(organization_id));
drop policy "Members can read alerts" on public.alerts;
create policy "Staff can read alerts" on public.alerts
  for select to authenticated using (public.is_org_staff(organization_id));

-- Residents can still read sites/chargers/connectors (status), but never the OCPP credential hash.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'chargers' and column_name <> 'ocpp_credential_hash';
  execute 'revoke select on public.chargers from authenticated';
  execute format('grant select (%s) on public.chargers to authenticated', cols);
end $$;

-- Invites
create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{10,32}$'),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  accepted_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.organization_invites enable row level security;
create policy "Admins read invites" on public.organization_invites
  for select to authenticated using (public.is_org_admin(organization_id));
grant select on public.organization_invites to authenticated;

-- Create an organization with an account type (replaces the 2-arg version).
create function public.create_organization_with_owner(p_name text, p_slug text, p_account_type public.account_type)
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

  insert into public.organizations (name, slug, account_type, resident_limit)
  values (v_name, v_slug, p_account_type, v_limit) returning id into v_organization_id;
  insert into public.memberships (organization_id, user_id, role) values (v_organization_id, v_user_id, 'owner');
  return v_organization_id;
end; $$;
revoke all on function public.create_organization_with_owner(text, text, public.account_type) from public, anon;
grant execute on function public.create_organization_with_owner(text, text, public.account_type) to authenticated;
revoke execute on function public.create_organization_with_owner(text, text) from authenticated;

-- Create an invite (síndico/owner/admin of a condominio only).
create function public.create_resident_invite(p_organization_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not public.is_org_admin(p_organization_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id and account_type = 'condominio') then
    raise exception 'NOT_CONDOMINIO' using errcode = '22023';
  end if;
  v_code := replace(gen_random_uuid()::text, '-', '');
  insert into public.organization_invites (organization_id, code, created_by)
  values (p_organization_id, v_code, (select auth.uid()));
  return v_code;
end; $$;
revoke all on function public.create_resident_invite(uuid) from public, anon;
grant execute on function public.create_resident_invite(uuid) to authenticated;

create function public.revoke_resident_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.organization_invites where id = p_invite_id;
  if v_org is null or not public.is_org_admin(v_org) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.organization_invites set revoked_at = now() where id = p_invite_id and revoked_at is null;
end; $$;
revoke all on function public.revoke_resident_invite(uuid) from public, anon;
grant execute on function public.revoke_resident_invite(uuid) to authenticated;

-- Public preview of an invite (organization name only).
create function public.get_invite_preview(p_code text)
returns table (organization_name text, valid boolean) language sql stable security definer set search_path = '' as $$
  select o.name, (i.revoked_at is null and i.expires_at > now())
  from public.organization_invites i join public.organizations o on o.id = i.organization_id
  where i.code = lower(btrim(p_code));
$$;
revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- Accept an invite: adds the caller as resident, enforcing the resident limit.
create function public.accept_resident_invite(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.organization_invites%rowtype;
  v_org public.organizations%rowtype;
  v_count integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_invite from public.organization_invites where code = lower(btrim(p_code)) for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'INVITE_INVALID' using errcode = '22023';
  end if;
  select * into v_org from public.organizations where id = v_invite.organization_id for update;
  if exists (select 1 from public.memberships where organization_id = v_org.id and user_id = v_user) then
    return v_org.id;
  end if;
  select count(*) into v_count from public.memberships where organization_id = v_org.id and role = 'resident';
  if v_org.resident_limit is not null and v_count >= v_org.resident_limit then
    raise exception 'RESIDENT_LIMIT_REACHED' using errcode = '22023';
  end if;
  insert into public.memberships (organization_id, user_id, role) values (v_org.id, v_user, 'resident');
  update public.organization_invites set accepted_count = accepted_count + 1 where id = v_invite.id;
  return v_org.id;
end; $$;
revoke all on function public.accept_resident_invite(text) from public, anon;
grant execute on function public.accept_resident_invite(text) to authenticated;

-- Remove a resident (síndico/admin).
create function public.remove_resident(p_organization_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_org_admin(p_organization_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  delete from public.memberships where organization_id = p_organization_id and user_id = p_user_id and role = 'resident';
end; $$;
revoke all on function public.remove_resident(uuid, uuid) from public, anon;
grant execute on function public.remove_resident(uuid, uuid) to authenticated;

-- List residents with e-mail (admins only; auth.users is not readable by clients).
create function public.list_residents(p_organization_id uuid)
returns table (user_id uuid, email text, joined_at timestamptz) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_org_admin(p_organization_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select m.user_id, u.email::text, m.created_at
    from public.memberships m join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id and m.role = 'resident'
    order by m.created_at;
end; $$;
revoke all on function public.list_residents(uuid) from public, anon;
grant execute on function public.list_residents(uuid) to authenticated;
