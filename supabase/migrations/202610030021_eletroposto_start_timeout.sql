-- Comando de inicio que expira (charger_response_timeout) devolve o Pix na hora, sem esperar 12 minutos.
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
  update public.eletroposto_payments set status = 'expired', updated_at = now()
    where status = 'awaiting_payment' and expires_at < now() - interval '2 minutes' and (p_id is null or id = p_id);

  for r in select * from public.eletroposto_payments where status in ('starting', 'charging') and (p_id is null or id = p_id) order by created_at for update skip locked loop
    if r.status = 'starting' then
      select c.status into v_cmd_status from public.commands c where c.id = r.start_command_id;
      if v_cmd_status in ('rejected', 'failed', 'timeout') or r.paid_at < now() - interval '12 minutes' then
        update public.eletroposto_payments set status = 'settling', charged_amount = 0, refund_amount = cap_amount, energy_wh = 0,
          refund_reason = case when v_cmd_status in ('rejected', 'failed', 'timeout') then 'start_rejected' else 'start_timeout' end, updated_at = now() where id = r.id;
        v_n := v_n + 1;
      end if;
    else
      select * into v_s from public.sessions where id = r.session_id;
      if not found then continue; end if;
      if v_s.ended_at is null then
        if exists (select 1 from public.chargers c where c.id = r.charger_id and (not c.online or c.last_heartbeat_at is null or c.last_heartbeat_at < now() - interval '30 minutes')) then
          update public.eletroposto_payments set needs_attention = true, attention_reason = 'charger_offline_open_session' where id = r.id and not needs_attention;
        end if;
        continue;
      end if;
      if v_s.start_meter_wh is null or v_s.end_meter_wh is null or v_s.end_meter_wh < v_s.start_meter_wh then
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
