import { Zap } from "lucide-react";
import { signOut } from "@/app/workspace-actions";

type ChargerRow = { id: string; charge_point_id: string; model: string | null; status: string; online: boolean };
type SessionRow = { id: string; charger_id: string; started_at: string | null; ended_at: string | null };

export function ResidentHome({ email, organizationName, chargers, sessions }: { email: string; organizationName: string; chargers: ChargerRow[]; sessions: SessionRow[] }) {
  return <main className="resident-home">
    <div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div>
    <div><p className="eyebrow">MORADOR · {organizationName.toUpperCase()}</p><h1>Carregadores do condomínio</h1><p className="login-description">{email}</p></div>
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
