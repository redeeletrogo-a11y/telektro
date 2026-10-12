"use client";
import { Zap } from "lucide-react";
import { signOut } from "@/app/workspace-actions";
import { PixPay } from "@/components/pix-pay";
import { CONDO_PRICE_LABEL } from "@/lib/billing";

export function SubscribeScreen({ organizationId, organizationName, email, trialEnded, paymentsEnabled, accountType = "residencial", condoTotal = null, condoResidents = null }: { organizationId: string; organizationName: string; email: string; trialEnded: boolean; paymentsEnabled: boolean; accountType?: string; condoTotal?: number | null; condoResidents?: number | null }) {
  if (accountType === "condominio") return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div>
    <p className="eyebrow">{organizationName.toUpperCase()}</p>
    <h1>Mensalidade do condomínio</h1>
    <p className="login-description">{trialEnded ? "O teste grátis de 7 dias terminou." : "A mensalidade não está ativa."} Enquanto não for paga, o painel e as recargas dos moradores ficam bloqueados. Quem paga é só o responsável do condomínio.</p>
    <div className="invite-card" style={{ width: "100%" }}>
      <strong>Plano Condomínio</strong>
      <span className="field-help">{CONDO_PRICE_LABEL}. Mais 1% da energia cobrada pelo condomínio no mês anterior, somado na fatura seguinte.</span>
      {condoTotal !== null && <span className="field-help">Esta fatura: R$ {condoTotal.toFixed(2).replace(".", ",")}{condoResidents !== null ? ` (${condoResidents} morador(es))` : ""}.</span>}
      {paymentsEnabled ? <PixPay organizationId={organizationId} label="Gerar Pix da mensalidade"/> : <span className="field-help">O pagamento online ainda está sendo ativado. Fale com a Telektro informando o e-mail {email}.</span>}
    </div>
    <form action={signOut}><button className="signout-button" type="submit">Sair</button></form>
  </section></main>;
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div>
    <p className="eyebrow">{organizationName.toUpperCase()}</p>
    <h1>Plano Residencial gratuito</h1>
    <p className="login-description">O plano Residencial é grátis, cortesia da Telektro. Se esta tela apareceu, atualize a página ou fale com a Telektro informando o e-mail {email}.</p>
    <form action={signOut}><button className="signout-button" type="submit">Sair</button></form>
  </section></main>;
}
