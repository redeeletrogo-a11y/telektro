import Link from "next/link";
import { ArrowRight, Building2, Check, Gauge, Home, PlugZap, QrCode, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { HeroCarousel } from "./hero-carousel";
import "./landing.css";

const check = <Check size={16} aria-hidden="true"/>;

const plans = [
  { id: "casa", icon: <Home size={20}/>, name: "Residencial", tag: "Casa", price: "R$ 19,90", unit: "/mês", text: "Para quem tem carro elétrico em casa e quer controlar tudo pelo celular.", items: ["Iniciar, parar e acompanhar a recarga pelo celular", "Medição de kWh por sessão", "Histórico de recargas", "Instalável no celular (PWA)"] },
  { id: "condominio", icon: <Building2 size={20}/>, name: "Condomínio", tag: "Mais procurado", hl: true, price: "R$ 199", unit: "/mês", text: "Até 5 carregadores por local. Carregador extra: + R$ 19,90/mês cada.", items: ["Vários carregadores e usuários em um painel", "Controle de acesso por morador", "Módulo de cobrança e rateio: + R$ 49,90/mês", "Se o app receber o pagamento: + 1% das recargas", "Exportação de consumo para a administração"] },
  { id: "eletroposto", icon: <PlugZap size={20}/>, name: "Eletroposto", tag: "Público", price: "R$ 149", unit: "/mês", text: "Até 2 carregadores AC. AC extra: + R$ 49 cada. DC: + R$ 99 cada.", items: ["Recarga por QR Code e controle de pagamento", "Status em tempo real via OCPP 1.6J", "Relatórios de sessões e receita", "+ 2% das recargas processadas"] },
];

export function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap">
          <Link href="/" className="lp-logo" aria-label="Telektro">
            <svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" fill="#0f776c"/><path fill="#fff" d="M112 118h288v78H300v198h-88V196h-100z"/><path fill="#bcebd1" d="m278 224-79 112h55l-23 90 91-132h-59l34-70z"/></svg>
            TELEKTRO
          </Link>
          <nav className="lp-links" aria-label="Seções"><a href="#como">Como funciona</a><a href="#solucoes">Soluções</a><a href="#planos">Planos</a></nav>
          <Link href="/login" className="lp-btn ghost">Entrar</Link>
        </div>
      </header>

      <main>
        <section className="lp-wrap lp-hero">
          <div>
            <span className="lp-eyebrow">Gestão de recarga de veículos elétricos</span>
            <h1>Controle sua recarga. <em>Do app à cobrança.</em></h1>
            <p className="lp-lead">Uma plataforma para casa, condomínio e eletroposto: liga, desliga e mede cada recarga, com dados confiáveis e gestão em um só lugar.</p>
            <div className="lp-cta">
              <a href="#planos" className="lp-btn primary">Ver planos <ArrowRight size={16}/></a>
              <Link href="/login" className="lp-btn ghost">Entrar no painel</Link>
            </div>
          </div>
        </section>

        <div className="lp-wrap"><HeroCarousel/></div>

        <div className="lp-wrap lp-stats">
          <div className="lp-stat"><b>OCPP 1.6J</b><span>Compatível com carregadores do mercado</span></div>
          <div className="lp-stat"><b>kWh medido</b><span>Por sessão, base para cobrança</span></div>
          <div className="lp-stat"><b>No celular</b><span>Instale como app, sem loja</span></div>
          <div className="lp-stat"><b>Multiempresa</b><span>Dados isolados por cliente</span></div>
        </div>

        <section id="como" className="lp-sec"><div className="lp-wrap">
          <h2>Como funciona</h2>
          <p className="lp-sub">Em três passos, do carregador ao controle.</p>
          <div className="lp-grid c3">
            <div className="lp-card"><div className="lp-ico"><PlugZap size={20}/></div><div className="lp-step-n" style={{marginTop:12}}>PASSO 1</div><h3>Conecte o carregador</h3><p>Cadastre o carregador no painel e aponte-o para o Telektro com as credenciais geradas.</p></div>
            <div className="lp-card"><div className="lp-ico"><Smartphone size={20}/></div><div className="lp-step-n" style={{marginTop:12}}>PASSO 2</div><h3>Controle pelo celular</h3><p>Inicie e pare recargas, veja potência e energia em tempo real, sem cartão RFID.</p></div>
            <div className="lp-card"><div className="lp-ico"><Gauge size={20}/></div><div className="lp-step-n" style={{marginTop:12}}>PASSO 3</div><h3>Acompanhe e cobre</h3><p>Histórico, relatórios e medição de kWh para rateio ou cobrança por recarga.</p></div>
          </div>
        </div></section>

        <section id="solucoes" className="lp-sec"><div className="lp-wrap">
          <h2>Escolha o seu caminho</h2>
          <p className="lp-sub">O mesmo sistema, configurado para cada tipo de cliente.</p>
          <div className="lp-grid c3">
            {plans.map((p) => (
              <a key={p.id} href={`#${p.id}`} className="lp-card"><div className="lp-ico">{p.icon}</div><h3>{p.name}</h3><p>{p.text}</p><p style={{marginTop:14,color:"var(--lp-acc)",fontWeight:700}}>Ver detalhes →</p></a>
            ))}
          </div>
          <div className="lp-card" style={{marginTop:16,display:"flex",gap:14,alignItems:"flex-start"}}>
            <div className="lp-ico"><QrCode size={20}/></div>
            <div><h3 style={{margin:"0 0 6px"}}>Em breve: Eletroposto completo e franquia</h3><p>Instalação, gestão, controle de pagamentos e fornecimento do carregador, em modelo de franquia. Fale com a gente para entrar na lista.</p></div>
          </div>
        </div></section>

        <section id="planos" className="lp-sec"><div className="lp-wrap">
          <h2>Planos e valores</h2>
          <p className="lp-sub">Valores propostos para o início da operação. Sujeitos a ajuste nos primeiros pilotos.</p>
          <div className="lp-grid c3">
            {plans.map((p) => (
              <article key={p.id} id={p.id} className={`lp-card lp-plan${p.hl ? " hl" : ""}`}>
                <span className="lp-step-n">{p.tag.toUpperCase()}</span>
                <h3>{p.name}</h3>
                <div className="lp-price">{p.price}<small>{p.unit}</small></div>
                <p>{p.text}</p>
                <ul className="lp-feat">{p.items.map((i) => <li key={i}>{check}<span>{i}</span></li>)}</ul>
                <Link href="/login" className={`lp-btn ${p.hl ? "primary" : "ghost"}`}>Contratar / Entrar</Link>
              </article>
            ))}
          </div>
          <p className="lp-fine"><ShieldCheck size={14} style={{verticalAlign:"-2px"}}/> Taxas do gateway de pagamento não estão incluídas. Dados de cada cliente ficam isolados.</p>
        </div></section>
      </main>

      <footer className="lp-wrap lp-foot"><span><Zap size={13} style={{verticalAlign:"-2px"}}/> Telektro, operação de recarga</span><Link href="/login">Entrar</Link></footer>
    </div>
  );
}
