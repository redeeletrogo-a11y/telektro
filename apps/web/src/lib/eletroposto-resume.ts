// Retorno a recarga em andamento no MESMO navegador. O link da recarga (token secreto) fica so no aparelho de quem pagou;
// o QR publico do ponto nunca revela nem controla a recarga de ninguem. Falha de storage (modo privado, bloqueio) e ignorada.
const PREFIX = "telektro:ep:";
const KEY_OK = /^[a-z0-9]{8,32}$/;

export function saveActiveSession(pointCode: string | null, token: string) {
  if (!pointCode || !KEY_OK.test(pointCode)) return;
  try { window.localStorage.setItem(PREFIX + pointCode, JSON.stringify({ token, savedAt: Date.now() })); } catch { /* sem storage: so o link manual */ }
}

export function readActiveSession(pointCode: string): string | null {
  if (!KEY_OK.test(pointCode)) return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + pointCode);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: unknown; savedAt?: unknown };
    const token = typeof parsed.token === "string" ? parsed.token : "";
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
    // Recarga nao dura dias: ignora registro muito antigo.
    if (!/^[a-f0-9]{48}$/.test(token) || Date.now() - savedAt > 24 * 3600 * 1000) { clearActiveSession(pointCode); return null; }
    return token;
  } catch { return null; }
}

export function clearActiveSession(pointCode: string | null) {
  if (!pointCode || !KEY_OK.test(pointCode)) return;
  try { window.localStorage.removeItem(PREFIX + pointCode); } catch { /* ignora */ }
}

export const ACTIVE_STATUSES = ["awaiting_payment", "paid", "starting", "charging", "settling"];
