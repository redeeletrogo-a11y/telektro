"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Zap } from "lucide-react";
import { createOrganization, type FormState } from "@/app/workspace-actions";

const initialState: FormState = {};

function makeSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function OrganizationOnboarding({ email }: { email: string }) {
  const [state, action, pending] = useActionState(createOrganization, initialState);
  const [name, setName] = useState("");
  const [type, setType] = useState("residencial");
  const slug = makeSlug(name);

  return <main className="onboarding-page">
    <section className="onboarding-card">
      <div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div>
      <p className="eyebrow">CONFIGURAÇÃO DO WORKSPACE</p>
      <h1>Crie sua conta</h1>
      <p className="login-description">Escolha o tipo de conta. Você pode falar com a Telektro para mudar depois.</p>
      <form action={action} className="login-form">
        <fieldset className="account-types"><legend>Tipo de conta</legend>
          <label className={`account-type ${type === "residencial" ? "selected" : ""}`}><input type="radio" name="account_type" value="residencial" checked={type === "residencial"} onChange={() => setType("residencial")}/><strong>Residencial</strong><span>Sua casa, seus carregadores. R$ 19,90/mês.</span></label>
          <label className={`account-type ${type === "condominio" ? "selected" : ""}`}><input type="radio" name="account_type" value="condominio" checked={type === "condominio"} onChange={() => setType("condominio")}/><strong>Condomínio</strong><span>A pessoa responsável administra e convida moradores. R$ 199/mês até 5 usuários, +R$ 19,90 por usuário extra.</span></label>
          <label className="account-type disabled"><input type="radio" name="account_type" value="eletroposto" disabled/><strong>Eletroposto</strong><span>Em breve. Fale com a Telektro.</span></label>
        </fieldset>
        <label htmlFor="organization-name">{type === "condominio" ? "Nome do condomínio" : "Nome da conta"}</label>
        <input id="organization-name" name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="organization" placeholder="Ex.: Rede Eletro Go" required/>
        <label htmlFor="organization-slug">Identificador</label>
        <input id="organization-slug" name="slug" value={slug} readOnly aria-describedby="slug-help" required/>
        <span id="slug-help" className="field-help">Será usado em links e integrações.</span>
        {state.error && <p className="login-error" role="alert">{state.error}</p>}
        <button className="primary-button login-submit" disabled={pending || !slug}>{pending ? "Criando…" : "Criar organização"}<ArrowRight size={15}/></button>
      </form>
      <div className="login-security"><ShieldCheck size={14}/>Você será o primeiro administrador da organização.</div>
      <div className="onboarding-footer"><span><Building2 size={14}/>{email}</span><Link href="/login">Sair</Link></div>
    </section>
  </main>;
}
