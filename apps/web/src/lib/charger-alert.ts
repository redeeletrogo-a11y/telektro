// Alerta de carregador sem sinal para o painel do dono. O gateway marca online=false quando o carregador desconecta;
// o heartbeat velho cobre o caso do gateway cair antes de marcar. Carregador que nunca conectou nao gera alerta.
export const OFFLINE_ALERT_MINUTES = 5;

export type AlertCharger = { id: string; charge_point_id: string; online: boolean; last_heartbeat_at: string | null };

export type OfflineAlert = { id: string; name: string; since: string; minutes: number; hasOpenSession: boolean };

export function offlineAlerts(chargers: AlertCharger[], openSessionChargerIds: string[], nowMs: number): OfflineAlert[] {
  if (!nowMs) return [];
  const open = new Set(openSessionChargerIds);
  const out: OfflineAlert[] = [];
  for (const charger of chargers) {
    if (!charger.last_heartbeat_at) continue;
    const last = new Date(charger.last_heartbeat_at).getTime();
    if (Number.isNaN(last)) continue;
    const minutes = Math.floor((nowMs - last) / 60000);
    const stale = minutes >= OFFLINE_ALERT_MINUTES;
    // Offline por pouco tempo (reconexao curta) ou ainda dentro da margem: nao alarma.
    if (!stale) continue;
    out.push({ id: charger.id, name: charger.charge_point_id, since: charger.last_heartbeat_at, minutes, hasOpenSession: open.has(charger.id) });
  }
  return out.sort((a, b) => b.minutes - a.minutes);
}

export function sinceLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}
