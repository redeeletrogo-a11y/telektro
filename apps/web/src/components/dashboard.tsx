"use client";

import { useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, Bell, Building2, Cable,
  ChartNoAxesCombined, ChevronDown, CircleHelp, Clock3, Download,
  LayoutDashboard, MapPin, Menu, MoreHorizontal, PlugZap, Settings2,
  ShieldCheck, SlidersHorizontal, Users, Zap,
} from "lucide-react";

const navItems = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Carregadores", icon: PlugZap, count: "12" },
  { label: "Sessões", icon: Activity },
  { label: "Energia", icon: Zap },
  { label: "Locais", icon: MapPin },
  { label: "Usuários", icon: Users },
  { label: "Relatórios", icon: ChartNoAxesCombined },
];

const chargers = [
  { name: "Estação Norte 01", id: "TK-NT-001", status: "Carregando", type: "active", power: "11,4", energy: "23,7", fill: 72, time: "Conectado há 1h 08min" },
  { name: "Estação Norte 02", id: "TK-NT-002", status: "Disponível", type: "available", power: "—", energy: "—", fill: 0, time: "Livre há 26min" },
  { name: "Estação Sul 01", id: "TK-SL-001", status: "Carregando", type: "active", power: "7,2", energy: "12,4", fill: 45, time: "Conectado há 34min" },
];

function Brand() {
  return <div className="brand"><div className="brand-mark"><Zap size={19} strokeWidth={2.1} /></div><div><div className="brand-name">TELEKTRO</div><div className="brand-subtitle">Energy operations</div></div></div>;
}

function PowerChart() {
  return <div className="chart-area" role="img" aria-label="Gráfico demonstrativo de potência nas últimas 24 horas. A linha pontilhada indica o limite de 60 quilowatts.">
    <svg viewBox="0 0 700 210" preserveAspectRatio="none">
      <defs><linearGradient id="powerArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#168e83" stopOpacity=".17"/><stop offset="100%" stopColor="#168e83" stopOpacity=".01"/></linearGradient></defs>
      {[18, 61, 104, 147].map((y) => <line key={y} className="chart-grid" x1="40" x2="690" y1={y} y2={y} />)}
      <text className="chart-axis" x="0" y="21">60</text><text className="chart-axis" x="0" y="64">40</text><text className="chart-axis" x="0" y="107">20</text><text className="chart-axis" x="7" y="150">0</text>
      <line className="chart-limit" x1="40" x2="690" y1="45" y2="45" />
      <path className="chart-fill" d="M40 136 C65 135 71 128 93 127 S130 130 148 121 S180 115 197 119 S223 126 244 112 S276 96 296 102 S323 116 347 108 S380 94 399 99 S433 107 451 88 S481 80 498 89 S528 94 546 71 S580 67 597 78 S620 89 638 76 S668 72 690 65 L690 150 L40 150 Z" />
      <path className="chart-line" d="M40 136 C65 135 71 128 93 127 S130 130 148 121 S180 115 197 119 S223 126 244 112 S276 96 296 102 S323 116 347 108 S380 94 399 99 S433 107 451 88 S481 80 498 89 S528 94 546 71 S580 67 597 78 S620 89 638 76 S668 72 690 65" />
      <circle cx="546" cy="71" r="4" fill="#fff" stroke="#138c81" strokeWidth="2" />
      <text className="chart-axis" x="40" y="177">00:00</text><text className="chart-axis" x="195" y="177">06:00</text><text className="chart-axis" x="356" y="177">12:00</text><text className="chart-axis" x="515" y="177">18:00</text><text className="chart-axis" x="660" y="177">Agora</text>
    </svg>
  </div>;
}

export function Dashboard() {
  const [activeNav, setActiveNav] = useState("Visão geral");
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("Últimas 24 horas");
  const chooseNav = (label: string) => {
    setActiveNav(label);
    if (label !== "Visão geral") setNotice(`${label}: a estrutura desta área está preparada para a próxima etapa.`);
    else setNotice("");
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <div className="nav-label">Operação</div>
      <nav className="nav-list" aria-label="Navegação principal">{navItems.map(({ label, icon: Icon, count }) => <button key={label} className={`nav-item ${activeNav === label ? "active" : ""}`} onClick={() => chooseNav(label)}><Icon size={16} strokeWidth={1.8}/>{label}{count && <span className="nav-count">{count}</span>}</button>)}</nav>
      <div className="nav-label" style={{ marginTop: 19 }}>Administração</div>
      <nav className="nav-list" aria-label="Administração"><button className="nav-item" onClick={() => setNotice("Configurações: módulo em preparação.")}><Settings2 size={16} strokeWidth={1.8}/>Configurações</button><button className="nav-item" onClick={() => setNotice("Ajuda: documentação em preparação.")}><CircleHelp size={16} strokeWidth={1.8}/>Ajuda e suporte</button></nav>
      <div className="sidebar-bottom">
        <div className="gateway-card"><div className="gateway-row"><i className="gateway-dot"/>Gateway aguardando setup</div><div className="gateway-note">Conexão OCPP disponível após configurar o ambiente.</div></div>
        <div className="profile"><div className="avatar">TK</div><div><div className="profile-name">Workspace Telektro</div><div className="profile-role">Ambiente de demonstração</div></div><MoreHorizontal size={17} style={{ marginLeft: "auto", color: "#8da0a5" }}/></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" aria-label="Abrir menu" onClick={() => setNotice("Menu de navegação disponível pelos atalhos inferiores.")}><Menu size={16}/></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeNav}</strong></div><div className="topbar-actions"><button className="site-select" onClick={() => setNotice("Seletor de local: nenhum local real configurado ainda.")}><Building2 size={14}/>Todos os locais<ChevronDown size={13}/></button><button className="icon-button" aria-label="Notificações" onClick={() => setNotice("Você está em um ambiente de demonstração. Não há alertas em tempo real.")}><Bell size={15}/><i className="notification-dot"/></button><div className="avatar" title="Workspace Telektro">TK</div></div></header>
      <div className="page-wrap">
        <div className="page-heading"><div><p className="eyebrow">Operação · 28 set 2026</p><h1>Visão geral</h1><p className="page-description">Acompanhe a operação da sua infraestrutura de recarga.</p></div><div className="heading-actions"><button className="period-select" onClick={() => setPeriod(period === "Últimas 24 horas" ? "Últimos 7 dias" : "Últimas 24 horas")}><Clock3 size={13}/>{period}<ChevronDown size={12}/></button><button className="secondary-button" onClick={() => setNotice("Exportação disponível quando houver dados conectados.")}><Download size={13}/>Exportar</button><button className="primary-button" onClick={() => setNotice("Cadastro de carregadores será habilitado com a organização Supabase.")}><PlugZap size={14}/>Adicionar carregador</button></div></div>
        <div className="demo-banner"><ShieldCheck size={15}/><strong>Ambiente de demonstração</strong><span>Os valores exibidos são ilustrativos. Nenhum carregador ou dado real está conectado.</span></div>
        {notice && <div className="demo-banner" role="status" style={{ borderColor: "#d8e5e8", color: "#536b75", background: "#f3f8fa" }}><CircleHelp size={14}/><span>{notice}</span><button onClick={() => setNotice("")} style={{ marginLeft: "auto", border: 0, color: "inherit", background: "transparent" }} aria-label="Fechar">×</button></div>}
        <section className="overview-grid" aria-label="Resumo de energia">
          <article className="panel power-panel"><div className="panel-heading"><div><h2 className="panel-title">Potência em uso</h2><div className="panel-kicker">Consumo instantâneo do local</div></div><button className="tiny-action" onClick={() => setNotice("Dados de potência são ilustrativos até conectar um carregador.")}><MoreHorizontal size={16}/></button></div><div className="power-number">18,6<small>kW</small></div><div className="power-caption">Potência agregada dos carregadores ativos</div><div className="capacity-wrap"><div className="capacity-labels"><span>Limite do local</span><strong>60 kW</strong></div><div className="capacity-track"><div className="capacity-fill" style={{ width: "31%" }}><i className="capacity-marker"/></div></div><div className="capacity-bottom"><span>31% utilizado</span><strong>41,4 kW disponíveis</strong></div></div><div className="power-divider"/><div className="power-foot"><span>Smart Charging</span><span className="smart-indicator"><i className="smart-dot"/>Preparado para configuração</span></div></article>
          <article className="panel chart-panel"><div className="chart-heading"><div><h2 className="panel-title">Demanda de potência</h2><div className="panel-kicker">Potência agregada · kW</div></div><div className="legend"><span className="legend-item"><i className="legend-line"/>Potência</span><span className="legend-item"><i className="legend-dash"/>Limite do local</span></div></div><PowerChart/><div className="chart-footer"><span>Atualizado agora <span aria-hidden="true">·</span> demonstração</span><span>Escala: 0–60 kW</span></div></article>
        </section>
        <div className="section-row"><div><h2 className="section-title">Carregadores</h2><p className="section-subtitle">Visão operacional dos equipamentos neste workspace.</p></div><button className="link-button" onClick={() => chooseNav("Carregadores")}>Ver todos <ArrowRight size={13}/></button></div>
        <section className="charger-list" aria-label="Carregadores demonstrativos">{chargers.map((charger) => <article className="panel charger-card" key={charger.id}><div className="charger-top"><div className="charger-id"><div className="charger-icon"><Cable size={16}/></div><div><div className="charger-name">{charger.name}</div><div className="charger-site">{charger.id} · Local de demonstração</div></div></div><button className="tiny-action" aria-label={`Mais ações para ${charger.name}`} onClick={() => setNotice(`${charger.name}: ações remotas não estão disponíveis na demonstração.`)}><MoreHorizontal size={16}/></button></div><div style={{ marginTop: 12 }}><span className={`status-badge ${charger.type}`}><i className="status-dot"/>{charger.status}</span></div><div className="charger-metrics"><div><div className="metric-label">Potência atual</div><div className="metric-value">{charger.power}<small>kW</small></div></div><div><div className="metric-label">Energia da sessão</div><div className="metric-value">{charger.energy}<small>kWh</small></div></div></div>{charger.fill > 0 && <div className="mini-track"><div className="mini-fill" style={{ width: `${charger.fill}%` }}/></div>}<div className="charger-foot"><span>{charger.time}</span><span className="connection"><i className="status-dot"/>Conectado</span></div></article>)}</section>
        <section className="lower-grid"><article className="panel sessions-panel"><div className="panel-heading"><div><h2 className="panel-title">Sessões em andamento</h2><div className="panel-kicker">Atividade atual dos carregadores</div></div><button className="link-button" onClick={() => chooseNav("Sessões")}>Histórico <ArrowRight size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>MOTORISTA</th><th>CARREGADOR</th><th>INÍCIO</th><th>ENERGIA</th><th>STATUS</th></tr></thead><tbody><tr><td><span className="session-person"><i className="mini-avatar">AM</i>Alex M.</span></td><td>Estação Norte 01</td><td className="table-muted">09:18</td><td>23,7 kWh</td><td><span className="live-label"><i className="status-dot"/>Ativa</span></td></tr><tr><td><span className="session-person"><i className="mini-avatar">RC</i>Rafa C.</span></td><td>Estação Sul 01</td><td className="table-muted">09:52</td><td>12,4 kWh</td><td><span className="live-label"><i className="status-dot"/>Ativa</span></td></tr></tbody></table></div></article><article className="panel alerts-panel"><div className="panel-heading"><div><h2 className="panel-title">Atenção operacional</h2><div className="panel-kicker">Itens para acompanhamento</div></div><button className="tiny-action" onClick={() => setNotice("Sem alertas reais: estes itens são ilustrativos.")}><ArrowDownRight size={15}/></button></div><div className="alert-item"><div className="alert-icon"><AlertTriangle size={14}/></div><div className="alert-copy"><div className="alert-title">Gateway não configurado</div><div className="alert-detail">Configure as variáveis de ambiente para ativar a conexão OCPP.</div></div><span className="alert-time">Setup</span></div><div className="alert-item"><div className="alert-icon"><SlidersHorizontal size={14}/></div><div className="alert-copy"><div className="alert-title">Limite do site é demonstrativo</div><div className="alert-detail">Defina a capacidade elétrica antes de habilitar controle.</div></div><span className="alert-time">Setup</span></div></article></section>
        <p className="footnote">Dados demonstrativos para pré-visualização · As ações remotas permanecem desabilitadas até integração com carregadores.</p>
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Navegação móvel">{navItems.slice(0, 5).map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => chooseNav(label)}><Icon/>{label === "Visão geral" ? "Início" : label}</button>)}</nav>
  </div>;
}
