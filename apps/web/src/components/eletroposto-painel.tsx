"use client";

import { useActionState, useState, useTransition } from "react";
import { QrCode } from "lucide-react";
import { createChargingPoint, saveEletropostoTariff, savePointLimits, setPointEnabled } from "@/app/eletroposto-actions";
import type { FormState } from "@/app/workspace-actions";

export type EpCharger = { id: string; charge_point_id: string; site_id: string; model: string | null; online?: boolean | null };
export type EpPoint = { id: string; public_code: string; charger_id: string; enabled: boolean; min_amount: number; max_amount: number };

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function TariffForm({ organizationId, price }: { organizationId: string; price: number | null }) {
  const [state, action, pending] = useActionState(saveEletropostoTariff.bind(null, organizationId), {} as FormState);
  return <form action={action} className="ep-form">
    <label>Preço do kWh (R$)<input name="price_per_kwh" inputMode="decimal" defaultValue={price ? String(price).replace(".", ",") : ""} placeholder="2,00" required/></label>
    <button className="primary-button" disabled={pending}>{pending ? "Salvando…" : "Salvar tarifa"}</button>
    {state.error && <p className="ep-msg err" role="alert">{state.error}</p>}
    {state.success && <p className="ep-msg ok" role="status">{state.success}</p>}
  </form>;
}

function LimitsForm({ organizationId, point }: { organizationId: string; point: EpPoint }) {
  const [state, action, pending] = useActionState(savePointLimits.bind(null, organizationId, point.id), {} as FormState);
  return <form action={action} className="ep-form">
    <label>Valor mínimo (R$)<input name="min_amount" inputMode="decimal" defaultValue={String(point.min_amount).replace(".", ",")} required/></label>
    <label>Valor máximo (R$)<input name="max_amount" inputMode="decimal" defaultValue={String(point.max_amount).replace(".", ",")} required/></label>
    <button className="ep-actions-btn" disabled={pending} style={{ minHeight: 40, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", font: "inherit", fontWeight: 600 }}>{pending ? "Salvando…" : "Salvar valores"}</button>
    {state.error && <p className="ep-msg err" role="alert">{state.error}</p>}
    {state.success && <p className="ep-msg ok" role="status">{state.success}</p>}
  </form>;
}

function ChargerCard({ organizationId, charger, point }: { organizationId: string; charger: EpCharger; point: EpPoint | undefined }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<FormState>({});
  const run = (job: () => Promise<FormState>) => start(async () => setMessage(await job()));
  return <section className="panel ep-card">
    <div className="ep-card-head">
      <div><h3>{charger.charge_point_id}</h3><p className="ep-note">{charger.model ?? "Carregador"} · {charger.online ? "online" : "sem comunicação"}</p></div>
      {point ? <span className={`ep-chip ${point.enabled ? "" : "off"}`}>{point.enabled ? "QR ativo" : "QR pausado"}</span> : <span className="ep-chip warn">Sem QR</span>}
    </div>
    {!point ? <div className="ep-actions"><button className="ep-primary" disabled={pending} onClick={() => run(() => createChargingPoint(organizationId, charger.id))}><QrCode size={15}/>&nbsp;{pending ? "Gerando…" : "Gerar QR deste carregador"}</button></div> : <>
      <div className="ep-actions">
        <a className="ep-primary" href={`/placa/${point.public_code}`} target="_blank" rel="noopener">Ver e imprimir placa</a>
        <a href={`/carregar/${point.public_code}/qr`} download={`qr-${charger.charge_point_id}.png`}>Baixar QR (imagem)</a>
        <a href={`/carregar/${point.public_code}`} target="_blank" rel="noopener">Abrir página do cliente</a>
        <button disabled={pending} onClick={() => run(() => setPointEnabled(organizationId, point.id, !point.enabled))}>{point.enabled ? "Pausar vendas" : "Reativar vendas"}</button>
      </div>
      <LimitsForm organizationId={organizationId} point={point}/>
    </>}
    {message.error && <p className="ep-msg err" role="alert">{message.error}</p>}
    {message.success && <p className="ep-msg ok" role="status">{message.success}</p>}
  </section>;
}

export function EletropostoPainel({ organizationId, chargers, points, tariffPrice, canManage }: { organizationId: string; chargers: EpCharger[]; points: EpPoint[]; tariffPrice: number | null; canManage: boolean }) {
  const pointByCharger = new Map(points.map((point) => [point.charger_id, point]));
  return <div className="ep-panel">
    <section className="panel ep-card">
      <h3>Como funciona</h3>
      <p className="ep-note">1) Cadastre o carregador na aba Carregadores. 2) Defina o preço do kWh. 3) Gere o QR de cada carregador e imprima a placa. O cliente escaneia, paga por Pix ou cartão e a recarga libera sozinha; cobra só o consumo medido e devolve a sobra.</p>
      {canManage ? <TariffForm organizationId={organizationId} price={tariffPrice}/> : <p className="ep-note">Preço atual: {tariffPrice ? money(tariffPrice) + " por kWh" : "não definido"}.</p>}
      {!tariffPrice && <p className="ep-msg err">Sem tarifa definida, os clientes não conseguem pagar.</p>}
    </section>
    {chargers.length === 0 && <section className="panel ep-card"><p className="ep-note">Nenhum carregador cadastrado ainda. Vá em Carregadores e cadastre o primeiro.</p></section>}
    {chargers.map((charger) => <ChargerCard key={charger.id} organizationId={organizationId} charger={charger} point={pointByCharger.get(charger.id)}/>)}
  </div>;
}
