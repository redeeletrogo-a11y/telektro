-- Charge point identifiers are used in the OCPP WebSocket path and must resolve globally.
create unique index chargers_charge_point_id_global_idx on public.chargers (charge_point_id);

alter table public.chargers
  add column ocpp_credential_hash text
    check (ocpp_credential_hash is null or ocpp_credential_hash ~ '^[a-f0-9]{64}$');

comment on column public.chargers.ocpp_credential_hash is
  'SHA-256 digest of a randomly generated OCPP Basic Auth password. The plaintext is shown only once at provisioning.';
