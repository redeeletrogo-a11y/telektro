// Pede a liquidacao (cobrar o consumo e devolver a sobra) logo depois que uma recarga termina, sem depender da pagina do cliente
// nem do cron diario. O servidor web e quem fala com o Mercado Pago; aqui so se chama a varredura dele (GET + Bearer CRON_SECRET).
// A varredura e idempotente (estados no banco + X-Idempotency-Key no Mercado Pago), entao chamar varias vezes nunca cobra/devolve em dobro.
type Log = (event: string, data?: Record<string, unknown>) => void;
export type SettlementOptions = {
  url?: string; secret?: string; fetchImpl?: typeof fetch; log?: Log;
  // Primeira chamada logo depois do fim; a segunda cobre o Pix, que o Mercado Pago so aceita devolver ~60 s apos o pagamento.
  delaysMs?: number[]; retryMs?: number; timeoutMs?: number;
};

export function createSettlementRequester(options: SettlementOptions = {}) {
  const url = options.url ?? process.env.SWEEP_URL;
  const secret = options.secret ?? process.env.CRON_SECRET;
  const doFetch = options.fetchImpl ?? fetch;
  const log: Log = options.log ?? (() => undefined);
  const delays = options.delaysMs ?? [2_000, 65_000];
  const retryMs = options.retryMs ?? 30_000;
  const timeoutMs = options.timeoutMs ?? 20_000;
  let running = false;
  let again = false;

  async function sweepOnce(): Promise<boolean> {
    if (!url || !secret) return false;
    if (running) { again = true; return true; } // uma varredura por vez; roda de novo ao terminar
    running = true;
    try {
      const response = await doFetch(url, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) { log("ocpp.settlement_request_failed", { status: response.status }); return false; }
      log("ocpp.settlement_requested");
      return true;
    } catch (error) {
      log("ocpp.settlement_request_failed", { error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
      return false;
    } finally {
      running = false;
      if (again) { again = false; void sweepOnce(); }
    }
  }

  function attempt(retriesLeft: number) {
    void sweepOnce().then((ok) => {
      // Falhou: tenta de novo uma vez; se continuar falhando, a varredura diaria (cron) liquida e o dono ve o pagamento pendente.
      if (!ok && url && secret && retriesLeft > 0) setTimeout(() => attempt(retriesLeft - 1), retryMs).unref();
    });
  }

  return {
    enabled: Boolean(url && secret),
    request() {
      if (!url || !secret) { log("ocpp.settlement_not_configured"); return; }
      for (const delay of delays) setTimeout(() => attempt(1), delay).unref();
    },
    sweepOnce,
  };
}
