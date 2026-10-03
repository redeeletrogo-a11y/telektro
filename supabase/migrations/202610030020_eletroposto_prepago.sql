-- Eletroposto pre-pago por QR (piloto): o motorista sem conta escaneia o QR, paga um valor MAXIMO via Pix,
-- o carregador libera so depois do pagamento confirmado, a recarga para no valor pago (margem de seguranca),
-- cobra-se o consumo MEDIDO e a sobra e devolvida. Idempotente: pode rodar mais de uma vez.
-- Tudo aqui e acessado SO pelo servidor (service role). Visitantes nunca leem nem escrevem estas tabelas direto.

-- 1) Ponto de recarga publico (um conector de um carregador, com codigo do QR).
create table if not exists public.eletroposto_points (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique check (public_code ~ '^[a-z0-9]{8,32}$'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  charger_id uuid not null,
  connector_id integer not null check (connector_id >= 1),
  enabled boolean not null default false,
  min_amount numeric(10, 2) not null default 10 check (min_amount >= 1),
  max_amount numeric(10, 2) not null default 100 check (max_amount >= min_amount and max_amount <= 1000),
  -- A recarga e interrompida quando o consumo chega a (100 - margem)% do valor pago.
  stop_margin_pct numeric(5, 2) not null default 5 check (stop_margin_pct between 1 and 30),
  -- Reservado para a fase de split/comissao pelo Mercado Pago (nao usado no piloto).
  platform_fee_pct numeric(5, 2) not null default 0 check (platform_fee_pct between 0 and 30),
  created_at timestamptz not null default now(),
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id) on delete cascade,
  unique (charger_id, connector_id)
);

-- 2) Pagamento + recarga do visitante. Tarifa e valor maximo ficam CONGELADOS no momento da criacao.
create table if not exists public.eletroposto_payments (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  point_id uuid not null references public.eletroposto_points(id),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  charger_id uuid not null,
  connector_id integer not null,
  payer_name text not null check (char_length(payer_name) between 2 and 120),
  payer_email text not null check (char_length(payer_email) between 5 and 200),
  payer_phone text check (payer_phone is null or char_length(payer_phone) <= 30),
  consent_at timestamptz not null,
  ip_hash text,
  cap_amount numeric(10, 2) not null check (cap_amount > 0),
  price_per_kwh numeric(12, 4) not null check (price_per_kwh > 0),
  session_fee numeric(12, 2) not null default 0 check (session_fee >= 0),
  stop_margin_pct numeric(5, 2) not null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'paid', 'starting', 'charging', 'settling', 'settled', 'expired', 'review')),
  mp_payment_id text unique,
  qr_code text,
  qr_code_base64 text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  id_tag text unique,
  start_command_id uuid,
  session_id uuid,
  energy_wh numeric(14, 3),
  charged_amount numeric(10, 2),
  refund_amount numeric(10, 2),
  refund_id text,
  refund_reason text,
  last_error text,
  needs_attention boolean not null default false,
  attention_reason text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (charger_id, organization_id) references public.chargers(id, organization_id) on delete cascade
);
create index if not exists eletroposto_payments_status_idx on public.eletroposto_payments (status, created_at);
create index if not exists eletroposto_payments_session_idx on public.eletroposto_payments (session_id) where session_id is not null;
create index if not exists eletroposto_payments_ip_idx on public.eletroposto_payments (ip_hash, created_at desc);
-- Nunca duas recargas pre-pagas ao mesmo tempo no mesmo conector (reivindicacao atomica).
create unique index if not exists eletroposto_one_active_per_connector_idx
  on public.eletroposto_payments (charger_id, connector_id) where status in ('starting', 'charging');

alter table public.eletroposto_points enable row level security;
alter table public.eletroposto_payments enable row level security;
revoke all on public.eletroposto_points from anon, authenticated;
revoke all on public.eletroposto_payments from anon, authenticated;
-- Sem policies: so o servidor (service role) acessa.

-- 3) Cria o pagamento (valida tudo no banco). Retorna id e token publico.
create or replace function public.eletroposto_create_payment(p_code text, p_name text, p_email text, p_phone text, p_amount numeric, p_ip_hash text)
returns table (payment_id uuid, public_token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_point public.eletroposto_points%rowtype;
  v_charger public.chargers%rowtype;
  v_tariff public.tariffs%rowtype;
  v_connector_status text;
  v_id uuid := gen_random_uuid();
  v_token text;
begin
  select * into v_point from public.eletroposto_points where public_code = p_code and enabled;
  if not found then raise exception 'POINT_NOT_FOUND' using errcode = '22023'; end if;
  if p_amount is null or p_amount <> round(p_amount, 2) or p_amount < v_point.min_amount or p_amount > v_point.max_amount then
    raise exception 'AMOUNT_INVALID' using errcode = '22023';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'REGISTRATION_INVALID' using errcode = '22023';
  end if;
  if p_ip_hash is not null and (select count(*) from public.eletroposto_payments x where x.ip_hash = p_ip_hash and x.created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'RATE_LIMITED' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_point.organization_id and o.account_type = 'eletroposto') then
    raise exception 'POINT_NOT_FOUND' using errcode = '22023';
  end if;
  select * into v_charger from public.chargers where id = v_point.charger_id and removed_at is null;
  if not found then raise exception 'POINT_NOT_FOUND' using errcode = '22023'; end if;
  if not v_charger.online or v_charger.last_heartbeat_at is null or v_charger.last_heartbeat_at < now() - interval '180 seconds' then
    raise exception 'CHARGER_OFFLINE' using errcode = '22023';
  end if;
  select c.status::text into v_connector_status from public.connectors c where c.charger_id = v_charger.id and c.connector_id = v_point.connector_id;
  if v_connector_status is null then v_connector_status := v_charger.status::text; end if;
  if v_connector_status not in ('Available', 'Preparing') then raise exception 'CONNECTOR_UNAVAILABLE' using errcode = '22023'; end if;
  if exists (select 1 from public.sessions s where s.charger_id = v_charger.id and s.connector_id = v_point.connector_id and s.ended_at is null)
     or exists (select 1 from public.eletroposto_payments x where x.charger_id = v_charger.id and x.connector_id = v_point.connector_id and x.status in ('starting', 'charging')) then
    raise exception 'CONNECTOR_BUSY' using errcode = '23505';
  end if;
  select * into v_tariff from public.tariffs t
    where t.organization_id = v_point.organization_id and t.active and t.currency = 'BRL' and t.price_per_kwh > 0
      and t.valid_from <= now() and (t.valid_until is null or t.valid_until > now())
      and (t.site_id = v_charger.site_id or t.site_id is null)
    order by (t.site_id is not null) desc, t.valid_from desc limit 1;
  if not found then raise exception 'NO_TARIFF' using errcode = '22023'; end if;
  insert into public.eletroposto_payments (id, point_id, organization_id, charger_id, connector_id, payer_name, payer_email, payer_phone, consent_at, ip_hash,
      cap_amount, price_per_kwh, session_fee, stop_margin_pct, expires_at)
  values (v_id, v_point.id, v_point.organization_id, v_charger.id, v_point.connector_id, btrim(p_name), lower(btrim(p_email)), nullif(btrim(coalesce(p_phone, '')), ''), now(), p_ip_hash,
      p_amount, v_tariff.price_per_kwh, v_tariff.session_fee, v_point.stop_margin_pct, now() + interval '10 minutes')
  returning public.eletroposto_payments.public_token into v_token;
  return query select v_id, v_token;
end $$;

-- 4) Pagamento confirmado: tenta liberar a recarga; se nao der, marca devolucao TOTAL.
-- Retorna 'started', 'refund' ou 'already' (idempotente: so a primeira chamada age).
create or replace function public.eletroposto_mark_paid(p_id uuid, p_mp_payment_id text, p_amount numeric)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_p public.eletroposto_payments%rowtype;
  v_charger public.chargers%rowtype;
  v_connector_status text;
  v_tag text;
  v_cmd uuid;
  v_late boolean;
begin
  select * into v_p from public.eletroposto_payments where id = p_id for update;
  if not found then return 'already'; end if;
  if v_p.status not in ('awaiting_payment', 'expired') then return 'already'; end if;
  if v_p.mp_payment_id is distinct from p_mp_payment_id or p_amount is distinct from v_p.cap_amount then return 'already'; end if;
  v_late := v_p.status = 'expired';
  update public.eletroposto_payments set paid_at = now(), updated_at = now() where id = v_p.id;
  select * into v_charger from public.chargers where id = v_p.charger_id and removed_at is null;
  if v_late then
    update public.eletroposto_payments set status = 'settling', charged_amount = 0, refund_amount = v_p.cap_amount, refund_reason = 'late_payment', energy_wh = 0, updated_at = now() where id = v_p.id;
    return 'refund';
  end if;
  begin
    if not found or not v_charger.online or v_charger.last_heartbeat_at is null or v_charger.last_heartbeat_at < now() - interval '180 seconds' then
      raise exception 'CHARGER_OFFLINE';
    end if;
    select c.status::text into v_connector_status from public.connectors c where c.charger_id = v_charger.id and c.connector_id = v_p.connector_id;
    if v_connector_status is null then v_connector_status := v_charger.status::text; end if;
    if v_connector_status not in ('Available', 'Preparing') then raise exception 'CONNECTOR_UNAVAILABLE'; end if;
    if exists (select 1 from public.sessions s where s.charger_id = v_charger.id and s.connector_id = v_p.connector_id and s.ended_at is null) then raise exception 'CONNECTOR_BUSY'; end if;
    v_tag := 'TP' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 18);
    -- Indice unico parcial: se outra recarga ja ocupa o conector, falha aqui e vai para devolucao.
    update public.eletroposto_payments set status = 'starting', id_tag = v_tag, updated_at = now() where id = v_p.id;
    insert into public.commands (organization_id, charger_id, action, payload, operation_key, requested_by)
    values (v_p.organization_id, v_p.charger_id, 'RemoteStartTransaction', jsonb_build_object('idTag', v_tag, 'connectorId', v_p.connector_id), 'start:' || v_p.connector_id, null)
    returning id into v_cmd;
    update public.eletroposto_payments set start_command_id = v_cmd where id = v_p.id;
    return 'started';
  exception when others then
    -- O bloco desfaz o update/insert acima (subtransacao); registra devolucao total.
    update public.eletroposto_payments set status = 'settling', charged_amount = 0, refund_amount = v_p.cap_amount, refund_reason = 'cannot_start', energy_wh = 0,
      last_error = left(sqlerrm, 200), updated_at = now() where id = v_p.id;
    return 'refund';
  end;
end $$;

-- 5) Quando o carregador abre a sessao com o idTag pago, liga a sessao ao pagamento.
-- Sessao com idTag "TP..." que NAO tem pagamento ativo (ex.: ja devolvido) e parada na hora.
create or replace function public.eletroposto_on_session_start() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.eletroposto_payments%rowtype;
begin
  if new.id_tag is null or new.id_tag not like 'TP%' then return new; end if;
  begin
    select * into v_p from public.eletroposto_payments where id_tag = new.id_tag and charger_id = new.charger_id for update;
    if found and v_p.status = 'starting' then
      update public.eletroposto_payments set status = 'charging', session_id = new.id, updated_at = now() where id = v_p.id;
    elsif new.ocpp_transaction_id is not null and new.ocpp_transaction_id > 0 then
      insert into public.commands (organization_id, charger_id, action, payload, operation_key, requested_by)
      values (new.organization_id, new.charger_id, 'RemoteStopTransaction', jsonb_build_object('transactionId', new.ocpp_transaction_id), 'stop:' || new.ocpp_transaction_id, null);
    end if;
  exception when others then
    raise warning 'eletroposto_on_session_start: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists sessions_eletroposto_start on public.sessions;
create trigger sessions_eletroposto_start after insert on public.sessions
  for each row execute function public.eletroposto_on_session_start();

-- 6) A cada leitura do medidor: calcula o consumo e manda parar quando chega perto do valor pago.
-- Nunca bloqueia a gravacao da leitura (erros viram aviso).
create or replace function public.eletroposto_on_meter_value() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.eletroposto_payments%rowtype;
  v_s public.sessions%rowtype;
  v_wh numeric;
  v_cost numeric;
begin
  if new.session_id is null or new.measurand <> 'Energy.Active.Import.Register' or coalesce(new.requires_review, false) then return new; end if;
  begin
    select * into v_p from public.eletroposto_payments where session_id = new.session_id and status = 'charging';
    if not found then return new; end if;
    select * into v_s from public.sessions where id = new.session_id;
    if v_s.start_meter_wh is null or v_s.ended_at is not null then return new; end if;
    v_wh := case when lower(coalesce(new.unit, 'Wh')) = 'kwh' then new.value * 1000 else new.value end;
    if v_wh < v_s.start_meter_wh then return new; end if; -- leitura abaixo da inicial: ignora (a liquidacao vai para revisao)
    update public.eletroposto_payments set energy_wh = v_wh - v_s.start_meter_wh, updated_at = now() where id = v_p.id;
    v_cost := (v_wh - v_s.start_meter_wh) / 1000.0 * v_p.price_per_kwh + v_p.session_fee;
    if v_cost >= v_p.cap_amount * (1 - v_p.stop_margin_pct / 100.0) and v_s.ocpp_transaction_id is not null and v_s.ocpp_transaction_id > 0
       and not exists (select 1 from public.commands c where c.charger_id = v_s.charger_id and c.action = 'RemoteStopTransaction'
                       and c.payload ->> 'transactionId' = v_s.ocpp_transaction_id::text and c.status in ('pending', 'sent', 'accepted', 'unknown')) then
      insert into public.commands (organization_id, charger_id, action, payload, operation_key, requested_by)
      values (v_s.organization_id, v_s.charger_id, 'RemoteStopTransaction', jsonb_build_object('transactionId', v_s.ocpp_transaction_id), 'stop:' || v_s.ocpp_transaction_id, null);
    end if;
  exception when others then
    raise warning 'eletroposto_on_meter_value: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists meter_values_eletroposto on public.meter_values;
create trigger meter_values_eletroposto after insert on public.meter_values
  for each row execute function public.eletroposto_on_meter_value();

-- 7) Visitante pede para parar a propria recarga (autorizado pelo token do pagamento).
create or replace function public.eletroposto_request_stop(p_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_p public.eletroposto_payments%rowtype;
  v_s public.sessions%rowtype;
begin
  select * into v_p from public.eletroposto_payments where public_token = p_token;
  if not found or v_p.status <> 'charging' or v_p.session_id is null then return 'not_charging'; end if;
  select * into v_s from public.sessions where id = v_p.session_id and ended_at is null;
  if not found or v_s.ocpp_transaction_id is null or v_s.ocpp_transaction_id < 1 then return 'not_charging'; end if;
  if exists (select 1 from public.commands c where c.charger_id = v_s.charger_id and c.action = 'RemoteStopTransaction'
             and c.payload ->> 'transactionId' = v_s.ocpp_transaction_id::text and c.status in ('pending', 'sent', 'accepted', 'unknown')) then return 'already_requested'; end if;
  insert into public.commands (organization_id, charger_id, action, payload, operation_key, requested_by)
  values (v_s.organization_id, v_s.charger_id, 'RemoteStopTransaction', jsonb_build_object('transactionId', v_s.ocpp_transaction_id), 'stop:' || v_s.ocpp_transaction_id, null);
  return 'requested';
end $$;

-- 8) Avanca estados que dependem do tempo ou do fim da sessao e calcula a liquidacao (consumo medido x tarifa congelada,
-- limitado ao valor pago). A devolucao em si e feita pelo servidor no Mercado Pago. p_id nulo = varre tudo.
create or replace function public.eletroposto_advance(p_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.eletroposto_payments%rowtype;
  v_s public.sessions%rowtype;
  v_cmd_status text;
  v_wh numeric;
  v_due numeric;
  v_charged numeric;
  v_n integer := 0;
begin
  -- Pagamento nao feito a tempo.
  update public.eletroposto_payments set status = 'expired', updated_at = now()
    where status = 'awaiting_payment' and expires_at < now() - interval '2 minutes' and (p_id is null or id = p_id);

  for r in select * from public.eletroposto_payments where status in ('starting', 'charging') and (p_id is null or id = p_id) order by created_at for update skip locked loop
    if r.status = 'starting' then
      select c.status into v_cmd_status from public.commands c where c.id = r.start_command_id;
      if v_cmd_status in ('rejected', 'failed') or r.paid_at < now() - interval '12 minutes' then
        update public.eletroposto_payments set status = 'settling', charged_amount = 0, refund_amount = cap_amount, energy_wh = 0,
          refund_reason = case when v_cmd_status in ('rejected', 'failed') then 'start_rejected' else 'start_timeout' end, updated_at = now() where id = r.id;
        v_n := v_n + 1;
      end if;
    else
      select * into v_s from public.sessions where id = r.session_id;
      if not found then continue; end if;
      if v_s.ended_at is null then
        -- Sessao aberta: carregador sem sinal ha muito tempo vira alerta (nao cobra nem devolve sozinho).
        if exists (select 1 from public.chargers c where c.id = r.charger_id and (not c.online or c.last_heartbeat_at is null or c.last_heartbeat_at < now() - interval '30 minutes')) then
          update public.eletroposto_payments set needs_attention = true, attention_reason = 'charger_offline_open_session' where id = r.id and not needs_attention;
        end if;
        continue;
      end if;
      if v_s.start_meter_wh is null or v_s.end_meter_wh is null or v_s.end_meter_wh < v_s.start_meter_wh then
        -- Leitura invalida (ex.: meterStop < meterStart): nada e cobrado nem devolvido automaticamente.
        update public.eletroposto_payments set status = 'review', needs_attention = true, attention_reason = 'invalid_meter_readings', updated_at = now() where id = r.id;
        v_n := v_n + 1;
        continue;
      end if;
      v_wh := v_s.end_meter_wh - v_s.start_meter_wh;
      v_due := case when v_wh <= 0 then 0 else round(v_wh / 1000.0 * r.price_per_kwh + r.session_fee, 2) end;
      v_charged := least(v_due, r.cap_amount);
      update public.eletroposto_payments set status = 'settling', energy_wh = v_wh, charged_amount = v_charged, refund_amount = r.cap_amount - v_charged,
        refund_reason = coalesce(refund_reason, case when v_due > r.cap_amount then 'cap_reached' else 'leftover' end),
        needs_attention = needs_attention or v_due > r.cap_amount,
        attention_reason = case when v_due > r.cap_amount then 'consumption_above_cap_operator_absorbs' else attention_reason end,
        updated_at = now() where id = r.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- Acesso: so service_role executa estas funcoes.
revoke all on function public.eletroposto_create_payment(text, text, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.eletroposto_mark_paid(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.eletroposto_request_stop(text) from public, anon, authenticated;
revoke all on function public.eletroposto_advance(uuid) from public, anon, authenticated;
revoke all on function public.eletroposto_on_session_start() from public, anon, authenticated;
revoke all on function public.eletroposto_on_meter_value() from public, anon, authenticated;
grant execute on function public.eletroposto_create_payment(text, text, text, text, numeric, text) to service_role;
grant execute on function public.eletroposto_mark_paid(uuid, text, numeric) to service_role;
grant execute on function public.eletroposto_request_stop(text) to service_role;
grant execute on function public.eletroposto_advance(uuid) to service_role;
grant all on public.eletroposto_points, public.eletroposto_payments to service_role;
