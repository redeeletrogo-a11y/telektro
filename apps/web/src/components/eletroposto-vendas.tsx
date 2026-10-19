"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CircleDollarSign, Coins, PlugZap, TrendingUp, Wallet, Zap } from "lucide-react";
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { getEletropostoSales, type SalesPeriod, type SalesResult, type SalesRow } from "@/app/eletroposto-actions";

type Site = { id: string; name: string };
type Charger = { site_id: string; charge_point_id: string; online: boolean };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const periods: { id: SalesPeriod; label: string }[] = [{ id: "hoje", label: "Hoje" }, { id: "7d", label: "7 dias" }, { id: "30d", label: "30 dias" }, { id: "mes", label: "Este mês" }];
const palette = ["var(--chart-teal)", "var(--chart-amber)", "var(--chart-red)", "var(--chart-violet)", "var(--chart-blue)"];
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const dayLabel = (key: string) => new Date(`${key}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit" });

function downloadCsv(rows: SalesRow[], period: string) {
  const esc = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [["Data", "Carregador", "Cliente", "Meio", "Reservado", "Cobrado", "kWh", "Taxa Telektro", "Líquido do dono", "Situação"].map(esc).join(";")];
  for (const row of rows) lines.push([when(row.at), row.charger, row.payer, row.method, row.reserved.toFixed(2).replace(".", ","), row.charged.toFixed(2).replace(".", ","), row.kwh.toFixed(2).replace(".", ","), row.fee.toFixed(2).replace(".", ","), (row.charged - row.fee).toFixed(2).replace(".", ","), row.label].map(esc).join(";"));
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `vendas-eletroposto-${period}.csv`; link.click(); URL.revokeObjectURL(url);
}

function Stat({ icon: Icon, label, value, detail, highlight = false }: { icon: typeof Zap; label: string; value: string; detail: string; highlight?: boolean }) {
  return <article className={`panel ep-stat ep-stat-visual${highlight ? " ep-stat-main" : ""}`}>
    <div className="ep-stat-top"><span className="ep-stat-icon"><Icon size={16}/></span><span>{label}</span></div>
    <strong>{value}</strong><small>{detail}</small>
  </article>;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="ep-tooltip"><strong>{label}</strong>{payload.map((item) => <div key={item.name}><i style={{ background: item.color }}/> {item.name}: {item.name === "Energia" ? `${Number(item.value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh` : money(Number(item.value))}</div>)}</div>;
}

export function EletropostoVendas({ organizationId, sites, chargers, removedChargers = [] }: { organizationId: string; sites: Site[]; chargers: Charger[]; removedChargers?: Charger[] }) {
  const [period, setPeriod] = useState<SalesPeriod>("7d");
  const [siteId, setSiteId] = useState("all");
  const [result, setResult] = useState<SalesResult | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getEletropostoSales(organizationId, period).then((value) => { if (active) { setResult(value); setLoading(false); } });
    return () => { active = false; };
  }, [organizationId, period]);
  const pick = (next: SalesPeriod) => { setLoading(true); setPeriod(next); };
  const chargerLocations = useMemo(() => {
    const map = new Map<string, string>();
    for (const charger of [...chargers, ...removedChargers]) map.set(charger.charge_point_id, charger.site_id);
    return map;
  }, [chargers, removedChargers]);
  const siteNames = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);
  const rows = useMemo(() => (result?.rows ?? []).filter((row) => siteId === "all" || chargerLocations.get(row.charger) === siteId), [result, siteId, chargerLocations]);
  const byCharger = useMemo(() => (result?.summary?.byCharger ?? []).filter((item) => siteId === "all" || chargerLocations.get(item.charger) === siteId), [result, siteId, chargerLocations]);
  const bySite = useMemo(() => {
    const totals = new Map<string, { site: string; count: number; kwh: number; gross: number; net: number }>();
    for (const item of result?.summary?.byCharger ?? []) {
      const mappedSite = chargerLocations.get(item.charger);
      const key = mappedSite && siteNames.has(mappedSite) ? mappedSite : "unknown";
      const entry = totals.get(key) ?? { site: key === "unknown" ? "Local não informado" : siteNames.get(key)!, count: 0, kwh: 0, gross: 0, net: 0 };
      entry.count += item.count; entry.kwh += item.kwh; entry.gross += item.gross; entry.net += item.net; totals.set(key, entry);
    }
    return [...totals.values()].sort((a, b) => b.gross - a.gross);
  }, [result, chargerLocations, siteNames]);
  const daily = useMemo(() => {
    const totals = new Map<string, { date: string; gross: number; kwh: number }>();
    for (const row of rows) {
      if (row.label !== "Vendido") continue;
      const key = dayKey(row.at);
      const item = totals.get(key) ?? { date: key, gross: 0, kwh: 0 };
      item.gross += row.charged; item.kwh += row.kwh; totals.set(key, item);
    }
    return [...totals.values()].sort((a, b) => a.date.localeCompare(b.date)).map((item) => ({ ...item, label: dayLabel(item.date) }));
  }, [rows]);
  const selectedSummary = useMemo(() => {
    const soldRows = rows.filter((row) => row.label === "Vendido");
    const notSoldRows = rows.filter((row) => row.label.startsWith("Não pago") || row.label.startsWith("Devolvido"));
    const activeRows = rows.filter((row) => row.label === "Em andamento");
    return {
      count: soldRows.length,
      kwh: soldRows.reduce((sum, row) => sum + row.kwh, 0),
      gross: soldRows.reduce((sum, row) => sum + row.charged, 0),
      fee: soldRows.reduce((sum, row) => sum + row.fee, 0),
      net: soldRows.reduce((sum, row) => sum + row.charged - row.fee, 0),
      notSold: notSoldRows.length,
      expired: notSoldRows.filter((row) => row.label.startsWith("Não pago")).length,
      failed: notSoldRows.filter((row) => row.label.includes("não iniciou")).length,
      refunded: notSoldRows.filter((row) => row.label.includes("Devolvido") && !row.label.includes("não iniciou")).length,
      active: activeRows.length,
      attention: rows.filter((row) => row.label === "Precisa de atenção").length,
    };
  }, [rows]);
  const summary = result?.summary;
  const sold = siteId === "all" && summary ? summary.sold : selectedSummary;
  const notSoldCount = siteId === "all" && summary ? summary.notSold.count : selectedSummary.notSold;
  const expiredCount = siteId === "all" && summary ? summary.notSold.expired : selectedSummary.expired;
  const failedCount = siteId === "all" && summary ? summary.notSold.failed : selectedSummary.failed;
  const refundCount = siteId === "all" && summary ? summary.notSold.refundedFull : selectedSummary.refunded;
  const activeCount = siteId === "all" && summary ? summary.inProgress : selectedSummary.active;
  const attentionCount = siteId === "all" && summary ? summary.attention : selectedSummary.attention;
  const localOnline = (siteId === "all" ? chargers : chargers.filter((charger) => charger.site_id === siteId)).filter((charger) => charger.online).length;
  const chartSites = siteId === "all" ? bySite : bySite.filter((item) => item.site === siteNames.get(siteId));
  return <div className="ep-panel ep-dashboard">
    <header className="ep-toolbar">
      <div><p className="ep-eyebrow">VISÃO FINANCEIRA</p><h2>Vendas do eletroposto</h2><p className="ep-note">Receita, energia e repasses em um só lugar.</p></div>
      <div className="ep-controls">
        <div className="ep-actions" role="tablist" aria-label="Período">
          {periods.map((item) => <button key={item.id} role="tab" aria-selected={period === item.id} className={period === item.id ? "ep-primary" : ""} onClick={() => pick(item.id)}>{item.label}</button>)}
        </div>
        {sites.length >= 2 && <label className="ep-site-filter">Local<select value={siteId} onChange={(event) => setSiteId(event.target.value)}><option value="all">Todos os locais</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}
      </div>
    </header>
    {result?.error && <p className="ep-msg err" role="alert">{result.error}</p>}
    {loading && !summary && <section className="ep-stats ep-skeleton" aria-label="Carregando vendas">{Array.from({ length: 7 }, (_, i) => <div className="panel ep-stat" key={i}/>)}</section>}
    {summary && <>
      <section className="ep-stats" aria-busy={loading}>
        <Stat icon={PlugZap} label="Sessões vendidas" value={String(sold.count)} detail={`${sold.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh entregues`}/>
        <Stat icon={Zap} label="Energia vendida" value={`${sold.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh`} detail="nas sessões concluídas"/>
        <Stat icon={CircleDollarSign} label="Receita bruta" value={money(sold.gross)} detail="valor cobrado dos clientes"/>
        <Stat icon={TrendingUp} label="Taxa Telektro" value={money(sold.fee)} detail="Pix e cartão"/>
        <Stat icon={Wallet} label="Líquido do dono" value={money(sold.net)} detail="após a taxa Telektro" highlight/>
        <Stat icon={Coins} label="Não vendido" value={String(notSoldCount)} detail={`${expiredCount} não pagos · ${failedCount} não iniciaram · ${refundCount} devolvidos`}/>
        <Stat icon={AlertCircle} label="Em andamento" value={String(activeCount)} detail={attentionCount ? `${attentionCount} precisam de atenção` : "sem alertas de atenção"}/>
      </section>
      <section className="panel ep-card ep-chart-card">
        <div className="ep-card-head"><div><h3>Receita e energia por dia</h3><p className="ep-note">Considera pagamentos concluídos no período.</p></div><span className="ep-period-tag">{periods.find((item) => item.id === period)?.label}</span></div>
        {daily.length === 0 ? <p className="ep-note ep-chart-empty">Nenhuma venda concluída neste período.</p> : <div className="ep-chart ep-chart-wide"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={daily} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24}/>
          <YAxis yAxisId="money" tickFormatter={(value: number) => `R$${value}`} tickLine={false} axisLine={false} width={58}/><YAxis yAxisId="energy" orientation="right" tickFormatter={(value: number) => `${value}`} tickLine={false} axisLine={false} width={38}/>
          <Tooltip content={<ChartTooltip/>}/><Bar yAxisId="money" dataKey="gross" name="Receita" fill="var(--chart-teal)" radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive={true} animationDuration={350}/>
          <Line yAxisId="energy" dataKey="kwh" name="Energia" type="monotone" stroke="var(--chart-amber)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-amber)" }} activeDot={{ r: 5 }} isAnimationActive={true} animationDuration={350}/>
        </ComposedChart></ResponsiveContainer></div>}
        <div className="ep-legend"><span><i className="ep-legend-teal"/>Receita (R$)</span><span><i className="ep-legend-amber"/>Energia (kWh)</span></div>
      </section>
      <div className="ep-analytics-grid">
        {sites.length >= 2 && <section className="panel ep-card ep-site-chart"><div className="ep-card-head"><div><h3>Vendas por local</h3><p className="ep-note">Receita das sessões concluídas.</p></div></div>
          {chartSites.length === 0 ? <p className="ep-note">Nenhuma venda por local neste período.</p> : <div className="ep-donut-layout"><div className="ep-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartSites} dataKey="gross" nameKey="site" innerRadius="61%" outerRadius="82%" paddingAngle={3} stroke="none" isAnimationActive={true} animationDuration={350}>{chartSites.map((item, index) => <Cell key={item.site} fill={palette[index % palette.length]}/>)}</Pie><Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--ink)" }} itemStyle={{ color: "var(--ink)" }} labelStyle={{ color: "var(--muted)" }}/></PieChart></ResponsiveContainer><div className="ep-donut-center"><strong>{money(chartSites.reduce((sum, item) => sum + item.gross, 0))}</strong><small>receita bruta</small></div></div>
            <div className="ep-site-legend">{chartSites.map((item, index) => <button key={item.site} onClick={() => { const selected = sites.find((site) => site.name === item.site); if (selected) setSiteId(selected.id); }}><i style={{ background: palette[index % palette.length] }}/><span>{item.site}</span><strong>{money(item.gross)}</strong></button>)}</div></div>}
          <p className="ep-online-count"><span className="ep-online-dot"/>{localOnline} carregador(es) online</p>
        </section>}
        <section className="panel ep-card ep-charger-chart"><div className="ep-card-head"><div><h3>Por carregador</h3><p className="ep-note">Receita bruta por equipamento.</p></div></div>
          {!byCharger.length ? <p className="ep-note">Nenhuma venda neste período.</p> : <div className="ep-bars">{byCharger.map((item, index) => { const max = Math.max(...byCharger.map((charger) => charger.gross), 1); return <div className="ep-bar-row" key={item.charger}><div className="ep-bar-label"><span>{item.charger}</span><strong>{money(item.gross)}</strong></div><div className="ep-bar-track"><span style={{ width: `${Math.max(4, item.gross / max * 100)}%`, background: palette[index % palette.length] }}/></div><small>{item.count} venda(s) · {item.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh</small></div>; })}</div>}
        </section>
      </div>
      {sites.length >= 2 && <section className="panel ep-card"><div className="ep-card-head"><h3>Resumo por local</h3></div>{!bySite.length ? <p className="ep-note">Nenhuma venda neste período.</p> : <div className="ep-table-wrap"><table className="ep-table ep-stack"><thead><tr><th>Local</th><th>Vendas</th><th>kWh</th><th>Bruta</th><th>Líquido</th></tr></thead><tbody>{bySite.map((item) => <tr key={item.site}><td data-label="Local">{item.site}</td><td data-label="Vendas">{item.count}</td><td data-label="kWh">{item.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td><td data-label="Bruta">{money(item.gross)}</td><td data-label="Líquido">{money(item.net)}</td></tr>)}</tbody></table></div>}</section>}
      <section className="panel ep-card"><div className="ep-card-head"><h3>Detalhamento por carregador</h3></div>
        {!byCharger.length ? <p className="ep-note">Nenhuma venda neste período.</p> : <div className="ep-table-wrap"><table className="ep-table ep-stack"><thead><tr><th>Carregador</th><th>Vendas</th><th>kWh</th><th>Bruta</th><th>Líquido</th></tr></thead><tbody>{byCharger.map((item) => <tr key={item.charger}><td data-label="Carregador">{item.charger}</td><td data-label="Vendas">{item.count}</td><td data-label="kWh">{item.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td><td data-label="Bruta">{money(item.gross)}</td><td data-label="Líquido">{money(item.net)}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="panel ep-card"><div className="ep-card-head"><div><h3>Pagamentos</h3><p className="ep-note">Últimos pagamentos do período e seu status.</p></div>{rows.length ? <button className="ep-csv" onClick={() => downloadCsv(rows, period)}>Baixar CSV</button> : null}</div>
        {result?.truncated && <p className="ep-note">Mostrando os 1.000 mais recentes do período.</p>}
        {!rows.length ? <p className="ep-note">Nenhum pagamento neste período.</p> : <div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>Data</th><th>Carregador</th><th>Cliente</th><th>Meio</th><th>Reserva</th><th>Cobrado</th><th>kWh</th><th>Situação</th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row.id}><td>{when(row.at)}</td><td>{row.charger}</td><td>{row.payer}</td><td>{row.method}</td><td>{money(row.reserved)}</td><td>{row.charged > 0 ? money(row.charged) : "-"}</td><td>{row.kwh ? row.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "-"}</td><td><span className={`ep-status ${row.label === "Vendido" ? "is-good" : row.label === "Precisa de atenção" ? "is-warn" : ""}`}>{row.label}</span></td></tr>)}</tbody></table></div>}
        {rows.length > 100 && <p className="ep-note">Tela mostra 100; o CSV leva todos do período.</p>}
      </section>
    </>}
  </div>;
}
