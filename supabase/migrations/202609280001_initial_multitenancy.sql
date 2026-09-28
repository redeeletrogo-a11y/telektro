create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'operator', 'finance', 'technician', 'viewer');
create type public.charger_status as enum ('Available', 'Preparing', 'Charging', 'SuspendedEVSE', 'SuspendedEV', 'Finishing', 'Reserved', 'Unavailable', 'Faulted', 'Offline', 'Unknown');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships(user_id, organization_id);

create function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_org_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

create function public.has_org_role(target_organization_id uuid, allowed_roles public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  address text,
  timezone text not null default 'America/Fortaleza',
  max_power_kw numeric(10, 3) check (max_power_kw is null or max_power_kw > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.chargers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null,
  charge_point_id text not null check (char_length(charge_point_id) between 1 and 64),
  vendor text,
  model text,
  firmware text,
  max_power_kw numeric(10, 3) check (max_power_kw is null or max_power_kw > 0),
  status public.charger_status not null default 'Unknown',
  online boolean not null default false,
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade,
  unique (organization_id, charge_point_id),
  unique (id, organization_id)
);

create index chargers_site_status_idx on public.chargers(site_id, status);
create index chargers_heartbeat_idx on public.chargers(last_heartbeat_at desc);

create table public.connectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  charger_id uuid not null,
  connector_id integer not null check (connector_id >= 0),
  status public.charger_status not null default 'Unknown',
  max_power_kw numeric(10, 3) check (max_power_kw is null or max_power_kw > 0),
  updated_at timestamptz not null default now(),
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id) on delete cascade,
  unique (charger_id, connector_id)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null,
  charger_id uuid not null,
  connector_id integer,
  ocpp_transaction_id bigint,
  id_tag text,
  started_at timestamptz,
  ended_at timestamptz,
  start_meter_wh numeric(14, 3),
  end_meter_wh numeric(14, 3),
  stop_reason text,
  created_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id),
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id),
  unique (id, organization_id),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index sessions_org_started_idx on public.sessions(organization_id, started_at desc);
create index sessions_charger_active_idx on public.sessions(charger_id) where ended_at is null;

create table public.meter_values (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid,
  charger_id uuid not null,
  connector_id integer,
  sampled_at timestamptz not null,
  measurand text not null,
  value numeric(16, 5) not null,
  unit text,
  phase text,
  context text,
  created_at timestamptz not null default now(),
  foreign key (session_id, organization_id) references public.sessions(id, organization_id) on delete cascade,
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id) on delete cascade
);

create index meter_values_charger_time_idx on public.meter_values(charger_id, sampled_at desc);
create index meter_values_session_idx on public.meter_values(session_id, sampled_at);

create table public.commands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  charger_id uuid not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'accepted', 'rejected', 'timeout', 'failed')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb,
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id) on delete cascade
);

create table public.ocpp_messages (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  charger_id uuid,
  message_id text,
  action text,
  direction text not null check (direction in ('inbound', 'outbound')),
  outcome text,
  occurred_at timestamptz not null default now(),
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id)
);

create index ocpp_messages_org_time_idx on public.ocpp_messages(organization_id, occurred_at desc);

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.sites enable row level security;
alter table public.chargers enable row level security;
alter table public.connectors enable row level security;
alter table public.sessions enable row level security;
alter table public.meter_values enable row level security;
alter table public.commands enable row level security;
alter table public.ocpp_messages enable row level security;

create policy "Members can read their organizations" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "Members can read organization memberships" on public.memberships
  for select to authenticated using (public.is_org_member(organization_id));

create policy "Members can read sites" on public.sites
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Admins can manage sites" on public.sites
  for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Members can read chargers" on public.chargers
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Admins and technicians can manage chargers" on public.chargers
  for all to authenticated using (public.has_org_role(organization_id, array['owner', 'admin', 'technician']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'admin', 'technician']::public.organization_role[]));
create policy "Members can read connectors" on public.connectors
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Admins can manage connectors" on public.connectors
  for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Members can read sessions" on public.sessions
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Members can read meter values" on public.meter_values
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Members can read commands" on public.commands
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Operators can request commands" on public.commands
  for insert to authenticated with check (
    requested_by = (select auth.uid()) and public.has_org_role(organization_id, array['owner', 'admin', 'operator', 'technician']::public.organization_role[])
  );
create policy "Members can read OCPP audit metadata" on public.ocpp_messages
  for select to authenticated using (public.is_org_member(organization_id));

grant select on public.organizations, public.memberships, public.sites, public.chargers, public.connectors, public.sessions, public.meter_values, public.commands, public.ocpp_messages to authenticated;
grant insert, update, delete on public.sites, public.chargers, public.connectors to authenticated;
grant insert on public.commands to authenticated;

comment on table public.ocpp_messages is 'OCPP audit metadata only. Raw payloads are intentionally not persisted by default.';
comment on table public.commands is 'Commands are persisted separately from their OCPP delivery and charger confirmation.';
