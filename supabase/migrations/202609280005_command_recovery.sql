alter table public.commands
  add column ocpp_message_id text,
  add column sent_at timestamptz;

alter table public.commands
  drop constraint commands_status_check,
  add constraint commands_status_check
    check (status in ('pending', 'sent', 'accepted', 'rejected', 'timeout', 'failed', 'unknown'));

create unique index commands_ocpp_message_id_idx
  on public.commands (ocpp_message_id)
  where ocpp_message_id is not null;

comment on column public.commands.ocpp_message_id is
  'OCPP CALL id persisted before delivery so a response can be correlated after reconnects or a delayed reply.';
comment on column public.commands.sent_at is
  'Time the gateway claimed and prepared this command for OCPP delivery.';
