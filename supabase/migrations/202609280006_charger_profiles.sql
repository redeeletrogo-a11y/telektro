alter table public.chargers
  add column model_code text check (model_code is null or char_length(model_code) <= 80),
  add column serial_number text check (serial_number is null or char_length(serial_number) <= 100),
  add column connector_type text check (connector_type is null or char_length(connector_type) <= 80),
  add column connector_count integer check (connector_count is null or connector_count between 1 and 64),
  add column installation_power_kw numeric(10, 3)
    check (installation_power_kw is null or installation_power_kw > 0),
  add column ocpp_version text check (ocpp_version is null or char_length(ocpp_version) <= 32),
  add column technical_specs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(technical_specs) = 'object');

comment on column public.chargers.max_power_kw is
  'Manufacturer rated maximum power in kW, which may exceed the limit configured at the actual electrical installation.';
comment on column public.chargers.installation_power_kw is
  'Maximum power configured for this charger at its installed electrical supply, in kW.';
comment on column public.chargers.technical_specs is
  'Extensible JSON object for manufacturer-specific and optional device capabilities; common query fields are stored in dedicated columns.';
