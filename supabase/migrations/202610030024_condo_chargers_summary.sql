-- Painel do sindico: consumo por carregador no mes (somente leitura, so admin/sindico do condominio).
create or replace function public.condo_chargers_summary(p_organization_id uuid, p_month date)
returns table (charger_id uuid, charge_point_id text, sessions integer, kwh numeric, amount numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_org_admin(p_organization_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.account_type = 'condominio') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select coalesce((select s.timezone from public.sites s where s.organization_id = p_organization_id order by s.created_at limit 1), 'America/Fortaleza') into v_tz;
  v_start := date_trunc('month', p_month::timestamp) at time zone v_tz;
  v_end := (date_trunc('month', p_month::timestamp) + interval '1 month') at time zone v_tz;
  return query
    select ch.id, ch.charge_point_id, count(c.id)::int,
           coalesce(sum((c.tariff_snapshot ->> 'kwh')::numeric), 0), coalesce(sum(c.amount), 0)
    from public.chargers ch
    left join public.sessions s on s.charger_id = ch.id and s.organization_id = p_organization_id
      and s.ended_at >= v_start and s.ended_at < v_end
    left join public.charges c on c.session_id = s.id
    where ch.organization_id = p_organization_id
    group by ch.id, ch.charge_point_id
    order by 4 desc, ch.charge_point_id;
end $$;
revoke all on function public.condo_chargers_summary(uuid, date) from public, anon;
grant execute on function public.condo_chargers_summary(uuid, date) to authenticated;
