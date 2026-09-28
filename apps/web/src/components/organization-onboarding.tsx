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
  const slug = makeSlug(name);

  return <main className="onboarding-page">
    <section className="onboarding-card">
      <div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div>
      <p className="eyebrow">CONFIGURAÇÃO DO WORKSPACE</p>
      <h1>Crie sua organização</h1>
      <p className="login-description">Sua organização reúne os locais, carregadores e pessoas da operação.</p>
      <form action={action} className="login-form">
        <label htmlFor="organization-name">Nome da organização</label>
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
