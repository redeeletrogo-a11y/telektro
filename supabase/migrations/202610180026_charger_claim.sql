-- QR de provisionamento do carregador: o dono gera um link/QR no painel e quem escaneia
-- reivindica o carregador para a propria organizacao (fluxo "entregue configurado":
-- escaneou, entrou com Google, confirmou). Sem pagamentos e sem dados sensiveis no QR.

alter table public.chargers add column claim_token text;
create unique index chargers_claim_token_unique_idx on public.chargers (claim_token) where claim_token is not null;
comment on column public.chargers.claim_token is
  'Token do QR de provisionamento (capability URL). Coluna fora do grant de SELECT de authenticated da migration 012; acesso somente pelas RPCs desta migration.';

-- Token atual do QR (somente owner/admin da organizacao do carregador).
create function public.get_charger_claim(p_organization_id uuid, p_charger_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_token text;
begin
  if not public.has_org_role(p_organization_id, array['owner', 'admin']::public.organization_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select claim_token into v_token from public.chargers
    where id = p_charger_id and organization_id = p_organization_id and removed_at is null;
  if not found then raise exception 'CHARGER_NOT_FOUND' using errcode = '22023'; end if;
  return v_token;
end; $$;
revoke all on function public.get_charger_claim(uuid, uuid) from public, anon;
grant execute on function public.get_charger_claim(uuid, uuid) to authenticated;

-- Gera (ou gira) o token do QR. O QR/link anterior deixa de funcionar.
create function public.rotate_charger_claim(p_organization_id uuid, p_charger_id uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_token text;
begin
  if not public.has_org_role(p_organization_id, array['owner', 'admin']::public.organization_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  update public.chargers set claim_token = v_token
    where id = p_charger_id and organization_id = p_organization_id and removed_at is null;
  if not found then raise exception 'CHARGER_NOT_FOUND' using errcode = '22023'; end if;
  return v_token;
end; $$;
revoke all on function public.rotate_charger_claim(uuid, uuid) from public, anon;
grant execute on function public.rotate_charger_claim(uuid, uuid) to authenticated;

-- Desativa o QR sem gerar outro.
create function public.revoke_charger_claim(p_organization_id uuid, p_charger_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.has_org_role(p_organization_id, array['owner', 'admin']::public.organization_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.chargers set claim_token = null
    where id = p_charger_id and organization_id = p_organization_id and removed_at is null;
  if not found then raise exception 'CHARGER_NOT_FOUND' using errcode = '22023'; end if;
end; $$;
revoke all on function public.revoke_charger_claim(uuid, uuid) from public, anon;
grant execute on function public.revoke_charger_claim(uuid, uuid) to authenticated;

-- Previa publica do QR (o minimo para a tela de confirmacao). Sem linha = QR invalido.
create function public.get_charger_claim_preview(p_token text)
returns table (charge_point_id text, vendor text, model text) language sql stable security definer set search_path = '' as $$
  select c.charge_point_id, c.vendor, c.model
  from public.chargers c
  where c.claim_token = lower(btrim(p_token)) and c.removed_at is null;
$$;
revoke all on function public.get_charger_claim_preview(text) from public;
grant execute on function public.get_charger_claim_preview(text) to anon, authenticated;

-- Aceite do QR: transfere o carregador para uma organizacao da qual o usuario e dono.
-- A linha original e arquivada (historico de sessoes/medicao preservado) e uma copia ativa
-- e criada na organizacao de destino com a mesma credencial OCPP, entao o equipamento
-- fisico continua conectando sem reconfiguracao (o gateway localiza por charge_point_id).
create function public.accept_charger_claim(p_token text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_charger public.chargers%rowtype;
  v_org uuid;
  v_site uuid;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select * into v_charger from public.chargers
    where claim_token = lower(btrim(p_token)) and removed_at is null
    for update;
  if not found then raise exception 'CLAIM_INVALID' using errcode = '22023'; end if;

  -- Organizacao de destino: uma org da qual o usuario e dono, preferindo residencial.
  select o.id into v_org
  from public.memberships m join public.organizations o on o.id = m.organization_id
  where m.user_id = v_user and m.role = 'owner'
  order by (o.account_type = 'residencial') desc, o.created_at
  limit 1;
  if v_org is null then raise exception 'NO_ORGANIZATION' using errcode = '22023'; end if;

  -- Ja esta na organizacao do usuario: nada a transferir, o QR segue valendo.
  if v_charger.organization_id = v_org then return v_org; end if;

  -- Local de destino: primeiro local da organizacao; cria "Minha casa" se nao houver.
  select id into v_site from public.sites where organization_id = v_org order by created_at limit 1;
  if v_site is null then
    insert into public.sites (organization_id, name, timezone)
    values (v_org, 'Minha casa', 'America/Fortaleza')
    returning id into v_site;
  end if;

  update public.chargers set removed_at = now(), removed_by = v_user, claim_token = null
    where id = v_charger.id;

  insert into public.chargers (
    organization_id, site_id, charge_point_id, vendor, model, firmware, model_code, serial_number,
    connector_type, connector_count, max_power_kw, installation_power_kw, ocpp_version,
    technical_specs, capabilities, ocpp_credential_hash
  ) values (
    v_org, v_site, v_charger.charge_point_id, v_charger.vendor, v_charger.model, v_charger.firmware,
    v_charger.model_code, v_charger.serial_number, v_charger.connector_type, v_charger.connector_count,
    v_charger.max_power_kw, v_charger.installation_power_kw, v_charger.ocpp_version,
    v_charger.technical_specs, v_charger.capabilities, v_charger.ocpp_credential_hash
  );
  return v_org;
end; $$;
revoke all on function public.accept_charger_claim(text) from public, anon;
grant execute on function public.accept_charger_claim(text) to authenticated;
