create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  nickname text not null check (char_length(nickname) between 1 and 80),
  make text,
  model text,
  connector_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.tariffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  currency char(3) not null default 'BRL',
  price_per_kwh numeric(12, 4) not null default 0 check (price_per_kwh >= 0),
  price_per_minute numeric(12, 4) not null default 0 check (price_per_minute >= 0),
  session_fee numeric(12, 2) not null default 0 check (session_fee >= 0),
  idle_price_per_minute numeric(12, 4) not null default 0 check (idle_price_per_minute >= 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id),
  check (valid_until is null or valid_until > valid_from),
  unique (id, organization_id)
);

create index tariffs_org_active_idx on public.tariffs(organization_id, active, valid_from desc);

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null,
  tariff_id uuid,
  currency char(3) not null default 'BRL',
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'estimated' check (status in ('estimated', 'pending', 'issued', 'paid', 'void', 'failed')),
  tariff_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  foreign key (session_id, organization_id) references public.sessions(id, organization_id) on delete cascade,
  foreign key (tariff_id, organization_id) references public.tariffs(id, organization_id),
  unique (session_id)
);

create index charges_org_created_idx on public.charges(organization_id, created_at desc);

create table public.energy_readings (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null,
  charger_id uuid,
  source text not null check (source in ('site_meter', 'solar', 'battery', 'grid', 'other')),
  sampled_at timestamptz not null,
  power_kw numeric(14, 5),
  energy_kwh numeric(16, 5),
  quality text not null default 'measured' check (quality in ('measured', 'estimated', 'stale')),
  created_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade,
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id) on delete cascade
);

create index energy_readings_site_time_idx on public.energy_readings(site_id, sampled_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid,
  charger_id uuid,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  code text not null,
  title text not null,
  description text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  foreign key (site_id, organization_id) references public.sites(id, organization_id),
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id)
);

create index alerts_org_unresolved_idx on public.alerts(organization_id, occurred_at desc) where resolved_at is null;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_logs_org_time_idx on public.audit_logs(organization_id, occurred_at desc);

alter table public.users enable row level security;
alter table public.vehicles enable row level security;
alter table public.tariffs enable row level security;
alter table public.charges enable row level security;
alter table public.energy_readings enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;

create policy "Users can read their own profile" on public.users
  for select to authenticated using (id = (select auth.uid()));
create policy "Users can update their own profile" on public.users
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Members can read vehicles" on public.vehicles
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Members can read tariffs" on public.tariffs
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Admins can manage tariffs" on public.tariffs
  for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Finance roles can read charges" on public.charges
  for select to authenticated using (public.has_org_role(organization_id, array['owner', 'admin', 'finance']::public.organization_role[]));
create policy "Members can read energy readings" on public.energy_readings
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Members can read alerts" on public.alerts
  for select to authenticated using (public.is_org_member(organization_id));
create policy "Operators can resolve alerts" on public.alerts
  for update to authenticated
  using (resolved_at is null and public.has_org_role(organization_id, array['owner', 'admin', 'operator', 'technician']::public.organization_role[]))
  with check (
    resolved_at is not null
    and (resolved_by is null or resolved_by = (select auth.uid()))
    and public.has_org_role(organization_id, array['owner', 'admin', 'operator', 'technician']::public.organization_role[])
  );
create policy "Admins and technicians can read audit logs" on public.audit_logs
  for select to authenticated using (public.has_org_role(organization_id, array['owner', 'admin', 'technician']::public.organization_role[]));

grant select on public.users to authenticated;
grant update (display_name, avatar_url) on public.users to authenticated;
grant select on public.vehicles, public.tariffs, public.charges, public.energy_readings, public.alerts, public.audit_logs to authenticated;
grant update (resolved_at, resolved_by) on public.alerts to authenticated;
grant insert, update, delete on public.tariffs to authenticated;

comment on table public.users is 'Application profile for Supabase Auth users. Authentication credentials remain in auth.users.';
comment on table public.charges is 'Billing ledger records; payment-provider integration is not enabled in this phase.';
comment on table public.energy_readings is 'Site and distributed-energy measurements for future energy management integrations.';
comment on table public.audit_logs is 'Operational audit metadata. Inserts are reserved for trusted backend processes.';
