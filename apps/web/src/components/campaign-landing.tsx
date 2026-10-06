"use client";

import Link from "next/link";
import { Check, MessageCircle, Zap } from "lucide-react";
import { COMPANY_NOTE } from "@/lib/site";
import "./landing.css";

const profiles = {
  condominio: {
    label: "Para síndicos e administradoras",
    title: "Carregador de carro elétrico no condomínio",
    description: "Controle o acesso dos moradores e acompanhe o consumo de cada recarga em um só painel.",
    price: "R$ 199",
    image: "/showcase/condominio.webp",
    href: "https://wa.me/558486722883?text=Oi%2C+vi+o+Telektro+e+quero+saber+sobre+carregador+no+condom%C3%ADnio",
    benefits: ["Controle de acesso por morador", "Consumo em kWh por sessão", "Relatórios para a administração", "Gestão de carregadores e usuários"],
    detail: "Converse sobre o seu condomínio, o modelo do carregador e a forma de rateio. Confirmamos a compatibilidade e as condições do plano antes da contratação.",
    guide: "/guias/carregador-carro-eletrico-condominio",
  },
  eletroposto: {
    label: "Para operadores de recarga pública",
    title: "Software para eletroposto",
    description: "Recarga por QR Code, pagamento por Pix ou cartão e acompanhamento das sessões em um só painel.",
    price: "R$ 149",
    image: "/showcase/eletroposto.webp",
    href: "https://wa.me/558486722883?text=Oi%2C+vi+o+Telektro+e+quero+saber+sobre+software+para+eletroposto",
    benefits: ["Motorista acessa a recarga por QR Code", "Pagamento por Pix ou cartão", "Status das sessões via OCPP 1.6J", "Relatórios de sessões e receita"],
    detail: "Converse sobre os carregadores e a operação do seu eletroposto. Confirmamos a compatibilidade, as taxas e as condições do plano antes da contratação.",
    guide: "/guias",
  },
} as const;

type Profile = keyof typeof profiles;
type AnalyticsWindow = Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };

export function trackWhatsAppClick(profile: Profile, placement: "hero" | "details") {
  // No identifiers, messages, phone numbers or customer data enter the event.
  // No tag is loaded here. Connect an approved Google tag before buying traffic.
  try {
    const analytics = window as AnalyticsWindow;
    const parameters = { profile, placement, transport_type: "beacon" };
    if (typeof analytics.gtag === "function") {
      analytics.gtag("event", "whatsapp_click", parameters);
    } else {
      (analytics.dataLayer ??= []).push({ event: "whatsapp_click", profile, placement });
    }
  } catch {
    // Analytics must never stop the customer opening WhatsApp.
  }
}

export function CampaignLanding({ profile }: { profile: Profile }) {
  const content = profiles[profile];
  const cta = (placement: "hero" | "details") => (
    <a className="lp-btn primary campaign-cta" href={content.href} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick(profile, placement)}>
      <MessageCircle size={20} aria-hidden="true"/> Falar no WhatsApp
    </a>
  );
  return (
    <div className="lp campaign">
      <style>{`
        .campaign .campaign-header {height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .campaign .campaign-header a:last-child {font-size:14px;color:var(--lp-mut)}
        .campaign .campaign-hero {padding:32px 0 40px;display:grid;gap:28px}
        .campaign h1 {font-size:clamp(32px,7.8vw,56px);line-height:1.08;max-width:740px;margin:18px 0 16px}
        .campaign .lp-eyebrow {letter-spacing:.02em;font-size:11px}
        .campaign .lp-lead {margin:0 0 18px}
        .campaign .campaign-price {font-size:28px;font-weight:700;margin:0 0 16px}
        .campaign .campaign-price small {font-size:16px;font-weight:400;color:var(--lp-mut)}
        .campaign .campaign-cta {min-height:52px;width:100%;font-size:16px}
        .campaign .campaign-caption {font-size:13px;color:var(--lp-mut);margin:10px 0 0}
        .campaign .campaign-image {width:100%;height:auto;border-radius:18px;border:1px solid var(--lp-line)}
        .campaign .campaign-list {list-style:none;padding:0;margin:24px 0 0;display:grid;gap:12px}
        .campaign .campaign-list li {display:flex;gap:10px;align-items:flex-start}
        .campaign .campaign-list svg {flex-shrink:0;color:var(--lp-acc);margin-top:3px}
        .campaign .campaign-details {max-width:680px}
        .campaign .campaign-details p {color:var(--lp-mut)}
        .campaign .campaign-guide {display:inline-block;margin-top:22px;color:var(--lp-acc);text-decoration:underline}
        .campaign .campaign-footer {padding:28px 0;color:var(--lp-mut);font-size:12px;border-top:1px solid var(--lp-line)}
        .campaign a:focus-visible {outline:3px solid var(--lp-acc2);outline-offset:5px}
        @media(min-width:900px){.campaign .campaign-hero{grid-template-columns:1.2fr 1fr;align-items:center;padding-top:56px}.campaign .campaign-cta{width:auto;min-width:260px}}
      `}</style>
      <header className="lp-nav"><div className="lp-wrap campaign-header">
        <Link href="/" className="lp-logo"><Zap size={22} aria-hidden="true"/> TELEKTRO</Link>
        <Link href="/login">Entrar</Link>
      </div></header>
      <main>
        <section className="lp-wrap campaign-hero" aria-labelledby="campaign-title">
          <div>
            <span className="lp-eyebrow">{content.label}</span>
            <h1 id="campaign-title">{content.title}</h1>
            <p className="lp-lead">{content.description}</p>
            <p className="campaign-price">{content.price}<small>/mês</small></p>
            {profile === "condominio" && <p className="campaign-caption" style={{ margin: "-6px 0 18px" }}>Gestão até 5 moradores. Morador extra tem taxa adicional.</p>}
            {cta("hero")}
            <p className="campaign-caption">Fale sobre seu projeto e peça uma demonstração.</p>
            <ul className="campaign-list">{content.benefits.map((benefit) => <li key={benefit}><Check size={18} aria-hidden="true"/><span>{benefit}</span></li>)}</ul>
          </div>
          {/* Existing owner-supplied artwork, not a customer photo or product screenshot. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="campaign-image" src={content.image} alt=""/>
        </section>
        <section className="lp-sec"><div className="lp-wrap"><div className="campaign-details">
          <h2>Vamos entender sua operação</h2>
          <p>{content.detail}</p>
          <p>O Telektro é o software de gestão. Carregador físico e instalação elétrica não estão incluídos. A conexão exige internet e equipamento compatível com OCPP 1.6J; os recursos dependem do modelo e da configuração.</p>
          <p>Mensalidade base. Limites, adicionais e eventuais taxas de cobrança devem ser confirmados na proposta. Taxas do gateway de pagamento não estão incluídas.</p>
          {cta("details")}<br/>
          <Link className="campaign-guide" href={content.guide}>Ver o guia de uso</Link>
        </div></div></section>
      </main>
      <footer className="lp-wrap campaign-footer">{COMPANY_NOTE}</footer>
    </div>
  );
}
