-- Morador inicia e para a propria recarga pelo celular (condominio). Idempotente.
-- Nao muda a RLS de commands: o morador continua SEM insert direto. Ele chama so estas duas funcoes,
-- que validam tudo no banco e enfileiram o MESMO comando RemoteStart/RemoteStop que o painel ja usa.
-- O gateway grava a sessao no nome de commands.requested_by, entao condo_charge_session cobra o morador certo.

-- Inicia uma recarga para o proprio morador. Retorna o id do comando.
create or replace function public.resident_request_start(p_charger_id uuid, p_connector_id integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_charger public.chargers%rowtype;
  v_connector integer := p_connector_id;
  v_eligible integer[];
  v_cmd uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_charger from public.chargers where id = p_charger_id and removed_at is null;
  if not found then raise exception 'CHARGER_NOT_FOUND' using errcode = '22023'; end if;
  -- Precisa ser MORADOR desta conta de condominio (equipe usa o painel).
  if not exists (select 1 from public.memberships m where m.organization_id = v_charger.organization_id and m.user_id = v_user and m.role::text = 'resident') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_charger.organization_id and o.account_type = 'condominio') then
    raise exception 'NOT_CONDOMINIO' using errcode = '22023';
  end if;
  if not public.org_has_access(v_charger.organization_id) then raise exception 'ACCESS_BLOCKED' using errcode = '42501'; end if;
  -- Sem tarifa ativa a sessao nao geraria cobranca: nao deixa carregar de graca.
  if not exists (
    select 1 from public.tariffs t
    where t.organization_id = v_charger.organization_id and t.active and t.currency = 'BRL'
      and t.valid_from <= now() and (t.valid_until is null or t.valid_until > now())
      and (t.site_id = v_charger.site_id or t.site_id is null)
  ) then raise exception 'NO_TARIFF' using errcode = '22023'; end if;
  if not v_charger.online or v_charger.last_heartbeat_at is null or v_charger.last_heartbeat_at < now() - interval '180 seconds' then
    raise exception 'CHARGER_OFFLINE' using errcode = '22023';
  end if;
  -- Uma recarga por vez por morador (em andamento ou pedido pendente).
  if exists (select 1 from public.sessions s where s.organization_id = v_charger.organization_id and s.authorized_user_id = v_user and s.ended_at is null)
     or exists (select 1 from public.commands c where c.organization_id = v_charger.organization_id and c.requested_by = v_user and c.action = 'RemoteStartTransaction' and c.status in ('pending', 'sent', 'accepted', 'unknown')) then
    raise exception 'ALREADY_CHARGING' using errcode = '23505';
  end if;
  -- Conector.
  select coalesce(array_agg(c.connector_id order by c.connector_id), '{}') into v_eligible
    from public.connectors c where c.charger_id = v_charger.id and c.connector_id >= 1 and c.status::text in ('Available', 'Preparing');
  if v_connector is not null then
    if v_connector < 1 or not (v_connector = any (v_eligible)) then raise exception 'CONNECTOR_UNAVAILABLE' using errcode = '22023'; end if;
  elsif coalesce(array_length(v_eligible, 1), 0) = 1 then
    v_connector := v_eligible[1];
  elsif coalesce(array_length(v_eligible, 1), 0) > 1 then
    raise exception 'CHOOSE_CONNECTOR' using errcode = '22023';
  elsif not exists (select 1 from public.connectors c where c.charger_id = v_charger.id) and v_charger.connector_count = 1 and v_charger.status::text in ('Available', 'Preparing') then
    v_connector := 1;
  else
    raise exception 'CONNECTOR_UNAVAILABLE' using errcode = '22023';
  end if;
  if exists (select 1 from public.sessions s where s.charger_id = v_charger.id and s.connector_id = v_connector and s.ended_at is null) then
    raise exception 'CONNECTOR_BUSY' using errcode = '23505';
  end if;
  if exists (select 1 from public.commands c where c.charger_id = v_charger.id and c.action = 'RemoteStartTransaction' and c.status in ('pending', 'sent', 'accepted', 'unknown')
             and (c.payload ->> 'connectorId' is null or (c.payload ->> 'connectorId')::int = v_connector)) then
    raise exception 'START_PENDING' using errcode = '23505';
  end if;
  insert into public.commands (organization_id, charger_id, action, payload, operation_key, requested_by)
  values (v_charger.organization_id, v_charger.id, 'RemoteStartTransaction',
          jsonb_build_object('idTag', 'TK' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 18), 'connectorId', v_connector),
          'start:' || v_connector, v_user)
  returning id into v_cmd;
  return v_cmd;
end $$;
revoke all on function public.resident_request_start(uuid, integer) from public, anon;
grant execute on function public.resident_request_start(uuid, integer) to authenticated;

-- Para a recarga do proprio morador (so a sessao dele). Parar nunca e bloqueado por assinatura.
create or replace function public.resident_request_stop(p_session_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.sessions%rowtype;
  v_charger public.chargers%rowtype;
  v_cmd uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_session from public.sessions where id = p_session_id and ended_at is null;
  -- Mesma resposta para "nao existe" e "nao e sua": nao revela sessoes de outras pessoas.
  if not found or v_session.authorized_user_id is distinct from v_user then raise exception 'SESSION_NOT_FOUND' using errcode = '22023'; end if;
  if not exists (select 1 from public.memberships m where m.organization_id = v_session.organization_id and m.user_id = v_user and m.role::text = 'resident') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_session.ocpp_transaction_id is null or v_session.ocpp_transaction_id < 1 then raise exception 'SESSION_NOT_FOUND' using errcode = '22023'; end if;
  select * into v_charger from public.chargers where id = v_session.charger_id and removed_at is null;
  if not found or not v_charger.online or v_charger.last_heartbeat_at is null or v_charger.last_heartbeat_at < now() - interval '180 seconds' then
    raise exception 'CHARGER_OFFLINE' using errcode = '22023';
  end if;
  if exists (select 1 from public.commands c where c.charger_id = v_session.charger_id and c.action = 'RemoteStopTransaction'
             and c.payload ->> 'transactionId' = v_session.ocpp_transaction_id::text and c.status in ('pending', 'sent', 'accepted', 'unknown')) then
    raise exception 'STOP_PENDING' using errcode = '23505';
  end if;
  insert into public.commands (organization_id, charger_id, action, payload, operation_key, requested_by)
  values (v_session.organization_id, v_session.charger_id, 'RemoteStopTransaction',
          jsonb_build_object('transactionId', v_session.ocpp_transaction_id), 'stop:' || v_session.ocpp_transaction_id, v_user)
  returning id into v_cmd;
  return v_cmd;
end $$;
revoke all on function public.resident_request_stop(uuid) from public, anon;
grant execute on function public.resident_request_stop(uuid) to authenticated;
