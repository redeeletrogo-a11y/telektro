begin;
-- ws (sem criptografia) so para carregadores que o DONO liberar. wss continua o padrao.
alter table public.chargers add column if not exists allow_insecure_ws boolean not null default false;
alter table public.chargers add column if not exists last_transport text check (last_transport in ('wss','ws'));
-- leitura das colunas novas pelo painel (select por coluna, a senha continua oculta)
grant select (allow_insecure_ws, last_transport) on public.chargers to authenticated;

-- historico de quem ligou/desligou (nao guarda senha)
create table if not exists public.charger_transport_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  charger_id uuid not null references public.chargers(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  allow_insecure_ws boolean not null,
  occurred_at timestamptz not null default now()
);
create index if not exists charger_transport_events_org_time_idx on public.charger_transport_events (organization_id, occurred_at desc);
alter table public.charger_transport_events enable row level security;
drop policy if exists "Owners can read charger transport history" on public.charger_transport_events;
create policy "Owners can read charger transport history" on public.charger_transport_events
  for select to authenticated using (public.has_org_role(organization_id, array['owner']::public.organization_role[]));
grant select on public.charger_transport_events to authenticated;

-- so o dono liga/desliga
create or replace function public.set_charger_insecure_ws(p_organization_id uuid, p_charger_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships m where m.organization_id = p_organization_id and m.user_id = v_user and m.role = 'owner') then
    raise exception 'OWNER_REQUIRED' using errcode = '42501';
  end if;
  update public.chargers set allow_insecure_ws = p_enabled, updated_at = now()
   where id = p_charger_id and organization_id = p_organization_id and removed_at is null;
  if not found then raise exception 'CHARGER_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.charger_transport_events (organization_id, charger_id, actor_user_id, allow_insecure_ws)
  values (p_organization_id, p_charger_id, v_user, p_enabled);
end $$;
revoke all on function public.set_charger_insecure_ws(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_charger_insecure_ws(uuid, uuid, boolean) to authenticated;

-- ninguem alem do dono cadastra ja com ws liberado (nem direto pela API)
create or replace function public.chargers_insecure_ws_insert_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.allow_insecure_ws and (select auth.uid()) is not null and not exists (
    select 1 from public.memberships m where m.organization_id = new.organization_id and m.user_id = (select auth.uid()) and m.role = 'owner') then
    raise exception 'OWNER_REQUIRED' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.chargers_insecure_ws_insert_guard() from public, anon, authenticated;
drop trigger if exists chargers_insecure_ws_insert_guard on public.chargers;
create trigger chargers_insecure_ws_insert_guard before insert on public.chargers
for each row execute function public.chargers_insecure_ws_insert_guard();
commit;
