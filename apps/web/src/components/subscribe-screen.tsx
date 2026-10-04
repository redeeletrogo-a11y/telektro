"use client";
import { Zap } from "lucide-react";
import { useActionState } from "react";
import { signOut, startSubscription, type FormState } from "@/app/workspace-actions";
import { PixPay } from "@/components/pix-pay";
import { CONDO_PRICE_LABEL, RESIDENCIAL_PRICE_LABEL } from "@/lib/billing";

const initialState: FormState = {};

export function SubscribeScreen({ organizationId, organizationName, email, trialEnded, paymentsEnabled, accountType = "residencial", condoTotal = null, condoResidents = null }: { organizationId: string; organizationName: string; email: string; trialEnded: boolean; paymentsEnabled: boolean; accountType?: string; condoTotal?: number | null; condoResidents?: number | null }) {
  const [state, action, pending] = useActionState(startSubscription, initialState);
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
    <h1>Assine para continuar</h1>
    <p className="login-description">{trialEnded ? "Seu teste grátis de 7 dias terminou." : "Sua assinatura não está ativa."} Para voltar a cadastrar carregadores e iniciar recargas, ative o plano Residencial por {RESIDENCIAL_PRICE_LABEL}.</p>
    <div className="invite-card" style={{ width: "100%" }}>
      <strong>Plano Residencial</strong>
      <span className="field-help">{RESIDENCIAL_PRICE_LABEL} · seus carregadores, sessões e controle pelo app.</span>
      {paymentsEnabled ? <form action={action}>
        <input type="hidden" name="organization_id" value={organizationId}/>
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Abrindo pagamento..." : `Assinar ${RESIDENCIAL_PRICE_LABEL}`}</button>
      </form> : <>
        <button className="primary-button" type="button" disabled title="Pagamento em breve">Assinar {RESIDENCIAL_PRICE_LABEL} (em breve)</button>
        <span className="field-help">O pagamento online ainda está sendo ativado. Para liberar agora, fale com a Telektro informando o e-mail {email}.</span>
      </>}
      {state.error && <small className="form-error" role="alert">{state.error}</small>}
      {paymentsEnabled && <><span className="field-help">Ou pague 1 mês por Pix, sem cartão (renova quando você pagar o próximo).</span><PixPay organizationId={organizationId}/></>}
    </div>
    <form action={signOut}><button className="signout-button" type="submit">Sair</button></form>
  </section></main>;
}
