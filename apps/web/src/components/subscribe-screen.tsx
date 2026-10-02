import { Zap } from "lucide-react";
import { signOut } from "@/app/workspace-actions";
import { RESIDENCIAL_PRICE_LABEL } from "@/lib/billing";

export function SubscribeScreen({ organizationName, email, trialEnded }: { organizationName: string; email: string; trialEnded: boolean }) {
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div>
    <p className="eyebrow">{organizationName.toUpperCase()}</p>
    <h1>Assine para continuar</h1>
    <p className="login-description">{trialEnded ? "Seu teste grátis de 7 dias terminou." : "Sua assinatura não está ativa."} Para voltar a cadastrar carregadores e iniciar recargas, ative o plano Residencial por {RESIDENCIAL_PRICE_LABEL}.</p>
    <div className="invite-card" style={{ width: "100%" }}>
      <strong>Plano Residencial</strong>
      <span className="field-help">{RESIDENCIAL_PRICE_LABEL} · seus carregadores, sessões e controle pelo app.</span>
      <button className="primary-button" type="button" disabled title="Pagamento em breve">Assinar {RESIDENCIAL_PRICE_LABEL} (em breve)</button>
      <span className="field-help">O pagamento online ainda está sendo ativado. Para liberar agora, fale com a Telektro informando o e-mail {email}.</span>
    </div>
    <form action={signOut}><button className="signout-button" type="submit">Sair</button></form>
  </section></main>;
}
