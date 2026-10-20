// Pure helpers. Amounts are summed in cents; never infer a missing commission.
export type RepassePayment = { id: string; settled_at: string; charged_amount: number | null; fee_amount: number | null; needs_attention: boolean | null; payment_method: string; cap_amount?: number | null; refund_amount?: number | null };
export function summarizeRepasse(rows: RepassePayment[]) {
  let gross = 0, fee = 0, excluded = 0;
  const eligible: { id: string; at: string; method: string; reserved: number; gross: number; refunded: number; fee: number; net: number }[] = [];
  for (const row of rows) {
    const amount = Number(row.charged_amount);
    const commission = Number(row.fee_amount);
    if (row.charged_amount === null || row.fee_amount === null || row.needs_attention || !Number.isFinite(amount) || !Number.isFinite(commission) || amount < 0 || commission < 0 || commission > amount) { excluded++; continue; }
    if (amount === 0) continue;
    const cents = Math.round(amount * 100), feeCents = Math.round(commission * 100);
    gross += cents; fee += feeCents;
    eligible.push({ id: row.id, at: row.settled_at, method: row.payment_method === 'card' ? 'Cartão' : 'Pix', reserved: Number(row.cap_amount ?? 0), refunded: Number(row.refund_amount ?? 0), gross: cents / 100, fee: feeCents / 100, net: (cents - feeCents) / 100 });
  }
  return { gross: gross / 100, fee: fee / 100, net: (gross - fee) / 100, excluded, rows: eligible };
}
export function monthRange(month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, m] = month.split('-').map(Number);
  return { from: new Date(Date.UTC(year, m - 1, 1, 3)).toISOString(), to: new Date(Date.UTC(year, m, 1, 3)).toISOString() };
}
export function normalizePix(kind: string, raw: string): string | null {
  const value = raw.trim();
  if (kind === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200 ? value.toLowerCase() : null;
  if (kind === 'telefone') return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
  if (kind === 'aleatoria') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
  if (kind === 'cpf' || kind === 'cnpj') {
    const digits = value.replace(/[.\/\-\s]/g, '');
    // Format check only: receiving institution must verify ownership before a transfer.
    return new RegExp(`^\\d{${kind === 'cpf' ? 11 : 14}}$`).test(digits) ? digits : null;
  }
  return null;
}
export function csvCell(value: string | number) {
  const text = String(value);
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`;
}
// "A repassar" = parte do dono no mes menos o que o dono ja confirmou ter recebido. Nunca negativo na tela.
export type PayoutRecord = { id: string; amount: number; paid_on: string; note: string | null };
export function balanceRepasse(netReais: number, payouts: { amount: number }[]) {
  const net = Math.round(netReais * 100);
  const paid = payouts.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
  return { paid: paid / 100, due: Math.max(net - paid, 0) / 100, overpaid: Math.max(paid - net, 0) / 100 };
}
