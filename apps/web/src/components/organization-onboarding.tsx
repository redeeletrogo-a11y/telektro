"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, Check, Home, PlugZap, ShieldCheck } from "lucide-react";
import { createOrganization, type FormState } from "@/app/workspace-actions";
import styles from "./organization-onboarding.module.css";

const initialState: FormState = {};
const accountTypes = [
  { value: "condominio", title: "Condomínio", icon: Building2, image: "/onboarding/condominio.webp", description: "A pessoa responsável administra e convida moradores. R$ 199/mês até 5 usuários, +R$ 19,90 por usuário extra." },
  { value: "eletroposto", title: "Eletroposto", icon: PlugZap, image: "/onboarding/eletroposto.webp", description: "Venda recargas com QR: o cliente paga por Pix ou cartão e o carregador libera sozinho." },
  { value: "residencial", title: "Residência", icon: Home, image: "/onboarding/casa.webp", description: "Sua casa, seus carregadores. Grátis, cortesia da Telektro." },
] as const;

function makeSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function OrganizationOnboarding({ email }: { email: string }) {
  const [state, action, pending] = useActionState(createOrganization, initialState);
  const [name, setName] = useState("");
  const [type, setType] = useState("residencial");
  const slug = makeSlug(name);

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand}>
          <svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="96" fill="#0f776c"/><path fill="#fff" d="M112 118h288v78H300v198h-88V196h-100z"/><path fill="#bcebd1" d="m278 224-79 112h55l-23 90 91-132h-59l34-70z"/></svg>
          <span>TELEKTRO<small>Gestão de recargas</small></span>
        </div>
        <div className={styles.account}><span className={styles.avatar} aria-hidden="true">{email.charAt(0).toUpperCase()}</span><span className={styles.email}>{email}</span><Link href="/login">Sair</Link></div>
      </div>
    </header>
    <div className={styles.content}>
      <div className={styles.intro}>
        <p className={styles.welcome}>Bem-vindo à Telektro</p>
        <h1>Qual tipo de instalação<br/><span>você deseja gerenciar?</span></h1>
        <p>Escolha o perfil que melhor se adapta à sua necessidade.<br className={styles.desktopBreak}/> Você pode falar com a Telektro para mudar depois.</p>
      </div>
      <form action={action}>
        <fieldset className={styles.types} disabled={pending}>
          <legend className={styles.srOnly}>Tipo de conta</legend>
          {accountTypes.map(({ value, title, icon: Icon, image, description }) => <label key={value} className={`${styles.type} ${type === value ? styles.selected : ""}`}>
            <input className={styles.radio} type="radio" name="account_type" value={value} checked={type === value} onChange={() => setType(value)}/>
            <div className={styles.image}><Image src={image} alt="" fill sizes="(max-width: 640px) 88px, (max-width: 1000px) 32vw, 340px" priority/></div>
            <div className={styles.typeBody}>
              <span className={styles.icon}><Icon size={25} strokeWidth={1.6}/></span>
              <strong>{title}</strong>
              <span className={styles.description}>{description}</span>
              <span className={styles.selectText}>{type === value ? "Selecionado" : `Selecionar ${title.toLowerCase()}`}{type === value ? <Check size={17}/> : <ArrowRight size={17}/>}</span>
            </div>
            <span className={styles.mobileIndicator} aria-hidden="true">{type === value ? <Check size={18}/> : <ArrowRight size={18}/>}</span>
          </label>)}
        </fieldset>
        <section className={styles.details} aria-labelledby="organization-details-title">
          <div className={styles.detailsHeading}><h2 id="organization-details-title">Dados da organização</h2><p>Você será o primeiro administrador.</p></div>
          <div className={styles.fields}>
            <div className={styles.field}><label htmlFor="organization-name">{type === "condominio" ? "Nome do condomínio" : type === "eletroposto" ? "Nome do eletroposto" : "Nome da conta"}</label>
              <input id="organization-name" name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="organization" placeholder="Ex.: Rede Eletro Go" required/>
            </div>
            <div className={styles.field}><label htmlFor="organization-slug">Identificador</label>
              <input id="organization-slug" name="slug" value={slug} readOnly aria-describedby="slug-help" required/>
              <span id="slug-help" className={styles.help}>Será usado em links e integrações.</span>
            </div>
          </div>
          {state.error && <p className={styles.error} role="alert">{state.error}</p>}
          <div className={styles.bottom}><span><ShieldCheck size={17}/>Configuração da sua conta Telektro</span><button type="submit" disabled={pending || !slug}>{pending ? "Criando…" : "Criar organização"}<ArrowRight size={17}/></button></div>
        </section>
      </form>
    </div>
  </main>;
}
