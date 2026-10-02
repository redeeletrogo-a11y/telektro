-- Carteira pre-paga do morador (condominio): recarga por Pix, debito automatico ao fim da sessao.
-- Rode no SQL Editor do Supabase. Idempotente. Valores em centavos (inteiros), sem erro de arredondamento.

alter table public.organizations
  add column if not exists wallet_enabled boolean not null default false,
  add column if not exists wallet_min_balance_cents integer not null default 500 check (wallet_min_balance_cents >= 0);

comment on column public.organizations.wallet_enabled is 'Carteira pre-paga ligada para os moradores desta conta (condominio).';
comment on column public.organizations.wallet_min_balance_cents is 'Saldo minimo para iniciar uma recarga (usado a partir da fase de iniciar pelo app).';

-- Livro-razao: so entra linha nova. Nunca altera nem apaga (trigger abaixo bloqueia ate o service role).
create table if not exists public.wallet_ledger (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  entry_type text not null check (entry_type in ('topup', 'debit', 'refund', 'adjustment')),
  amount_cents bigint not null check (amount_cents <> 0),      -- credito positivo, debito negativo
  reference text not null,                                      -- id do pagamento (topup) ou da sessao (debit): garante 1 vez so
  session_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (entry_type, reference),
  check ((entry_type in ('topup', 'refund') and amount_cents > 0) or (entry_type = 'debit' and amount_cents < 0) or entry_type = 'adjustment')
);
create index if not exists wallet_ledger_user_idx on public.wallet_ledger (organization_id, user_id, created_at desc);

create or replace function public.wallet_ledger_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'wallet_ledger e imutavel: faca um lancamento de ajuste em vez de editar ou apagar';
end $$;
drop trigger if exists wallet_ledger_no_change on public.wallet_ledger;
create trigger wallet_ledger_no_change before update or delete on public.wallet_ledger
  for each row execute function public.wallet_ledger_immutable();
drop trigger if exists wallet_ledger_no_truncate on public.wallet_ledger;
create trigger wallet_ledger_no_truncate before truncate on public.wallet_ledger
  for each statement execute function public.wallet_ledger_immutable();

-- Recargas por Pix (uma linha por QR gerado).
create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_cents integer not null check (amount_cents between 1000 and 50000),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  mp_payment_id text unique,
  qr_code text,
  qr_code_base64 text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wallet_topups_user_idx on public.wallet_topups (organization_id, user_id, created_at desc);

alter table public.wallet_ledger enable row level security;
alter table public.wallet_topups enable row level security;
drop policy if exists "Residents read own ledger, staff read org ledger" on public.wallet_ledger;
create policy "Residents read own ledger, staff read org ledger" on public.wallet_ledger
  for select to authenticated using ((user_id = (select auth.uid()) and public.is_org_member(organization_id)) or public.is_org_staff(organization_id));
drop policy if exists "Residents read own topups" on public.wallet_topups;
create policy "Residents read own topups" on public.wallet_topups
  for select to authenticated using (user_id = (select auth.uid()) and public.is_org_member(organization_id));
revoke insert, update, delete, truncate on public.wallet_ledger from anon, authenticated;
revoke insert, update, delete, truncate on public.wallet_topups from anon, authenticated;

-- Saldo em centavos (so o proprio morador ou a equipe da conta).
create or replace function public.wallet_balance_cents(p_organization_id uuid, p_user_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select case when p_user_id = (select auth.uid()) or public.is_org_staff(p_organization_id)
    then coalesce((select sum(amount_cents) from public.wallet_ledger where organization_id = p_organization_id and user_id = p_user_id), 0)
    else 0 end;
$$;
revoke all on function public.wallet_balance_cents(uuid, uuid) from public, anon;
grant execute on function public.wallet_balance_cents(uuid, uuid) to authenticated;

-- Debito ao fim da sessao: kWh x tarifa ativa (+ taxa da sessao + minutos x preco/minuto). Uma vez por sessao.
create or replace function public.wallet_settle_session() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org public.organizations%rowtype;
  v_tariff public.tariffs%rowtype;
  v_kwh numeric;
  v_minutes numeric;
  v_cents bigint;
begin
  if new.ended_at is null or old.ended_at is not null or new.authorized_user_id is null then return new; end if;
  select * into v_org from public.organizations where id = new.organization_id;
  if not found or not v_org.wallet_enabled or v_org.account_type <> 'condominio' then return new; end if;
  if new.start_meter_wh is null or new.end_meter_wh is null or new.end_meter_wh < new.start_meter_wh then return new; end if;
  -- Tarifa do local (se houver) ou da conta, vigente no inicio da sessao.
  select * into v_tariff from public.tariffs t
    where t.organization_id = new.organization_id and t.active and t.currency = 'BRL'
      and t.valid_from <= coalesce(new.started_at, now()) and (t.valid_until is null or t.valid_until > coalesce(new.started_at, now()))
      and (t.site_id = new.site_id or t.site_id is null)
    order by (t.site_id is not null) desc, t.valid_from desc limit 1;
  if not found then return new; end if;
  v_kwh := (new.end_meter_wh - new.start_meter_wh) / 1000.0;
  v_minutes := greatest(0, extract(epoch from (new.ended_at - coalesce(new.started_at, new.ended_at))) / 60.0);
  v_cents := round((v_kwh * v_tariff.price_per_kwh + v_minutes * v_tariff.price_per_minute + v_tariff.session_fee) * 100);
  if v_cents <= 0 then return new; end if;
  insert into public.wallet_ledger (organization_id, user_id, entry_type, amount_cents, reference, session_id, details)
  values (new.organization_id, new.authorized_user_id, 'debit', -v_cents, new.id::text, new.id,
    jsonb_build_object('kwh', v_kwh, 'minutes', v_minutes, 'tariff_id', v_tariff.id, 'price_per_kwh', v_tariff.price_per_kwh,
      'price_per_minute', v_tariff.price_per_minute, 'session_fee', v_tariff.session_fee))
  on conflict (entry_type, reference) do nothing;
  return new;
end $$;
drop trigger if exists sessions_wallet_settle on public.sessions;
create trigger sessions_wallet_settle after update of ended_at on public.sessions
  for each row execute function public.wallet_settle_session();
