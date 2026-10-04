"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { getChargersSummary, getStatement, saveCondoTariff, type ChargerSummaryRow, type StatementRow } from "@/app/condo-actions";
import type { FormState } from "@/app/workspace-actions";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const kwhFmt = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function monthOptions() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  });
}

export function CondoBilling({ organizationId, organizationName, tariff }: { organizationId: string; organizationName: string; tariff: { price_per_kwh: number; session_fee: number } | null }) {
  const [state, action, pending] = useActionState((previous: FormState, formData: FormData) => saveCondoTariff(organizationId, previous, formData), {} as FormState);
  const options = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(options[0].value);
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const [error, setError] = useState("");
  const [chargerRows, setChargerRows] = useState<ChargerSummaryRow[] | null>(null);
  const [prevTotals, setPrevTotals] = useState<{ kwh: number; amount: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const [year, mon] = month.split("-").map(Number);
    const previous = new Date(year, mon - 2, 1);
    const prevMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
    Promise.all([getChargersSummary(organizationId, month), getStatement(organizationId, prevMonth)]).then(([chargers, prev]) => {
      if (cancelled) return;
      setChargerRows(chargers.rows ?? null);
      setPrevTotals(prev.rows ? prev.rows.reduce((sum, row) => ({ kwh: sum.kwh + row.kwh, amount: sum.amount + row.amount }), { kwh: 0, amount: 0 }) : null);
    });
    return () => { cancelled = true; };
  }, [organizationId, month, state.success]);
  useEffect(() => {
    let cancelled = false;
    getStatement(organizationId, month).then((result) => {
      if (cancelled) return;
      setError(result.error ?? "");
      setRows(result.rows ?? null);
    });
    return () => { cancelled = true; };
  }, [organizationId, month, state.success]);
  const totals = (rows ?? []).reduce((sum, row) => ({ kwh: sum.kwh + row.kwh, amount: sum.amount + row.amount, sessions: sum.sessions + row.sessions }), { kwh: 0, amount: 0, sessions: 0 });
  const monthLabel = options.find((option) => option.value === month)?.label ?? month;
  const downloadCsv = () => {
    const header = ["Morador (e-mail)", "Recargas", "kWh", "Valor (R$)"];
    const lines = (rows ?? []).map((row) => [row.email, String(row.sessions), row.kwh.toFixed(2).replace(".", ","), row.amount.toFixed(2).replace(".", ",")]);
    lines.push(["TOTAL", String(totals.sessions), totals.kwh.toFixed(2).replace(".", ","), totals.amount.toFixed(2).replace(".", ",")]);
    const csv = "\uFEFF" + [header, ...lines].map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `extrato-${organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${month}.csv`; link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="condo-billing">
    <section className="panel no-print" style={{ padding: 16 }}>
      <h2 className="panel-title">Tarifa do condomínio</h2>
      <div className="panel-kicker">{tariff ? `Hoje: ${brl(tariff.price_per_kwh)} por kWh${tariff.session_fee > 0 ? ` + ${brl(tariff.session_fee)} por recarga` : ""}` : "Defina o valor do kWh para começar a cobrar os moradores."}</div>
      <form action={action} className="tariff-form">
        <label>Valor do kWh (R$)<input name="price_per_kwh" inputMode="decimal" required placeholder="0,95" defaultValue={tariff ? String(tariff.price_per_kwh).replace(".", ",") : ""}/></label>
        <label>Taxa por recarga (R$, opcional)<input name="session_fee" inputMode="decimal" placeholder="0,00" defaultValue={tariff && tariff.session_fee > 0 ? String(tariff.session_fee).replace(".", ",") : ""}/></label>
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar tarifa"}</button>
      </form>
      {state.error && <small className="form-error" role="alert">{state.error}</small>}
      {state.success && <small className="field-help" role="status">{state.success}</small>}
      <span className="field-help">A energia é medida pelo carregador (kWh). Mudar a tarifa vale só para as próximas recargas; as já feitas mantêm o valor da época.</span>
    </section>
    <section className="panel" style={{ padding: 16 }}>
      <h2 className="panel-title">Resumo do mês · {monthLabel}</h2>
      <div className="statement-actions no-print">
        <select value={month} onChange={(event) => { setRows(null); setChargerRows(null); setMonth(event.target.value); }} aria-label="Mês do resumo">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      </div>
      {rows === null ? <p className="field-help">Carregando...</p> : <>
        <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, margin: "10px 0" }}>
          <div><small>Energia total</small><strong style={{ display: "block", fontSize: 20 }}>{kwhFmt(totals.kwh)} kWh</strong></div>
          <div><small>Valor total</small><strong style={{ display: "block", fontSize: 20 }}>{brl(totals.amount)}</strong></div>
          <div><small>Recargas</small><strong style={{ display: "block", fontSize: 20 }}>{totals.sessions}</strong></div>
          <div><small>Moradores que carregaram</small><strong style={{ display: "block", fontSize: 20 }}>{rows.filter((row) => row.sessions > 0).length} de {rows.length}</strong></div>
        </div>
        {prevTotals && <p className="field-help">Mês anterior: {kwhFmt(prevTotals.kwh)} kWh · {brl(prevTotals.amount)}</p>}
      </>}
      <h3 className="panel-title" style={{ fontSize: 15, marginTop: 14 }}>Por carregador</h3>
      {chargerRows === null ? <p className="field-help">Carregando...</p> : !chargerRows.length ? <p className="field-help">Nenhum carregador cadastrado.</p> : <div style={{ overflowX: "auto" }}><table className="statement-table">
        <thead><tr><th>Carregador</th><th>Recargas</th><th>kWh</th><th>Valor</th></tr></thead>
        <tbody>{chargerRows.map((row) => <tr key={row.charger_id}><td>{row.charge_point_id}</td><td>{row.sessions}</td><td>{kwhFmt(row.kwh)}</td><td>{brl(row.amount)}</td></tr>)}</tbody>
      </table></div>}
      <h3 className="panel-title" style={{ fontSize: 15, marginTop: 14 }}>Moradores que mais consumiram</h3>
      {rows && rows.some((row) => row.sessions > 0) ? <div style={{ overflowX: "auto" }}><table className="statement-table">
        <thead><tr><th>Morador</th><th>kWh</th><th>Valor</th></tr></thead>
        <tbody>{[...rows].filter((row) => row.sessions > 0).sort((a, b) => b.kwh - a.kwh).slice(0, 10).map((row) => <tr key={row.user_id}><td>{row.email}</td><td>{kwhFmt(row.kwh)}</td><td>{brl(row.amount)}</td></tr>)}</tbody>
      </table></div> : rows && <p className="field-help">Nenhuma recarga neste mês.</p>}
    </section>
    <section className="panel statement" style={{ padding: 16 }}>
      <h2 className="panel-title">Extrato mensal por morador</h2>
      <div className="panel-kicker print-only">{organizationName} · {monthLabel}</div>
      <div className="statement-actions no-print">
        <select value={month} onChange={(event) => { setRows(null); setMonth(event.target.value); }} aria-label="Mês">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <button className="secondary-button" type="button" disabled={!rows?.length} onClick={downloadCsv}>Baixar planilha (CSV)</button>
        <button className="secondary-button" type="button" disabled={!rows?.length} onClick={() => window.print()}>Imprimir / salvar PDF</button>
      </div>
      {error && <small className="form-error" role="alert">{error}</small>}
      {rows === null && !error && <p className="field-help">Carregando...</p>}
      {rows && !rows.length && <p className="field-help">Nenhum morador cadastrado ainda.</p>}
      {rows && rows.length > 0 && <table className="statement-table">
        <thead><tr><th>Morador</th><th>Recargas</th><th>kWh</th><th>Valor</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.user_id}><td>{row.email}</td><td>{row.sessions}</td><td>{kwhFmt(row.kwh)}</td><td>{brl(row.amount)}</td></tr>)}</tbody>
        <tfoot><tr><td>Total</td><td>{totals.sessions}</td><td>{kwhFmt(totals.kwh)}</td><td>{brl(totals.amount)}</td></tr></tfoot>
      </table>}
    </section>
  </div>;
}
