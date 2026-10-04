-- Eletroposto: cartao de credito (reserva + captura parcial) e taxa da plataforma por meio de pagamento.
-- Pix continua igual. Rode em pedacos pequenos (arquivos .txt do PR) "Run without RLS".

-- 1) Taxa da plataforma por ponto: Pix 5%, cartao 9% (sobre o valor efetivamente cobrado).
alter table public.eletroposto_points add column if not exists platform_fee_pix_pct numeric(5, 2) not null default 5 check (platform_fee_pix_pct between 0 and 30);
alter table public.eletroposto_points add column if not exists platform_fee_card_pct numeric(5, 2) not null default 9 check (platform_fee_card_pct between 0 and 30);

-- 2) Pagamento: meio, snapshot da taxa e valor capturado.
alter table public.eletroposto_payments add column if not exists payment_method text not null default 'pix' check (payment_method in ('pix', 'card'));
alter table public.eletroposto_payments add column if not exists fee_pct numeric(5, 2);
alter table public.eletroposto_payments add column if not exists fee_amount numeric(10, 2);
alter table public.eletroposto_payments add column if not exists card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$');
alter table public.eletroposto_payments add column if not exists card_brand text check (card_brand is null or char_length(card_brand) <= 30);

-- 3) Criacao do pagamento aceita o meio (pix|card) e grava a taxa vigente.
drop function if exists public.eletroposto_create_payment(text, text, text, text, numeric, text);
create or replace function public.eletroposto_create_payment(p_code text, p_name text, p_email text, p_phone text, p_amount numeric, p_ip_hash text, p_method text default 'pix')
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
  if p_method not in ('pix', 'card') then raise exception 'METHOD_INVALID' using errcode = '22023'; end if;
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
      cap_amount, price_per_kwh, session_fee, stop_margin_pct, expires_at, payment_method, fee_pct)
  values (v_id, v_point.id, v_point.organization_id, v_charger.id, v_point.connector_id, btrim(p_name), lower(btrim(p_email)), nullif(btrim(coalesce(p_phone, '')), ''), now(), p_ip_hash,
      p_amount, v_tariff.price_per_kwh, v_tariff.session_fee, v_point.stop_margin_pct, now() + interval '10 minutes', p_method,
      case when p_method = 'card' then v_point.platform_fee_card_pct else v_point.platform_fee_pix_pct end)
  returning public.eletroposto_payments.public_token into v_token;
  return query select v_id, v_token;
end $$;
revoke all on function public.eletroposto_create_payment(text, text, text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.eletroposto_create_payment(text, text, text, text, numeric, text, text) to service_role;
