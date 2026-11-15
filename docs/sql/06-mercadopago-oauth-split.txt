-- Eletroposto: conexao OAuth do Mercado Pago do dono e split automatico 1:1.
-- Tokens ficam criptografados pela aplicacao; o banco nunca ve o valor puro.
-- Idempotente: pode rodar mais de uma vez.

begin;

create table if not exists public.eletroposto_mp_connections (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  mp_user_id text not null check (mp_user_id ~ '^[0-9]{1,20}$'),
  public_key text not null check (char_length(public_key) between 10 and 300),
  access_token_encrypted text not null check (char_length(access_token_encrypted) between 20 and 4000),
  refresh_token_encrypted text not null check (char_length(refresh_token_encrypted) between 20 and 4000),
  token_scope text,
  token_type text,
  expires_at timestamptz not null,
  connected_by uuid not null references auth.users(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disconnected_at timestamptz,
  disconnected_by uuid references auth.users(id),
  last_error text
);

alter table public.eletroposto_payments
  add column if not exists mp_collector_id text check (mp_collector_id is null or mp_collector_id ~ '^[0-9]{1,20}$');

create index if not exists eletroposto_payments_mp_collector_idx
  on public.eletroposto_payments (mp_collector_id) where mp_collector_id is not null;

create table if not exists public.eletroposto_mp_connection_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event text not null check (event in ('connected', 'refreshed', 'refresh_failed', 'disconnected', 'error')),
  actor_id uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists eletroposto_mp_connection_events_org_idx
  on public.eletroposto_mp_connection_events (organization_id, created_at desc);

alter table public.eletroposto_mp_connections enable row level security;
alter table public.eletroposto_mp_connection_events enable row level security;
revoke all on public.eletroposto_mp_connections from public, anon, authenticated;
revoke all on public.eletroposto_mp_connection_events from public, anon, authenticated;
revoke all on sequence public.eletroposto_mp_connection_events_id_seq from public, anon, authenticated;

create or replace function public.eletroposto_mp_connection_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organizations o where o.id = new.organization_id and o.account_type = 'eletroposto') then
    raise exception 'MP_CONNECTION_ELETROPOSTO_ONLY' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.eletroposto_mp_connection_guard() from public, anon, authenticated;

drop trigger if exists eletroposto_mp_connection_guard on public.eletroposto_mp_connections;
create trigger eletroposto_mp_connection_guard before insert or update on public.eletroposto_mp_connections
for each row execute function public.eletroposto_mp_connection_guard();

grant select, insert, update on public.eletroposto_mp_connections to service_role;
grant select, insert on public.eletroposto_mp_connection_events to service_role;
grant usage on sequence public.eletroposto_mp_connection_events_id_seq to service_role;

commit;
