"use client";

import Link from "next/link";
import { Check, MessageCircle, QrCode, Receipt, TrendingUp, Wrench, Zap } from "lucide-react";
import { COMPANY_NOTE, whatsappUrl } from "@/lib/site";
import "./landing.css";

const WHATSAPP = whatsappUrl("Oi! Quero saber sobre o eletroposto completo para o meu comércio.");

const steps = [
  { icon: QrCode, title: "Motorista chega e lê o QR", text: "Ele conecta o carro, aponta a câmera para o QR Code da vaga e paga por Pix ou cartão, sem instalar aplicativo." },
  { icon: Receipt, title: "Paga só o que usar", text: "O valor é reservado no início e, ao terminar, o que não foi consumido volta automaticamente para o motorista." },
  { icon: TrendingUp, title: "Você acompanha no painel", text: "Cada recarga aparece no seu painel com consumo em kWh, valor cobrado e a sua parte, com relatórios e extrato." },
];

const included = [
  "Carregador para recarga de veículos elétricos",
  "Instalação elétrica*",
  "Sinalização e pintura da vaga",
  "Divulgação do seu ponto no site da Telektro e nos mapas de recarga",
  "Sistema de gestão: cobrança por QR, relatórios e acompanhamento da receita",
];

const faq = [
  { q: "É franquia?", a: "Não. Você compra o eletroposto completo e é o dono do equipamento e da operação. Não há taxa de franquia, royalties nem regras de rede." },
  { q: "Quanto vou ganhar?", a: "Não prometemos faturamento: o retorno depende de quantos veículos elétricos carregam no seu ponto. A receita vem do preço por kWh que você definir, menos a taxa de 8% da Telektro e as taxas do gateway de pagamento." },
  { q: "O que eu preciso ter?", a: "Uma vaga exclusiva e visível para os clientes e energia disponível no local. O valor base cobre instalação a até 10 m do medidor ou do poste; distâncias maiores e versões mais potentes têm valor sob consulta." },
  { q: "Como recebo o dinheiro das recargas?", a: "O motorista paga por Pix ou cartão e você acompanha cada recarga no painel, com o valor líquido da sua parte detalhado por sessão e por mês." },
  { q: "E se o carregador quebrar?", a: "O equipamento é seu e tem a garantia do fabricante, cujo prazo varia por modelo. A Telektro cuida do sistema de gestão e do suporte da plataforma." },
];

export function PartnerLanding() {
  const cta = (
    <a className="lp-btn primary campaign-cta" href={WHATSAPP} target="_blank" rel="noopener noreferrer">
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
        .campaign .campaign-price {font-size:28px;font-weight:700;margin:0 0 6px}
        .campaign .campaign-price small {font-size:16px;font-weight:400;color:var(--lp-mut)}
        .campaign .campaign-cta {min-height:52px;width:100%;font-size:16px}
        .campaign .campaign-caption {font-size:13px;color:var(--lp-mut);margin:10px 0 0}
        .campaign .campaign-image {width:100%;height:auto;border-radius:18px;border:1px solid var(--lp-line)}
        .campaign .campaign-list {list-style:none;padding:0;margin:24px 0 0;display:grid;gap:12px}
        .campaign .campaign-list li {display:flex;gap:10px;align-items:flex-start}
        .campaign .campaign-list svg {flex-shrink:0;color:var(--lp-acc);margin-top:3px}
        .campaign .campaign-details {max-width:680px}
        .campaign .campaign-details p {color:var(--lp-mut)}
        .campaign .campaign-footer {padding:28px 0;color:var(--lp-mut);font-size:12px;border-top:1px solid var(--lp-line)}
        .campaign a:focus-visible {outline:3px solid var(--lp-acc2);outline-offset:5px}
        .pt-steps {display:grid;gap:16px}
        .pt-included {display:grid;gap:16px}
        .pt-figure {margin:0}
        .pt-figure figcaption {color:var(--lp-mut);font-size:13px;margin-top:8px}
        .pt-offer {border:1px solid var(--lp-acc);border-radius:16px;padding:22px;background:#0d211d;max-width:680px}
        .pt-offer h2 {margin:0 0 10px;font-size:clamp(20px,4vw,26px)}
        .pt-offer p {margin:0 0 10px;color:var(--lp-mut);font-size:15px}
        .pt-offer .pt-price {font-size:30px;font-weight:700;color:var(--lp-ink);margin:0 0 6px}
        .pt-faq {display:grid;gap:12px;max-width:680px}
        .pt-faq details {padding:16px 20px}
        .pt-faq summary {cursor:pointer;font-weight:700;font-size:16px}
        .pt-faq details p {margin:10px 0 0;color:var(--lp-mut);font-size:15px}
        @media(min-width:900px){
          .campaign .campaign-hero{grid-template-columns:1.2fr 1fr;align-items:center;padding-top:56px}
          .campaign .campaign-cta{width:auto;min-width:260px}
          .pt-steps{grid-template-columns:repeat(3,1fr)}
          .pt-included{grid-template-columns:repeat(2,1fr)}
        }
      `}</style>
      <header className="lp-nav"><div className="lp-wrap campaign-header">
        <Link href="/" className="lp-logo"><Zap size={22} aria-hidden="true"/> TELEKTRO</Link>
        <Link href="/login">Entrar</Link>
      </div></header>
      <main>
        <section className="lp-wrap campaign-hero" aria-labelledby="partner-title">
          <div>
            <span className="lp-eyebrow">Para comerciantes e donos de imóvel com vaga</span>
            <h1 id="partner-title">Sua vaga ociosa pode render dinheiro</h1>
            <p className="lp-lead">Tenha um eletroposto completo no seu comércio: carregador, instalação, sinalização da vaga e o sistema Telektro de cobrança. O motorista paga pelo celular e você acompanha cada recarga no painel.</p>
            <p className="campaign-price">A partir de R$ 7.499<small>*</small></p>
            <p className="campaign-caption" style={{ margin: "0 0 18px" }}>*Instalação inclusa até 10 m do medidor ou poste. Acima disso, valor sob consulta. Versões mais potentes sob consulta.</p>
            {cta}
            <p className="campaign-caption">Conte o seu caso e receba a proposta para o seu ponto.</p>
          </div>
          <figure className="pt-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="campaign-image" src="/showcase/eletroposto.webp" alt=""/>
            <figcaption>Imagem ilustrativa.</figcaption>
          </figure>
        </section>

        <section className="lp-sec" aria-labelledby="pt-como"><div className="lp-wrap">
          <h2 id="pt-como">Como funciona</h2>
          <div className="pt-steps" style={{ marginTop: 24 }}>
            {steps.map((s) => (
              <div key={s.title} className="lp-card">
                <div className="lp-ico"><s.icon size={22} aria-hidden="true"/></div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div></section>

        <section className="lp-sec" aria-labelledby="pt-incluso"><div className="lp-wrap">
          <h2 id="pt-incluso">O que está incluso</h2>
          <div className="pt-included" style={{ marginTop: 24 }}>
            <div className="lp-card">
              <div className="lp-ico"><Wrench size={22} aria-hidden="true"/></div>
              <h3>Eletroposto pronto para funcionar</h3>
              <ul className="campaign-list">
                {included.map((i) => <li key={i}><Check size={18} aria-hidden="true"/><span>{i}</span></li>)}
              </ul>
            </div>
            <div className="lp-card">
              <div className="lp-ico"><TrendingUp size={22} aria-hidden="true"/></div>
              <h3>Depois, sem mensalidade nem aluguel</h3>
              <p style={{ marginTop: 6 }}>A Telektro fica com 8% do faturamento bruto das recargas. Taxas do gateway de pagamento não estão incluídas. Valores e percentuais podem ser ajustados.</p>
              <p style={{ marginTop: 12 }}>Você define o preço por kWh do seu ponto e acompanha a receita no painel.</p>
            </div>
          </div>
        </div></section>

        <section className="lp-sec" aria-labelledby="pt-oferta"><div className="lp-wrap">
          <div className="pt-offer">
            <h2 id="pt-oferta">Seu eletroposto completo</h2>
            <p className="pt-price">A partir de R$ 7.499*</p>
            <p>*Instalação inclusa até 10 m do medidor ou poste. Acima disso, valor sob consulta. Versões mais potentes sob consulta.</p>
            <p>O retorno depende da movimentação de veículos elétricos na sua região. Não prometemos ganho: apresentamos os números do seu ponto com transparência no painel.</p>
            {cta}
          </div>
        </div></section>

        <section className="lp-sec" aria-labelledby="pt-duvidas"><div className="lp-wrap">
          <h2 id="pt-duvidas">Perguntas frequentes</h2>
          <div className="pt-faq" style={{ marginTop: 24 }}>
            {faq.map((f) => <details key={f.q} className="lp-card"><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </div></section>

        <footer className="lp-wrap campaign-footer">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <span>{COMPANY_NOTE}</span>
            <span><Link href="/privacidade">Privacidade</Link> · <Link href="/termos">Termos</Link></span>
          </div>
        </footer>
      </main>
    </div>
  );
}
