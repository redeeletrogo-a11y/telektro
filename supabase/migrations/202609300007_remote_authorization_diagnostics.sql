-- Additive OCPP diagnostics and authorization data; existing charger/session data is preserved.
alter table public.chargers
  add column capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  add column last_boot_at timestamptz,
  add column last_status_notification_at timestamptz,
  add column last_transaction_at timestamptz,
  add column last_transaction_id bigint,
  add column last_ocpp_error text;

alter table public.sessions
  add column authorization_type text check (authorization_type is null or authorization_type in ('RFID', 'REMOTE', 'APP', 'QR')),
  add column authorized_user_id uuid references auth.users(id) on delete set null;

alter table public.commands
  add column operation_key text,
  drop constraint commands_status_check,
  add constraint commands_status_check check (status in (
    'pending', 'sent', 'accepted', 'rejected', 'timeout', 'failed', 'unknown', 'confirmed', 'operation_timeout'
  ));

alter table public.ocpp_messages
  add column request_id text,
  add column user_id uuid references auth.users(id) on delete set null,
  add column connector_id integer,
  add column transaction_id bigint,
  add column reason text;

create table public.charger_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  charger_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  id_tag_hash text not null check (id_tag_hash ~ '^[a-f0-9]{64}$'),
  authorization_type text not null default 'RFID' check (authorization_type in ('RFID', 'APP', 'QR')),
  enabled boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id) on delete cascade,
  unique (charger_id, id_tag_hash)
);

create index charger_authorizations_lookup_idx
  on public.charger_authorizations (charger_id, id_tag_hash) where enabled;

alter table public.charger_authorizations enable row level security;
create policy "Admins and technicians can read charger authorizations" on public.charger_authorizations
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin', 'technician']::public.organization_role[]));
create policy "Admins and technicians can manage charger authorizations" on public.charger_authorizations
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin', 'technician']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'admin', 'technician']::public.organization_role[]));
grant select, insert, update, delete on public.charger_authorizations to authenticated;

-- One active start per charger; an accepted command remains active until StartTransaction arrives.
create unique index commands_one_active_remote_start_per_connector_idx
  on public.commands (charger_id, operation_key)
  where action = 'RemoteStartTransaction' and status in ('pending', 'sent', 'accepted', 'unknown');

create unique index commands_one_active_remote_stop_per_transaction_idx
  on public.commands (charger_id, operation_key)
  where action = 'RemoteStopTransaction' and status in ('pending', 'sent', 'accepted', 'unknown');

create index commands_waiting_operation_confirmation_idx
  on public.commands (requested_at)
  where action in ('RemoteStartTransaction', 'RemoteStopTransaction') and status = 'accepted';

alter table public.sessions add column gateway_guarded boolean not null default false;

create unique index sessions_one_active_per_connector_idx
  on public.sessions (charger_id, connector_id)
  where gateway_guarded and ended_at is null and connector_id is not null;

create unique index sessions_charger_transaction_id_idx
  on public.sessions (charger_id, ocpp_transaction_id)
  where gateway_guarded and ocpp_transaction_id is not null;

comment on column public.chargers.capabilities is 'Observed OCPP capabilities; values use SUPPORTED, UNSUPPORTED, or UNKNOWN with evidence metadata.';
comment on column public.charger_authorizations.id_tag_hash is 'SHA-256 of the physical or virtual OCPP idTag; raw tag values are not stored in this table.';
