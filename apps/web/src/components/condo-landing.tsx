"use client";

import Link from "next/link";
import { Building2, Car, Check, Gauge, ListOrdered, MessageCircle, SlidersHorizontal, Zap } from "lucide-react";
import { trackAdsConversion } from "@/lib/ads";
import { COMPANY_NOTE } from "@/lib/site";
import "./landing.css";

const WHATSAPP = "https://wa.me/558486722883?text=Oi%2C+vi+o+Telektro+e+quero+saber+sobre+carregador+no+condom%C3%ADnio";

type AnalyticsWindow = Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };

function trackClick(placement: "hero" | "details" | "final") {
  // No identifiers, messages, phone numbers or customer data enter the event.
  try {
    const analytics = window as AnalyticsWindow;
    const parameters = { profile: "condominio", placement, transport_type: "beacon" };
    if (typeof analytics.gtag === "function") {
      analytics.gtag("event", "whatsapp_click", parameters);
    } else {
      (analytics.dataLayer ??= []).push({ event: "whatsapp_click", profile: "condominio", placement });
    }
    trackAdsConversion();
  } catch {
    // Analytics must never stop the customer opening WhatsApp.
  }
}

// Illustrative example, not customer data: building limit 100 kW, base load 40 kW, three cars.
function DemandBar({ cars, controlled, label }: { cars: number[]; controlled?: boolean; label: string }) {
  const base = 40;
  const total = base + cars.reduce((sum, kw) => sum + kw, 0);
  const limit = 100;
  const scale = 280 / 120; // viewBox width for 120 kW
  const bars = cars.reduce<Array<{ kw: number; x: number }>>((acc, kw) => {
    const previous = acc.length > 0 ? acc[acc.length - 1] : { kw: base, x: 10 };
    acc.push({ kw, x: previous.x + previous.kw * scale + (acc.length > 0 ? 2 : 0) });
    return acc;
  }, []);
  return (
    <figure className="cl-figure">
      <svg viewBox="0 0 320 118" role="img" aria-label={label}>
        <rect x="10" y="34" width={base * scale} height="34" rx="6" fill="#1d2f38"/>
        {bars.map((bar, i) => (
          <rect key={i} x={bar.x} y="34" width={bar.kw * scale} height="34" rx="6" fill={controlled ? "#2fd3b8" : "#7be8d3"} opacity={controlled ? 1 : 0.55}/>
        ))}
        <line x1={10 + limit * scale} y1="24" x2={10 + limit * scale} y2="78" stroke={controlled ? "#2fd3b8" : "#ff6b6b"} strokeWidth="2" strokeDasharray="4 3"/>
        <text x="12" y="54" fill="#f2f7f8" fontSize="11">Prédio</text>
        {bars.map((bar, i) => (
          <text key={i} x={bar.x + (bar.kw * scale) / 2} y="54" fill={controlled ? "#04201b" : "#0e1a21"} fontSize="10" textAnchor="middle">Carro {i + 1}</text>
        ))}
        <text x={10 + limit * scale} y="18" fill={controlled ? "#2fd3b8" : "#ff6b6b"} fontSize="10" textAnchor="middle">Limite</text>
        <text x="10" y="96" fill="#93a6ad" fontSize="11">Total: {total} kW de {limit} kW{controlled ? " — dentro do limite" : " — acima do limite"}</text>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function DemandFigure() {
  return (
    <div className="cl-figures">
      <DemandBar cars={[22, 22, 22]} label="Sem controle: três carros ligam no máximo ao mesmo tempo e a soma passa do limite do prédio."/>
      <DemandBar cars={[20, 20, 20]} controlled label="Com o Telektro: cada carro carrega um pouco mais devagar e todos carregam sem passar do limite."/>
    </div>
  );
}

const controls = [
  { icon: SlidersHorizontal, title: "Limite por vaga", text: "Defina quantos kW cada ponto de recarga pode usar, de acordo com a instalação do condomínio." },
  { icon: Gauge, title: "Divisão automática", text: "Dois ou três carros carregando juntos? A potência disponível é dividida entre eles, sem desligar ninguém." },
  { icon: ListOrdered, title: "Fila de recarga", text: "Atingiu o limite do prédio? O próximo carro espera a vez e começa a carregar quando a potência liberar." },
  { icon: Building2, title: "Visão do prédio", text: "O painel mostra quanto o condomínio está consumindo de energia nas recargas em tempo real." },
];

export function CondoLanding() {
  const cta = (placement: "hero" | "details" | "final") => (
    <a className="lp-btn primary campaign-cta" href={WHATSAPP} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(placement)}>
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
        .cl-figures {display:grid;gap:16px;margin-top:24px}
        .cl-figure {margin:0;border:1px solid var(--lp-line);border-radius:16px;padding:16px;background:var(--lp-card)}
        .cl-figure svg {width:100%;height:auto;display:block}
        .cl-figure figcaption {color:var(--lp-mut);font-size:13px;margin-top:8px}
        .cl-paths {display:grid;gap:16px}
        .cl-controls {display:grid;gap:16px}
        .cl-note {color:var(--lp-mut);font-size:13px;margin-top:18px}
        @media(min-width:900px){
          .campaign .campaign-hero{grid-template-columns:1.2fr 1fr;align-items:center;padding-top:56px}
          .campaign .campaign-cta{width:auto;min-width:260px}
          .cl-figures{grid-template-columns:1fr 1fr}
          .cl-paths{grid-template-columns:1fr 1fr}
          .cl-controls{grid-template-columns:repeat(2,1fr)}
        }
      `}</style>
      <header className="lp-nav"><div className="lp-wrap campaign-header">
        <Link href="/" className="lp-logo"><Zap size={22} aria-hidden="true"/> TELEKTRO</Link>
        <Link href="/login">Entrar</Link>
      </div></header>
      <main>
        <section className="lp-wrap campaign-hero" aria-labelledby="campaign-title">
          <div>
            <span className="lp-eyebrow">Para síndicos e administradoras</span>
            <h1 id="campaign-title">Carregador de carro elétrico no condomínio</h1>
            <p className="lp-lead">Controle o acesso dos moradores, acompanhe o consumo de cada recarga em kWh e proteja a entrada de energia do prédio em um só painel.</p>
            <p className="campaign-price">R$ 199<small>/mês</small></p>
            <p className="campaign-caption" style={{ margin: "-6px 0 18px" }}>Gestão até 5 moradores. Morador extra tem taxa adicional.</p>
            {cta("hero")}
            <p className="campaign-caption">Fale sobre seu projeto e peça uma demonstração.</p>
            <ul className="campaign-list">
              <li><Check size={18} aria-hidden="true"/><span>Controle de acesso por morador</span></li>
              <li><Check size={18} aria-hidden="true"/><span>Consumo em kWh por sessão</span></li>
              <li><Check size={18} aria-hidden="true"/><span>Controle de demanda para não estourar a energia do prédio</span></li>
              <li><Check size={18} aria-hidden="true"/><span>Gestão de carregadores e usuários</span></li>
            </ul>
          </div>
          {/* Existing owner-supplied artwork, not a customer photo or product screenshot. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="campaign-image" src="/showcase/condominio.webp" alt=""/>
        </section>

        <section className="lp-sec" aria-labelledby="cl-problema"><div className="lp-wrap">
          <h2 id="cl-problema">O desafio: a energia do prédio tem limite</h2>
          <p className="lp-sub">Um carro elétrico carregando consome como vários chuveiros ligados ao mesmo tempo. Quando dois ou três moradores carregam juntos no fim do dia, a soma pode passar do que a entrada do prédio aguenta — e a conta de demanda da concessionária dispara.</p>
          <DemandFigure/>
          <p className="cl-note">Valores ilustrativos. O limite real depende da entrada de energia e do projeto elétrico de cada condomínio.</p>
        </div></section>

        <section className="lp-sec" aria-labelledby="cl-caminhos"><div className="lp-wrap">
          <h2 id="cl-caminhos">Os dois caminhos da norma</h2>
          <p className="lp-sub">A NBR 17019, que trata de recarga de veículos elétricos em edificações, pede que cada ponto de recarga entre no cálculo da demanda do prédio. Na prática, restam dois caminhos:</p>
          <div className="cl-paths">
            <div className="lp-card">
              <div className="lp-ico"><Building2 size={22} aria-hidden="true"/></div>
              <h3>1. Ampliar a entrada de energia</h3>
              <p>Trocar cabos, proteções e às vezes o transformador. Resolve, mas envolve obra, aprovação na concessionária e um custo alto para o condomínio.</p>
            </div>
            <div className="lp-card">
              <div className="lp-ico"><Gauge size={22} aria-hidden="true"/></div>
              <h3>2. Controlar a recarga</h3>
              <p>Com um sistema que limita e divide a potência entre os carros, a norma permite calcular a demanda com o controle em vez de somar tudo. Sem obra pesada.</p>
            </div>
          </div>
          <p className="cl-note">O enquadramento exato na norma depende do projeto elétrico. Confirme com o projetista do condomínio.</p>
        </div></section>

        <section className="lp-sec" aria-labelledby="cl-controle"><div className="lp-wrap">
          <h2 id="cl-controle">Como o Telektro controla a carga</h2>
          <p className="lp-sub">O Telektro conversa com os carregadores pelo padrão OCPP 1.6J e ajusta a potência de cada ponto automaticamente.</p>
          <div className="cl-controls">
            {controls.map((control) => (
              <div className="lp-card" key={control.title}>
                <div className="lp-ico"><control.icon size={22} aria-hidden="true"/></div>
                <h3>{control.title}</h3>
                <p>{control.text}</p>
              </div>
            ))}
          </div>
        </div></section>

        <section className="lp-sec" aria-labelledby="cl-painel"><div className="lp-wrap">
          <h2 id="cl-painel">O que o condomínio acompanha</h2>
          <p className="lp-sub">Cada morador tem seu próprio carregador. O condomínio usa o Telektro para organizar o acesso e a energia, sem cobrar recarga pelo sistema.</p>
          <div className="cl-controls">
            <div className="lp-card">
              <div className="lp-ico"><Car size={22} aria-hidden="true"/></div>
              <h3>Sessões em andamento</h3>
              <p>Veja quem está carregando, em qual vaga e há quanto tempo, em tempo real.</p>
            </div>
            <div className="lp-card">
              <div className="lp-ico"><Gauge size={22} aria-hidden="true"/></div>
              <h3>Consumo em kWh</h3>
              <p>Histórico de consumo por vaga e por morador, para prestação de contas na assembleia.</p>
            </div>
            <div className="lp-card">
              <div className="lp-ico"><Check size={22} aria-hidden="true"/></div>
              <h3>Acesso por tag</h3>
              <p>Cada morador libera a própria recarga com uma tag. Visitante não carrega sem autorização.</p>
            </div>
            <div className="lp-card">
              <div className="lp-ico"><Building2 size={22} aria-hidden="true"/></div>
              <h3>Relatórios</h3>
              <p>Resumos de uso do período para a administração, sem planilha manual.</p>
            </div>
          </div>
        </div></section>

        <section className="lp-sec" aria-labelledby="cl-detalhes"><div className="lp-wrap"><div className="campaign-details">
          <h2 id="cl-detalhes">Vamos entender seu condomínio</h2>
          <p>Converse sobre o seu condomínio, quantas vagas terão recarga e o modelo dos carregadores. Confirmamos a compatibilidade e as condições do plano antes da contratação.</p>
          <p>O Telektro é o software de gestão. Carregador físico e instalação elétrica não estão incluídos. A conexão exige internet e equipamento compatível com OCPP 1.6J — o padrão usado por WEG, Intelbras, Livoltek e outros fabricantes. Os recursos dependem do modelo e da configuração de cada carregador.</p>
          <p>Mensalidade base. Limites e adicionais devem ser confirmados na proposta.</p>
          {cta("details")}<br/>
          <Link className="campaign-guide" href="/guias/carregador-carro-eletrico-condominio">Ver o guia de uso</Link>
        </div></div></section>

        <section className="lp-sec"><div className="lp-wrap" style={{ textAlign: "center" }}>
          <h2>Traga a recarga para o seu condomínio</h2>
          <p className="lp-sub" style={{ margin: "0 auto 24px" }}>Peça uma demonstração e veja o painel funcionando com um condomínio de exemplo.</p>
          {cta("final")}
        </div></section>
      </main>
      <footer className="lp-wrap campaign-footer">{COMPANY_NOTE}</footer>
    </div>
  );
}
