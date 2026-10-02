-- Condominio pos-pago: cada sessao de morador gera uma cobranca (kWh medido x tarifa do condominio + taxa por sessao).
-- O sindico ve o extrato mensal por morador; o morador ve o proprio consumo do mes. Idempotente.

-- 1) Cobranca da sessao, criada quando a sessao termina. Uma por sessao (charges.session_id e unico).
create or replace function public.condo_charge_session() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type public.account_type;
  v_tariff public.tariffs%rowtype;
  v_kwh numeric;
  v_amount numeric(12, 2);
begin
  if new.ended_at is null or old.ended_at is not null or new.authorized_user_id is null then return new; end if;
  select account_type into v_type from public.organizations where id = new.organization_id;
  if v_type is distinct from 'condominio' then return new; end if;
  -- So moradores cadastrados sao cobrados (equipe/sindico nao).
  if not exists (select 1 from public.memberships m where m.organization_id = new.organization_id and m.user_id = new.authorized_user_id and m.role::text = 'resident') then return new; end if;
  if new.start_meter_wh is null or new.end_meter_wh is null or new.end_meter_wh < new.start_meter_wh then return new; end if;
  select * into v_tariff from public.tariffs t
    where t.organization_id = new.organization_id and t.active and t.currency = 'BRL'
      and t.valid_from <= coalesce(new.started_at, now()) and (t.valid_until is null or t.valid_until > coalesce(new.started_at, now()))
      and (t.site_id = new.site_id or t.site_id is null)
    order by (t.site_id is not null) desc, t.valid_from desc limit 1;
  if not found then return new; end if;
  v_kwh := (new.end_meter_wh - new.start_meter_wh) / 1000.0;
  v_amount := round(v_kwh * v_tariff.price_per_kwh + v_tariff.session_fee, 2);
  insert into public.charges (organization_id, session_id, tariff_id, currency, amount, status, tariff_snapshot)
  values (new.organization_id, new.id, v_tariff.id, 'BRL', v_amount, 'issued',
    jsonb_build_object('kwh', round(v_kwh, 3), 'price_per_kwh', v_tariff.price_per_kwh, 'session_fee', v_tariff.session_fee))
  on conflict (session_id) do nothing;
  return new;
end $$;
drop trigger if exists sessions_condo_charge on public.sessions;
create trigger sessions_condo_charge after update of ended_at on public.sessions
  for each row execute function public.condo_charge_session();

-- 2) Extrato mensal por morador (somente admin/sindico da conta). p_month = qualquer data do mes.
create or replace function public.condo_statement(p_organization_id uuid, p_month date)
returns table (user_id uuid, email text, sessions integer, kwh numeric, amount numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_org_admin(p_organization_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select coalesce((select s.timezone from public.sites s where s.organization_id = p_organization_id order by s.created_at limit 1), 'America/Fortaleza') into v_tz;
  v_start := date_trunc('month', p_month::timestamp) at time zone v_tz;
  v_end := (date_trunc('month', p_month::timestamp) + interval '1 month') at time zone v_tz;
  return query
    select m.user_id, u.email::text, count(c.id)::int,
           coalesce(sum((c.tariff_snapshot ->> 'kwh')::numeric), 0), coalesce(sum(c.amount), 0)
    from public.memberships m
    join auth.users u on u.id = m.user_id
    left join public.sessions s on s.organization_id = p_organization_id and s.authorized_user_id = m.user_id
      and s.ended_at >= v_start and s.ended_at < v_end
    left join public.charges c on c.session_id = s.id
    where m.organization_id = p_organization_id and m.role::text = 'resident'
    group by m.user_id, u.email
    order by u.email;
end $$;
revoke all on function public.condo_statement(uuid, date) from public, anon;
grant execute on function public.condo_statement(uuid, date) to authenticated;

-- 3) Consumo do proprio morador no mes (sessao a sessao).
create or replace function public.my_condo_usage(p_organization_id uuid, p_month date)
returns table (ended_at timestamptz, kwh numeric, price_per_kwh numeric, amount numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_org_member(p_organization_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select coalesce((select s.timezone from public.sites s where s.organization_id = p_organization_id order by s.created_at limit 1), 'America/Fortaleza') into v_tz;
  v_start := date_trunc('month', p_month::timestamp) at time zone v_tz;
  v_end := (date_trunc('month', p_month::timestamp) + interval '1 month') at time zone v_tz;
  return query
    select s.ended_at, (c.tariff_snapshot ->> 'kwh')::numeric, (c.tariff_snapshot ->> 'price_per_kwh')::numeric, c.amount
    from public.sessions s join public.charges c on c.session_id = s.id
    where s.organization_id = p_organization_id and s.authorized_user_id = (select auth.uid())
      and s.ended_at >= v_start and s.ended_at < v_end
    order by s.ended_at desc;
end $$;
revoke all on function public.my_condo_usage(uuid, date) from public, anon;
grant execute on function public.my_condo_usage(uuid, date) to authenticated;
