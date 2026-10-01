-- Audit credential rotations without retaining passwords or their hashes in this log.
create table public.charger_credential_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  charger_id uuid not null references public.chargers(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index charger_credential_events_org_time_idx
  on public.charger_credential_events (organization_id, occurred_at desc);

alter table public.charger_credential_events enable row level security;
create policy "Owners can read charger credential history" on public.charger_credential_events
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner']::public.organization_role[]));
grant select on public.charger_credential_events to authenticated;

create or replace function public.rotate_charger_credential(
  p_organization_id uuid,
  p_charger_id uuid,
  p_credential_hash text
)
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
  if v_charger.removed_at is not null then raise exception 'CHARGER_REMOVED' using errcode = '22023'; end if;

  update public.chargers set
    ocpp_credential_hash = p_credential_hash,
    online = false,
    status = 'Offline',
    updated_at = now()
  where id = p_charger_id and organization_id = p_organization_id;

  insert into public.charger_credential_events (organization_id, charger_id, actor_user_id)
  values (p_organization_id, p_charger_id, v_user_id);
end;
$$;

revoke all on function public.rotate_charger_credential(uuid, uuid, text) from public, anon;
grant execute on function public.rotate_charger_credential(uuid, uuid, text) to authenticated;

comment on table public.charger_credential_events is 'Audit log for charger OCPP credential rotation; never stores credential material.';
