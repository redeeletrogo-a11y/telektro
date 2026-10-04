-- Fatura usa o pico de moradores (ou o total atual, se maior).
create or replace function public.condo_invoice(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_prev date := (date_trunc('month', now() at time zone 'America/Fortaleza') - interval '1 month')::date;
  v_start timestamptz;
  v_end timestamptz;
  v_residents integer;
  v_extra integer;
  v_energy numeric := 0;
  v_fee numeric(10,2) := 0;
  v_fee_month text := null;
  v_total numeric(10,2);
begin
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.account_type = 'condominio') then return null; end if;
  select coalesce((select s.timezone from public.sites s where s.organization_id = p_organization_id order by s.created_at limit 1), 'America/Fortaleza') into v_tz;
  v_start := v_prev::timestamp at time zone v_tz;
  v_end := (v_prev::timestamp + interval '1 month') at time zone v_tz;
  select greatest((select o.resident_peak from public.organizations o where o.id = p_organization_id), count(*)::int) into v_residents
    from public.memberships m where m.organization_id = p_organization_id and m.role::text = 'resident';
  v_extra := greatest(0, v_residents - 5);
  select coalesce(sum(c.amount), 0) into v_energy from public.charges c join public.sessions s on s.id = c.session_id
    where c.organization_id = p_organization_id and s.ended_at >= v_start and s.ended_at < v_end;
  if v_energy > 0 and not exists (
    select 1 from public.pix_charges p where p.organization_id = p_organization_id and p.status in ('paid', 'pending') and p.details ->> 'fee_month' = v_prev::text
  ) then
    v_fee := round(v_energy * 0.01, 2);
    v_fee_month := v_prev::text;
  end if;
  v_total := round(199.00 + v_extra * 19.90 + v_fee, 2);
  return jsonb_build_object('residents', v_residents, 'extra_residents', v_extra, 'base', 199.00, 'extra_amount', round(v_extra * 19.90, 2),
    'energy_prev_month', v_energy, 'fee', v_fee, 'fee_month', v_fee_month, 'total', v_total);
end $$;

-- Depois de uma fatura paga, o pico volta para o total atual.
create or replace function public.condo_close_cycle(p_organization_id uuid) returns void language sql security definer set search_path = '' as $$
  update public.organizations o set resident_peak = (select count(*)::int from public.memberships m where m.organization_id = o.id and m.role::text = 'resident')
  where o.id = p_organization_id and o.account_type = 'condominio';
$$;
revoke all on function public.condo_close_cycle(uuid) from public, anon, authenticated;
grant execute on function public.condo_close_cycle(uuid) to service_role;
revoke all on function public.condo_invoice(uuid) from public, anon, authenticated;
grant execute on function public.condo_invoice(uuid) to service_role;
