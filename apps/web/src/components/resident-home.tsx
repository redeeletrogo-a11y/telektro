import { Zap } from "lucide-react";
import { signOut } from "@/app/workspace-actions";

type ChargerRow = { id: string; charge_point_id: string; model: string | null; status: string; online: boolean };
type SessionRow = { id: string; charger_id: string; started_at: string | null; ended_at: string | null };

type UsageRow = { ended_at: string; kwh: number; price_per_kwh: number; amount: number };
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ResidentHome({ email, organizationName, chargers, sessions, usage }: { email: string; organizationName: string; chargers: ChargerRow[]; sessions: SessionRow[]; usage: UsageRow[] | null }) {
  return <main className="resident-home">
    <div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div>
    <div><p className="eyebrow">MORADOR · {organizationName.toUpperCase()}</p><h1>Carregadores do condomínio</h1><p className="login-description">{email}</p></div>
    {usage && <section className="panel" style={{ padding: 16 }}>
      <h2 className="panel-title">Meu consumo neste mês</h2>
      <p className="wallet-balance">{brl(usage.reduce((sum, row) => sum + row.amount, 0))}</p>
      <p className="field-help">{usage.reduce((sum, row) => sum + row.kwh, 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh em {usage.length} recarga(s). O valor entra na cobrança do condomínio no fim do mês.</p>
      {usage.map((row) => <div className="resident-row" key={row.ended_at}><span>{new Date(row.ended_at).toLocaleString("pt-BR")} · {row.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh × {brl(row.price_per_kwh)}</span><span>{brl(row.amount)}</span></div>)}
    </section>}
    <section className="panel" style={{ padding: 16 }}>
      <h2 className="panel-title">Carregadores</h2>
      {chargers.length ? chargers.map((charger) => <div className="resident-row" key={charger.id}><span>{charger.model ?? charger.charge_point_id}</span><span>{charger.online ? charger.status : "Offline"}</span></div>) : <p className="field-help">Nenhum carregador cadastrado ainda.</p>}
    </section>
    <section className="panel" style={{ padding: 16 }}>
      <h2 className="panel-title">Minhas recargas</h2>
      {sessions.length ? sessions.map((session) => <div className="resident-row" key={session.id}><span>{session.started_at ? new Date(session.started_at).toLocaleString("pt-BR") : "-"}</span><span>{session.ended_at ? "Concluída" : "Em andamento"}</span></div>) : <p className="field-help">Você ainda não fez recargas.</p>}
    </section>
    <form action={signOut}><button className="signout-button" type="submit">Sair</button></form>
  </main>;
}
