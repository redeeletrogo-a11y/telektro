"use client";

import { useEffect, useState } from "react";
import { getEletropostoSales, type SalesPeriod, type SalesResult, type SalesRow } from "@/app/eletroposto-actions";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const periods: { id: SalesPeriod; label: string }[] = [{ id: "hoje", label: "Hoje" }, { id: "7d", label: "7 dias" }, { id: "30d", label: "30 dias" }, { id: "mes", label: "Este mês" }];
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function downloadCsv(rows: SalesRow[], period: string) {
  const esc = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [["Data", "Carregador", "Cliente", "Meio", "Reservado", "Cobrado", "kWh", "Taxa Telektro", "Líquido do dono", "Situação"].map(esc).join(";")];
  for (const row of rows) lines.push([when(row.at), row.charger, row.payer, row.method, row.reserved.toFixed(2).replace(".", ","), row.charged.toFixed(2).replace(".", ","), row.kwh.toFixed(2).replace(".", ","), row.fee.toFixed(2).replace(".", ","), (row.charged - row.fee).toFixed(2).replace(".", ","), row.label].map(esc).join(";"));
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `vendas-eletroposto-${period}.csv`; link.click();
  URL.revokeObjectURL(url);
}

export function EletropostoVendas({ organizationId }: { organizationId: string }) {
  const [period, setPeriod] = useState<SalesPeriod>("7d");
  const [result, setResult] = useState<SalesResult | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getEletropostoSales(organizationId, period).then((value) => { if (active) { setResult(value); setLoading(false); } });
    return () => { active = false; };
  }, [organizationId, period]);
  const pick = (next: SalesPeriod) => { setLoading(true); setPeriod(next); };
  const summary = result?.summary;
  return <div className="ep-panel">
    <div className="ep-actions" role="tablist" aria-label="Período">
      {periods.map((item) => <button key={item.id} role="tab" aria-selected={period === item.id} className={period === item.id ? "ep-primary" : ""} onClick={() => pick(item.id)}>{item.label}</button>)}
    </div>
    {result?.error && <p className="ep-msg err" role="alert">{result.error}</p>}
    {loading && !summary && <p className="ep-note">Carregando…</p>}
    {summary && <>
      <section className="ep-stats" aria-busy={loading}>
        <div className="panel ep-stat"><span>Vendido</span><strong>{summary.sold.count}</strong><small>{summary.sold.kwh.toLocaleString("pt-BR")} kWh</small></div>
        <div className="panel ep-stat"><span>Receita bruta</span><strong>{money(summary.sold.gross)}</strong><small>o que os clientes pagaram</small></div>
        <div className="panel ep-stat"><span>Taxa Telektro</span><strong>{money(summary.sold.fee)}</strong><small>Pix 5% · cartão 9%</small></div>
        <div className="panel ep-stat ep-stat-main"><span>Líquido do dono</span><strong>{money(summary.sold.net)}</strong><small>bruta menos a taxa</small></div>
        <div className="panel ep-stat"><span>Não vendido</span><strong>{summary.notSold.count}</strong><small>{summary.notSold.expired} não pagos · {summary.notSold.failed} carregador não iniciou · {summary.notSold.refundedFull} sem consumo</small></div>
        <div className="panel ep-stat"><span>Em andamento</span><strong>{summary.inProgress}</strong>{summary.attention > 0 ? <small className="ep-msg err">{summary.attention} precisam de atenção</small> : <small>tudo certo</small>}</div>
      </section>
      <section className="panel ep-card">
        <h3>Por carregador</h3>
        {summary.byCharger.length === 0 ? <p className="ep-note">Nenhuma venda neste período.</p> : <div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>Carregador</th><th>Vendas</th><th>kWh</th><th>Bruta</th><th>Líquido</th></tr></thead><tbody>
          {summary.byCharger.map((item) => <tr key={item.charger}><td>{item.charger}</td><td>{item.count}</td><td>{item.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td><td>{money(item.gross)}</td><td>{money(item.net)}</td></tr>)}
        </tbody></table></div>}
      </section>
      <section className="panel ep-card">
        <div className="ep-card-head"><h3>Pagamentos</h3>{result?.rows?.length ? <button className="ep-csv" onClick={() => downloadCsv(result.rows ?? [], period)}>Baixar CSV</button> : null}</div>
        {result?.truncated && <p className="ep-note">Mostrando os 1.000 mais recentes do período.</p>}
        {!result?.rows?.length ? <p className="ep-note">Nenhum pagamento neste período.</p> : <div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>Data</th><th>Carregador</th><th>Cliente</th><th>Meio</th><th>Reserva</th><th>Cobrado</th><th>kWh</th><th>Situação</th></tr></thead><tbody>
          {result.rows.slice(0, 100).map((row) => <tr key={row.id}><td>{when(row.at)}</td><td>{row.charger}</td><td>{row.payer}</td><td>{row.method}</td><td>{money(row.reserved)}</td><td>{row.charged > 0 ? money(row.charged) : "-"}</td><td>{row.kwh ? row.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "-"}</td><td>{row.label}</td></tr>)}
        </tbody></table></div>}
        {(result?.rows?.length ?? 0) > 100 && <p className="ep-note">Tela mostra 100; o CSV leva todos do período.</p>}
      </section>
    </>}
  </div>;
}
