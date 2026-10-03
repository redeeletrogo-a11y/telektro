"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Zap } from "lucide-react";
import { signOut, type FormState } from "@/app/workspace-actions";
import { residentStartCharge, residentStopCharge } from "@/app/resident-actions";

type ChargerRow = { id: string; charge_point_id: string; model: string | null; status: string; online: boolean };
type SessionRow = { id: string; charger_id: string; started_at: string | null; ended_at: string | null };
type ConnectorRow = { charger_id: string; connector_id: number; status: string };
const initialState: FormState = {};

function StartButton({ charger, connectors, busy }: { charger: ChargerRow; connectors: ConnectorRow[]; busy: boolean }) {
  const [state, action, pending] = useActionState(residentStartCharge.bind(null, charger.id), initialState);
  const usable = connectors.filter((item) => item.connector_id >= 1 && ["Available", "Preparing"].includes(item.status));
  return <form action={action} className="resident-control">
    {usable.length > 1 && <label>Conector<select name="connector_id" defaultValue={usable[0].connector_id}>{usable.map((item) => <option key={item.connector_id} value={item.connector_id}>{item.connector_id}</option>)}</select></label>}
    <button className="secondary-button command-button" type="submit" disabled={!charger.online || pending || busy || usable.length === 0}><Play size={13}/>{pending ? "Enviando…" : "Iniciar recarga"}</button>
    {!pending && charger.online && usable.length === 0 && <small className="field-help">Conecte o carro ao carregador para iniciar.</small>}
    {state.error && <small className="form-error" role="alert">{state.error}</small>}{state.success && <small className="form-success" role="status">{state.success}</small>}
  </form>;
}

function StopButton({ session }: { session: SessionRow }) {
  const [state, action, pending] = useActionState(residentStopCharge.bind(null, session.id), initialState);
  return <form action={action} className="resident-control">
    <button className="secondary-button command-button" type="submit" disabled={pending}><Square size={13}/>{pending ? "Enviando…" : "Parar recarga"}</button>
    {state.error && <small className="form-error" role="alert">{state.error}</small>}{state.success && <small className="form-success" role="status">{state.success}</small>}
  </form>;
}

type UsageRow = { ended_at: string; kwh: number; price_per_kwh: number; amount: number };
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ResidentHome({ email, organizationName, chargers, connectors, sessions, usage, canControl }: { email: string; organizationName: string; chargers: ChargerRow[]; connectors: ConnectorRow[]; sessions: SessionRow[]; usage: UsageRow[] | null; canControl: boolean }) {
  const router = useRouter();
  const active = sessions.find((session) => !session.ended_at) ?? null;
  // Atualiza sozinho a cada 10s enquanto a tela esta aberta, para mostrar o inicio/fim confirmado pelo carregador.
  useEffect(() => { if (!canControl) return; const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 10000); return () => clearInterval(timer); }, [canControl, router]);
  return <main className="resident-home">
    <div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div>
    <div><p className="eyebrow">MORADOR · {organizationName.toUpperCase()}</p><h1>Carregadores do condomínio</h1><p className="login-description">{email}</p></div>
    {usage && <section className="panel" style={{ padding: 16 }}>
      <h2 className="panel-title">Meu consumo neste mês</h2>
      <p className="wallet-balance">{brl(usage.reduce((sum, row) => sum + row.amount, 0))}</p>
      <p className="field-help">{usage.reduce((sum, row) => sum + row.kwh, 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh em {usage.length} recarga(s). O valor entra na cobrança do condomínio no fim do mês.</p>
      {usage.map((row) => { const fee = Math.round((row.amount - row.kwh * row.price_per_kwh) * 100) / 100; return <div className="resident-row" key={row.ended_at}><span>{new Date(row.ended_at).toLocaleString("pt-BR")} · {row.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh × {brl(row.price_per_kwh)}{fee > 0 ? ` + taxa ${brl(fee)}` : ""}</span><span>{brl(row.amount)}</span></div>; })}
    </section>}
    <section className="panel" style={{ padding: 16 }}>
      <h2 className="panel-title">Carregadores</h2>
      {chargers.length ? chargers.map((charger) => <div key={charger.id}><div className="resident-row"><span>{charger.charge_point_id}{charger.model ? <small> · {charger.model}</small> : null}</span><span>{charger.online ? charger.status : "Offline"}</span></div>{canControl && <StartButton charger={charger} connectors={connectors.filter((item) => item.charger_id === charger.id)} busy={Boolean(active)}/>}</div>) : <p className="field-help">Nenhum carregador cadastrado ainda.</p>}
      </section>
    <section className="panel" style={{ padding: 16 }}>
      <h2 className="panel-title">Minhas recargas</h2>
      {canControl && active && <div className="resident-row"><span>Recarga em andamento{active.started_at ? ` desde ${new Date(active.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span><StopButton session={active}/></div>}
      {sessions.length ? sessions.map((session) => <div className="resident-row" key={session.id}><span>{session.started_at ? new Date(session.started_at).toLocaleString("pt-BR") : "-"}</span><span>{session.ended_at ? "Concluída" : "Em andamento"}</span></div>) : <p className="field-help">Você ainda não fez recargas.</p>}
    </section>
    <form action={signOut}><button className="signout-button" type="submit">Sair</button></form>
  </main>;
}
