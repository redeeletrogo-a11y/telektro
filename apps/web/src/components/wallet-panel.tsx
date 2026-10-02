"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { checkTopup, createTopup, type TopupState } from "@/app/wallet-actions";

export type LedgerRow = { id: number; entry_type: string; amount_cents: number; created_at: string };
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labels: Record<string, string> = { topup: "Recarga de saldo (Pix)", debit: "Recarga do carro", refund: "Estorno", adjustment: "Ajuste" };

export function WalletPanel({ organizationId, balanceCents, ledger }: { organizationId: string; balanceCents: number; ledger: LedgerRow[] }) {
  const [state, action, pending] = useActionState(createTopup, {} as TopupState);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const topupId = state.topup?.id;
  useEffect(() => {
    if (!topupId) return;
    const timer = window.setInterval(async () => {
      const result = await checkTopup(organizationId).catch(() => ({ paid: false }));
      if (result.paid) { window.clearInterval(timer); router.refresh(); }
    }, 7000);
    return () => window.clearInterval(timer);
  }, [topupId, organizationId, router]);
  const topup = state.topup;
  return <section className="panel" style={{ padding: 16 }}>
    <h2 className="panel-title">Meu saldo</h2>
    <p className="wallet-balance">{brl(balanceCents)}</p>
    {!topup && <form action={action} className="wallet-form">
      <input type="hidden" name="organization_id" value={organizationId}/>
      <label className="field-help" htmlFor="amount_reais">Adicionar saldo por Pix</label>
      <select id="amount_reais" name="amount_reais" defaultValue="50">{[20, 50, 100, 200].map((value) => <option key={value} value={value}>{brl(value * 100)}</option>)}</select>
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Gerando Pix..." : "Gerar Pix"}</button>
    </form>}
    {state.error && <small className="form-error" role="alert">{state.error}</small>}
    {topup && <div className="pix-box">
      <strong>Pix de {brl(topup.amount_cents)}</strong>
      {topup.qr_code_base64 && <img alt="QR Code Pix" width={180} height={180} src={`data:image/png;base64,${topup.qr_code_base64}`}/>}
      <textarea readOnly value={topup.qr_code ?? ""} rows={3} aria-label="Pix copia e cola"/>
      <button className="primary-button" type="button" onClick={() => { navigator.clipboard?.writeText(topup.qr_code ?? ""); setCopied(true); }}>{copied ? "Copiado!" : "Copiar código Pix"}</button>
      <span className="field-help">Pague no app do seu banco. O saldo entra sozinho em alguns segundos. O código vale por 1 hora.</span>
    </div>}
    {ledger.length > 0 && <div style={{ marginTop: 12 }}>{ledger.map((row) => <div className="resident-row" key={row.id}><span>{labels[row.entry_type] ?? row.entry_type} · {new Date(row.created_at).toLocaleDateString("pt-BR")}</span><span>{row.amount_cents > 0 ? "+" : ""}{brl(row.amount_cents)}</span></div>)}</div>}
  </section>;
}
