// Reduz o trafego de leitura no Supabase (a cota gratis de egress/logs estourou em 11/2026 por polling a cada 1-1,5 s).
// Poll de comandos: rapido (fastMs) por boostMs depois de qualquer atividade, lento (idleMs) quando ocioso.
// O timer base continua em fastMs; o gate decide se aquele tick roda.
export function createPollGate(options: { idleMs: number; boostMs?: number; now?: () => number }) {
  const now = options.now ?? Date.now;
  const boostMs = options.boostMs ?? 60_000;
  let lastRun = Number.NEGATIVE_INFINITY;
  let boostUntil = Number.NEGATIVE_INFINITY;
  return {
    due(): boolean {
      const t = now();
      if (t < boostUntil || t - lastRun >= options.idleMs) { lastRun = t; return true; }
      return false;
    },
    boost() { boostUntil = now() + boostMs; },
  };
}

// Deixa uma tarefa rodar no maximo 1 vez por intervalMs, mesmo que o chamador venha mais vezes.
export function createThrottle(intervalMs: number, now: () => number = Date.now) {
  let last = Number.NEGATIVE_INFINITY;
  return function due(): boolean {
    const t = now();
    if (t - last < intervalMs) return false;
    last = t;
    return true;
  };
}

export function readMsEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  return Math.min(max, Math.max(min, Number.isFinite(value) && raw !== undefined && raw !== "" ? value : fallback));
}
