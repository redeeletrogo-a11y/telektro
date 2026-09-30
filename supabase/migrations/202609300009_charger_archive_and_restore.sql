-- Retain removed charger rows so historical sessions, meter values, and charges stay linked.
alter table public.chargers
  add column removed_at timestamptz,
  add column removed_by uuid references auth.users(id) on delete set null;

-- A retired Charge Point ID can be provisioned again while its archive remains intact.
drop index if exists public.chargers_charge_point_id_global_idx;
alter table public.chargers drop constraint if exists chargers_organization_id_charge_point_id_key;
create unique index chargers_charge_point_id_active_unique_idx
  on public.chargers (charge_point_id)
  where removed_at is null;

create table public.charger_removal_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  charger_id uuid not null references public.chargers(id) on delete restrict,
  charge_point_id text not null,
  event_type text not null check (event_type in ('removed', 'restored')),
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index charger_removal_events_org_time_idx
  on public.charger_removal_events (organization_id, occurred_at desc);

alter table public.charger_removal_events enable row level security;
create policy "Owners can read charger removal history" on public.charger_removal_events
  for select to authenticated using (public.has_org_role(organization_id, array['owner']::public.organization_role[]));
grant select on public.charger_removal_events to authenticated;

drop policy "Admins and technicians can manage charger authorizations" on public.charger_authorizations;
create policy "Admins and technicians can manage active charger authorizations" on public.charger_authorizations
  for all to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin', 'technician']::public.organization_role[])
    and exists (
      select 1 from public.chargers c
      where c.id = charger_authorizations.charger_id
        and c.organization_id = charger_authorizations.organization_id
        and c.removed_at is null
    )
  )
  with check (
    public.has_org_role(organization_id, array['owner', 'admin', 'technician']::public.organization_role[])
    and exists (
      select 1 from public.chargers c
      where c.id = charger_authorizations.charger_id
        and c.organization_id = charger_authorizations.organization_id
        and c.removed_at is null
    )
  );

create or replace function public.log_charger_removal_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.removed_at is null and new.removed_at is not null then
    insert into public.charger_removal_events (organization_id, charger_id, charge_point_id, event_type, actor_user_id)
    values (new.organization_id, new.id, new.charge_point_id, 'removed', coalesce((select auth.uid()), new.removed_by));
  elsif old.removed_at is not null and new.removed_at is null then
    insert into public.charger_removal_events (organization_id, charger_id, charge_point_id, event_type, actor_user_id)
    values (new.organization_id, new.id, new.charge_point_id, 'restored', (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke all on function public.log_charger_removal_event() from public, anon, authenticated;
create trigger charger_removal_event_after_update
  after update of removed_at on public.chargers
  for each row execute function public.log_charger_removal_event();

-- OCPP StartTransaction cannot race a removal and create a new active session afterward.
create or replace function public.reject_session_for_removed_charger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed_at timestamptz;
begin
  select c.removed_at into v_removed_at
  from public.chargers c
  where c.id = new.charger_id and c.organization_id = new.organization_id
  for key share;

  if v_removed_at is not null then
    raise exception 'CHARGER_REMOVED' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_session_for_removed_charger() from public, anon, authenticated;
create trigger reject_session_for_removed_charger_before_insert
  before insert on public.sessions
  for each row execute function public.reject_session_for_removed_charger();

create or replace function public.remove_charger(p_organization_id uuid, p_charger_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_charger public.chargers%rowtype;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id and m.user_id = v_user_id and m.role = 'owner'
  ) then
    raise exception 'OWNER_REQUIRED' using errcode = '42501';
  end if;

  select * into v_charger from public.chargers c
  where c.id = p_charger_id and c.organization_id = p_organization_id
  for update;
  if not found then raise exception 'CHARGER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_charger.removed_at is not null then raise exception 'CHARGER_ALREADY_REMOVED' using errcode = '22023'; end if;
  if exists (
    select 1 from public.sessions s
    where s.charger_id = p_charger_id and s.organization_id = p_organization_id and s.ended_at is null
  ) then
    raise exception 'ACTIVE_SESSION' using errcode = '55000';
  end if;

  update public.chargers set
    removed_at = now(), removed_by = v_user_id,
    ocpp_credential_hash = null, online = false, status = 'Offline', updated_at = now()
  where id = p_charger_id and organization_id = p_organization_id;

  update public.charger_authorizations set enabled = false
  where charger_id = p_charger_id and organization_id = p_organization_id and enabled;

  update public.commands set
    status = 'failed', result = '{"error":"charger_removed"}'::jsonb, completed_at = now()
  where charger_id = p_charger_id and organization_id = p_organization_id
    and status in ('pending', 'sent', 'accepted', 'unknown')
    and action in ('RemoteStartTransaction', 'RemoteStopTransaction', 'GetConfiguration');
end;
$$;

create or replace function public.restore_charger(p_organization_id uuid, p_charger_id uuid, p_credential_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_charger public.chargers%rowtype;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id and m.user_id = v_user_id and m.role = 'owner'
  ) then
    raise exception 'OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_credential_hash is null or p_credential_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_CREDENTIAL_HASH' using errcode = '22023';
  end if;

  select * into v_charger from public.chargers c
  where c.id = p_charger_id and c.organization_id = p_organization_id
  for update;
  if not found then raise exception 'CHARGER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_charger.removed_at is null then raise exception 'CHARGER_NOT_REMOVED' using errcode = '22023'; end if;
  if v_charger.removed_at < now() - interval '30 days' then
    raise exception 'RESTORE_WINDOW_EXPIRED' using errcode = '22023';
  end if;

  update public.chargers set
    removed_at = null, removed_by = null,
    ocpp_credential_hash = p_credential_hash, online = false, status = 'Unknown', updated_at = now()
  where id = p_charger_id and organization_id = p_organization_id;
end;
$$;

revoke all on function public.remove_charger(uuid, uuid) from public, anon;
revoke all on function public.restore_charger(uuid, uuid, text) from public, anon;
grant execute on function public.remove_charger(uuid, uuid) to authenticated;
grant execute on function public.restore_charger(uuid, uuid, text) to authenticated;

-- Lifecycle changes must go through the owner-checked functions above.
revoke update, delete on public.chargers from authenticated;

comment on column public.chargers.removed_at is 'Soft-removal timestamp; retained charger identity preserves session, meter, and billing history.';
comment on column public.chargers.removed_by is 'Account that removed the charger.';
comment on table public.charger_removal_events is 'Immutable audit events for charger removal and restoration.';
