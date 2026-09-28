"use client";

import { useActionState, useState } from "react";
import { Activity, ArrowRight, Building2, Cable, LayoutDashboard, MapPin, PlugZap, ShieldCheck, Users, Zap } from "lucide-react";
import { createSite, signOut, type FormState } from "@/app/workspace-actions";

type Organization = { id: string; name: string; slug: string };
type Site = { id: string; name: string; address: string | null; timezone: string; max_power_kw: number | null };

const initialState: FormState = {};

function Brand() {
  return <div className="brand"><div className="brand-mark"><Zap size={19} strokeWidth={2.1}/></div><div><div className="brand-name">TELEKTRO</div><div className="brand-subtitle">Energy operations</div></div></div>;
}

function SiteForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(createSite.bind(null, organizationId), initialState);
  return <form action={action} className="site-form">
    <label htmlFor="site-name">Nome do local</label>
    <input id="site-name" name="name" autoComplete="organization-title" placeholder="Ex.: Estação Centro" maxLength={120} required/>
    <label htmlFor="site-address">Endereço <span>opcional</span></label>
    <input id="site-address" name="address" autoComplete="street-address" placeholder="Rua, número e cidade"/>
    <div className="site-form-row">
      <div><label htmlFor="site-power">Capacidade elétrica <span>kW · opcional</span></label><input id="site-power" name="max_power_kw" type="number" min="0.001" step="0.001" placeholder="Ex.: 60"/></div>
      <div><label htmlFor="site-timezone">Fuso horário</label><input id="site-timezone" name="timezone" defaultValue="America/Fortaleza" required/></div>
    </div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <p className="form-success" role="status">{state.success}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "Salvando…" : "Cadastrar local"}<ArrowRight size={14}/></button>
  </form>;
}

export function Dashboard({
  email, organizations, organization, role, sites, capacityKw, totalChargers, onlineChargers, activeSessions,
}: {
  email: string;
  organizations: Organization[];
  organization: Organization;
  role: string;
  sites: Site[];
  capacityKw: number;
  totalChargers: number;
  onlineChargers: number;
  activeSessions: number;
}) {
  const [activeNav, setActiveNav] = useState("Visão geral");
  const canManageSites = role === "owner" || role === "admin";
  const stats = [
    { label: "Locais", value: sites.length, detail: "cadastrados na organização", icon: MapPin },
    { label: "Carregadores", value: totalChargers, detail: `${onlineChargers} online`, icon: PlugZap },
    { label: "Sessões ativas", value: activeSessions, detail: "em andamento", icon: Activity },
    { label: "Capacidade instalada", value: `${capacityKw.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kW`, detail: "soma dos limites dos locais", icon: Zap },
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand/>
      <div className="nav-label">Operação</div>
      <nav className="nav-list" aria-label="Navegação principal">
        <button className={`nav-item ${activeNav === "Visão geral" ? "active" : ""}`} onClick={() => setActiveNav("Visão geral")}><LayoutDashboard size={16}/>Visão geral</button>
        <button className={`nav-item ${activeNav === "Locais" ? "active" : ""}`} onClick={() => setActiveNav("Locais")}><MapPin size={16}/>Locais<span className="nav-count">{sites.length}</span></button>
        <button className="nav-item nav-item-disabled" disabled title="Disponível em uma próxima etapa"><PlugZap size={16}/>Carregadores<span className="nav-count">Em breve</span></button>
        <button className="nav-item nav-item-disabled" disabled title="Disponível após a integração OCPP"><Activity size={16}/>Sessões</button>
        <button className="nav-item nav-item-disabled" disabled title="Disponível após a integração OCPP"><Zap size={16}/>Energia</button>
        <button className="nav-item nav-item-disabled" disabled title="Disponível em uma próxima etapa"><Users size={16}/>Usuários</button>
      </nav>
      <div className="sidebar-bottom"><div className="gateway-card"><div className="gateway-row"><i className="gateway-dot"/>Gateway aguardando integração</div><div className="gateway-note">Nenhum carregador está conectado ao workspace.</div></div><div className="profile"><div className="avatar">{email.slice(0, 1).toUpperCase() || "T"}</div><div className="profile-copy"><div className="profile-name">{organization.name}</div><div className="profile-role">{role}</div></div></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeNav}</strong></div>
        <div className="topbar-actions">
          <form className="organization-switcher" action="/" method="get">
            <Building2 size={14}/><label className="sr-only" htmlFor="active-organization">Organização ativa</label>
            <select id="active-organization" name="org" defaultValue={organization.id} onChange={(event) => event.currentTarget.form?.requestSubmit()} aria-label="Organização ativa">
              {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </form>
          <span className="account-email" title={email}>{email}</span>
          <form action={signOut}><button className="signout-button" type="submit">Sair</button></form>
        </div>
      </header>

      <div className="page-wrap">
        <div className="page-heading"><div><p className="eyebrow">OPERAÇÃO · WORKSPACE REAL</p><h1>{activeNav === "Locais" ? "Locais" : "Visão geral"}</h1><p className="page-description">{organization.name} · dados carregados do Supabase com isolamento por organização.</p></div><div className="workspace-role"><ShieldCheck size={14}/>{role}</div></div>

        {activeNav === "Visão geral" ? <>
          <div className="workspace-stats" aria-label="Resumo da organização">
            {stats.map(({ label, value, detail, icon: Icon }) => <article className="panel workspace-stat" key={label}><div className="workspace-stat-top"><span>{label}</span><Icon size={16}/></div><strong>{value}</strong><small>{detail}</small></article>)}
          </div>
          <section className="panel operation-empty">
            <div className="empty-symbol"><Cable size={21}/></div>
            <div><p className="eyebrow">PRÓXIMA ETAPA</p><h2>{totalChargers ? "Base operacional conectada" : "Cadastre locais antes de conectar carregadores"}</h2><p>{totalChargers ? `${totalChargers} carregador(es) cadastrado(s); ${onlineChargers} online. A operação OCPP será habilitada na próxima etapa.` : "Os locais guardam endereço, fuso horário e limite elétrico. Depois deles, você poderá associar carregadores OCPP 1.6J."}</p></div>
            <button className="secondary-button" onClick={() => setActiveNav("Locais")}>{sites.length ? "Gerenciar locais" : "Cadastrar primeiro local"}<ArrowRight size={14}/></button>
          </section>
          <div className="section-row"><div><h2 className="section-title">Locais da organização</h2><p className="section-subtitle">Capacidade e localização configuradas para esta operação.</p></div><button className="link-button" onClick={() => setActiveNav("Locais")}>Ver locais <ArrowRight size={13}/></button></div>
          <SiteList sites={sites}/>
        </> : <div className="site-management">
          <section className="panel site-list-panel"><div className="panel-heading"><div><h2 className="panel-title">Locais cadastrados</h2><div className="panel-kicker">{sites.length} local(is) em {organization.name}</div></div><MapPin size={17}/></div><SiteList sites={sites}/></section>
          {canManageSites ? <section className="panel site-create-panel"><div className="panel-heading"><div><h2 className="panel-title">Adicionar local</h2><div className="panel-kicker">Cadastre os dados elétricos e de localização.</div></div></div><SiteForm organizationId={organization.id}/></section> : <section className="panel site-create-panel"><h2 className="panel-title">Cadastro restrito</h2><p className="panel-kicker">Peça a um owner ou admin para cadastrar locais nesta organização.</p></section>}
        </div>}
        <p className="footnote">Os indicadores refletem os registros atuais. Atualize a página para buscar os dados mais recentes.</p>
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Navegação móvel"><button className={activeNav === "Visão geral" ? "active" : ""} onClick={() => setActiveNav("Visão geral")}><LayoutDashboard/>Início</button><button className={activeNav === "Locais" ? "active" : ""} onClick={() => setActiveNav("Locais")}><MapPin/>Locais</button></nav>
  </div>;
}

function SiteList({ sites }: { sites: Site[] }) {
  if (!sites.length) return <div className="site-empty"><MapPin size={17}/><strong>Nenhum local cadastrado</strong><span>Adicione um local para começar a organizar sua infraestrutura.</span></div>;
  return <div className="site-list">{sites.map((site) => <article className="panel site-row" key={site.id}><div className="site-row-icon"><MapPin size={16}/></div><div className="site-row-main"><strong>{site.name}</strong><span>{site.address || "Endereço não informado"}</span></div><div className="site-row-meta"><span>Capacidade</span><strong>{site.max_power_kw ? `${Number(site.max_power_kw).toLocaleString("pt-BR")} kW` : "Não definida"}</strong></div><div className="site-row-meta"><span>Fuso horário</span><strong>{site.timezone}</strong></div></article>)}</div>;
}
