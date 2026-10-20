-- Parte B: fecha sozinho sessoes "orfas" (carregador sumiu ou reiniciou sem mandar StopTransaction).
-- Rode depois da parte A. Chamada pelo gateway OCPP a cada minuto e pela varredura do eletroposto.
-- Regra: sessao aberta e (sem sinal do carregador ha p_minutes OU o carregador reiniciou depois do inicio ha mais de 3 min).
-- Fecha com a ultima leitura de energia (MeterValues). Sem leitura = consumo zero (devolucao total no eletroposto).
-- Marca o pagamento como "precisa de atencao" e deixa a liquidacao normal (eletroposto_advance) cobrar o medido e devolver a sobra.
create or replace function public.telektro_close_orphan_sessions(p_minutes integer default 20)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  s public.sessions%rowtype;
  v_last_hb timestamptz;
  v_boot timestamptz;
  v_mv_at timestamptz;
  v_mv_value numeric;
  v_mv_unit text;
  v_activity timestamptz;
  v_end_wh numeric;
  v_ended timestamptz;
  v_n integer := 0;
  v_pid uuid;
begin
  if p_minutes is null or p_minutes < 5 or p_minutes > 240 then raise exception 'INVALID_MINUTES'; end if;
  for s in select * from public.sessions where ended_at is null and started_at is not null order by started_at for update skip locked loop
    select c.last_heartbeat_at, c.last_boot_at into v_last_hb, v_boot from public.chargers c where c.id = s.charger_id;
    v_mv_at := null; v_mv_value := null; v_mv_unit := null;
    select m.sampled_at, m.value, m.unit into v_mv_at, v_mv_value, v_mv_unit
      from public.meter_values m
      where m.session_id = s.id and m.measurand = 'Energy.Active.Import.Register'
      order by m.sampled_at desc, m.id desc limit 1;
    v_activity := greatest(s.started_at, coalesce(v_last_hb, s.started_at), coalesce(v_mv_at, s.started_at),
      coalesce((select max(m2.created_at) from public.meter_values m2 where m2.session_id = s.id), s.started_at));
    if not (v_activity < now() - make_interval(mins => p_minutes)
            or (v_boot is not null and v_boot > s.started_at and v_boot < now() - interval '3 minutes')) then
      continue;
    end if;
    if s.start_meter_wh is null then
      v_end_wh := null;
    elsif v_mv_value is null then
      v_end_wh := s.start_meter_wh;
    else
      v_end_wh := case when lower(coalesce(v_mv_unit, 'Wh')) = 'kwh' then v_mv_value * 1000 else v_mv_value end;
      if v_end_wh < s.start_meter_wh then v_end_wh := s.start_meter_wh; end if;
    end if;
    v_ended := least(now(), greatest(s.started_at, coalesce(v_mv_at, v_activity)));
    update public.sessions set ended_at = v_ended, end_meter_wh = v_end_wh, stop_reason = 'OrphanTimeout' where id = s.id and ended_at is null;
    insert into public.commands (organization_id, charger_id, action, payload, operation_key, requested_by)
    select s.organization_id, s.charger_id, 'RemoteStopTransaction', jsonb_build_object('transactionId', s.ocpp_transaction_id), 'stop:' || s.ocpp_transaction_id, null
    where s.ocpp_transaction_id is not null and s.ocpp_transaction_id > 0
      and not exists (select 1 from public.commands x where x.charger_id = s.charger_id and x.operation_key = 'stop:' || s.ocpp_transaction_id and x.status in ('pending', 'sent', 'accepted'));
    select p.id into v_pid from public.eletroposto_payments p where p.session_id = s.id and p.status = 'charging' for update;
    if v_pid is not null then
      update public.eletroposto_payments set needs_attention = true, attention_reason = 'orphan_session_closed', updated_at = now() where id = v_pid;
      perform public.eletroposto_advance(v_pid);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.telektro_close_orphan_sessions(integer) from public, anon, authenticated;
grant execute on function public.telektro_close_orphan_sessions(integer) to service_role;
