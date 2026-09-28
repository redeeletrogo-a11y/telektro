"use client";

import { useActionState, useState } from "react";
import { Activity, ArrowRight, Building2, Cable, Check, Copy, LayoutDashboard, MapPin, PlugZap, ShieldCheck, Users, Zap } from "lucide-react";
import { createSite, registerCharger, signOut, type FormState } from "@/app/workspace-actions";

type Organization = { id: string; name: string; slug: string };
type Site = { id: string; name: string; address: string | null; timezone: string; max_power_kw: number | null };
type Charger = { id: string; site_id: string; charge_point_id: string; vendor: string | null; model: string | null; max_power_kw: number | null; status: string; online: boolean; last_heartbeat_at: string | null };

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

function ChargerForm({ organizationId, sites }: { organizationId: string; sites: Site[] }) {
  const [state, action, pending] = useActionState(registerCharger.bind(null, organizationId), initialState);
  const [copyFeedback, setCopyFeedback] = useState("");
  async function copyCredential(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopyFeedback(`${label} copiado para a área de transferência.`); }
    catch { setCopyFeedback("Selecione e copie a credencial manualmente."); }
  }
  if (!sites.length) return <div className="site-empty charger-form-empty"><MapPin size={17}/><strong>Cadastre um local primeiro</strong><span>O carregador precisa pertencer a um local da organização.</span></div>;

  return <form action={action} className="site-form">
    <label htmlFor="charger-id">ID OCPP</label>
    <input id="charger-id" name="charge_point_id" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={64} placeholder="Ex.: TELEKTRO-EVSE-001" required/>
    <label htmlFor="charger-site">Local</label>
    <select id="charger-site" name="site_id" defaultValue="" required><option value="" disabled>Selecione um local</option>{sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select>
    <div className="site-form-row">
      <div><label htmlFor="charger-vendor">Fabricante <span>opcional</span></label><input id="charger-vendor" name="vendor" maxLength={50} placeholder="Ex.: WEG"/></div>
      <div><label htmlFor="charger-model">Modelo <span>opcional</span></label><input id="charger-model" name="model" maxLength={50} placeholder="Ex.: WEMOB"/></div>
    </div>
    <label htmlFor="charger-power">Potência máxima <span>kW · opcional</span></label>
    <input id="charger-power" name="max_power_kw" type="number" min="0.001" step="0.001" placeholder="Ex.: 22"/>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.credential && <div className="credential-reveal"><strong>Credencial criada — copie agora</strong><span>Usuário: <code>{state.chargePointId}</code><button className="credential-copy" type="button" onClick={() => void copyCredential(state.chargePointId ?? "", "Usuário")}>{copyFeedback.startsWith("Usuário") ? <Check size={12}/> : <Copy size={12}/>}Copiar</button></span><span>Senha: <code>{state.credential}</code><button className="credential-copy" type="button" onClick={() => void copyCredential(state.credential ?? "", "Senha")}>{copyFeedback.startsWith("Senha") ? <Check size={12}/> : <Copy size={12}/>}Copiar</button></span>{copyFeedback && <small role="status">{copyFeedback}</small>}<small>O Telektro guarda somente o hash. Esta senha não será exibida novamente.</small></div>}
    <button className="primary-button" disabled={pending}>{pending ? "Cadastrando…" : "Cadastrar carregador"}<ArrowRight size={14}/></button>
  </form>;
}

export function Dashboard({
  email, organizations, organization, role, sites, chargers, capacityKw, totalChargers, onlineChargers, activeSessions,
}: {
  email: string;
  organizations: Organization[];
  organization: Organization;
  role: string;
  sites: Site[];
  chargers: Charger[];
  capacityKw: number;
  totalChargers: number;
  onlineChargers: number;
  activeSessions: number;
}) {
  const [activeNav, setActiveNav] = useState("Visão geral");
  const canManageSites = role === "owner" || role === "admin";
  const canManageChargers = role === "owner" || role === "admin" || role === "technician";
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
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
        <button className={`nav-item ${activeNav === "Carregadores" ? "active" : ""}`} onClick={() => setActiveNav("Carregadores")}><PlugZap size={16}/>Carregadores<span className="nav-count">{chargers.length}</span></button>
        <button className="nav-item nav-item-disabled" disabled title="Disponível após a integração OCPP"><Activity size={16}/>Sessões</button>
        <button className="nav-item nav-item-disabled" disabled title="Disponível após a integração OCPP"><Zap size={16}/>Energia</button>
        <button className="nav-item nav-item-disabled" disabled title="Disponível em uma próxima etapa"><Users size={16}/>Usuários</button>
      </nav>
      <div className="sidebar-bottom"><div className="gateway-card"><div className="gateway-row"><i className="gateway-dot"/>{onlineChargers ? `${onlineChargers} carregador(es) online` : "Gateway aguardando conexão"}</div><div className="gateway-note">{chargers.length ? `${chargers.length} carregador(es) cadastrado(s); o estado de conexão vem do gateway OCPP.` : "Cadastre um carregador para preparar a conexão OCPP."}</div></div><div className="profile"><div className="avatar">{email.slice(0, 1).toUpperCase() || "T"}</div><div className="profile-copy"><div className="profile-name">{organization.name}</div><div className="profile-role">{role}</div></div></div></div>
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
        <div className="page-heading"><div><p className="eyebrow">OPERAÇÃO · WORKSPACE REAL</p><h1>{activeNav}</h1><p className="page-description">{organization.name} · dados carregados do Supabase com isolamento por organização.</p></div><div className="workspace-role"><ShieldCheck size={14}/>{role}</div></div>

        {activeNav === "Visão geral" ? <>
          <div className="workspace-stats" aria-label="Resumo da organização">
            {stats.map(({ label, value, detail, icon: Icon }) => <article className="panel workspace-stat" key={label}><div className="workspace-stat-top"><span>{label}</span><Icon size={16}/></div><strong>{value}</strong><small>{detail}</small></article>)}
          </div>
          <section className="panel operation-empty">
            <div className="empty-symbol"><Cable size={21}/></div>
            <div><p className="eyebrow">PRÓXIMA ETAPA</p><h2>{totalChargers ? "Carregadores cadastrados" : "Cadastre locais antes de conectar carregadores"}</h2><p>{totalChargers ? `${totalChargers} carregador(es) cadastrado(s); ${onlineChargers} online no último estado recebido do gateway.` : "Os locais guardam endereço, fuso horário e limite elétrico. Depois deles, você poderá cadastrar e provisionar carregadores OCPP 1.6J."}</p></div>
            <button className="secondary-button" onClick={() => setActiveNav(sites.length ? "Carregadores" : "Locais")}>{sites.length ? "Cadastrar carregador" : "Cadastrar primeiro local"}<ArrowRight size={14}/></button>
          </section>
          <div className="section-row"><div><h2 className="section-title">Locais da organização</h2><p className="section-subtitle">Capacidade e localização configuradas para esta operação.</p></div><button className="link-button" onClick={() => setActiveNav("Locais")}>Ver locais <ArrowRight size={13}/></button></div>
          <SiteList sites={sites}/>
        </> : activeNav === "Locais" ? <div className="site-management">
          <section className="panel site-list-panel"><div className="panel-heading"><div><h2 className="panel-title">Locais cadastrados</h2><div className="panel-kicker">{sites.length} local(is) em {organization.name}</div></div><MapPin size={17}/></div><SiteList sites={sites}/></section>
          {canManageSites ? <section className="panel site-create-panel"><div className="panel-heading"><div><h2 className="panel-title">Adicionar local</h2><div className="panel-kicker">Cadastre os dados elétricos e de localização.</div></div></div><SiteForm organizationId={organization.id}/></section> : <section className="panel site-create-panel"><h2 className="panel-title">Cadastro restrito</h2><p className="panel-kicker">Peça a um owner ou admin para cadastrar locais nesta organização.</p></section>}
        </div> : <div className="site-management">
          <section className="panel site-list-panel"><div className="panel-heading"><div><h2 className="panel-title">Carregadores cadastrados</h2><div className="panel-kicker">{chargers.length} equipamento(s) vinculados à organização</div></div><PlugZap size={17}/></div><ChargerList chargers={chargers} siteNames={siteNames}/></section>
          {canManageChargers ? <section className="panel site-create-panel"><div className="panel-heading"><div><h2 className="panel-title">Provisionar carregador</h2><div className="panel-kicker">Crie uma credencial individual para autenticação OCPP.</div></div></div><ChargerForm organizationId={organization.id} sites={sites}/></section> : <section className="panel site-create-panel"><h2 className="panel-title">Cadastro restrito</h2><p className="panel-kicker">Peça a um owner, admin ou technician para cadastrar carregadores.</p></section>}
        </div>}
        <p className="footnote">Os indicadores refletem os registros atuais. Atualize a página para buscar os dados mais recentes.</p>
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Navegação móvel"><button className={activeNav === "Visão geral" ? "active" : ""} onClick={() => setActiveNav("Visão geral")}><LayoutDashboard/>Início</button><button className={activeNav === "Locais" ? "active" : ""} onClick={() => setActiveNav("Locais")}><MapPin/>Locais</button><button className={activeNav === "Carregadores" ? "active" : ""} onClick={() => setActiveNav("Carregadores")}><PlugZap/>Carregadores</button></nav>
  </div>;
}

function SiteList({ sites }: { sites: Site[] }) {
  if (!sites.length) return <div className="site-empty"><MapPin size={17}/><strong>Nenhum local cadastrado</strong><span>Adicione um local para começar a organizar sua infraestrutura.</span></div>;
  return <div className="site-list">{sites.map((site) => <article className="panel site-row" key={site.id}><div className="site-row-icon"><MapPin size={16}/></div><div className="site-row-main"><strong>{site.name}</strong><span>{site.address || "Endereço não informado"}</span></div><div className="site-row-meta"><span>Capacidade</span><strong>{site.max_power_kw ? `${Number(site.max_power_kw).toLocaleString("pt-BR")} kW` : "Não definida"}</strong></div><div className="site-row-meta"><span>Fuso horário</span><strong>{site.timezone}</strong></div></article>)}</div>;
}

function ChargerList({ chargers, siteNames }: { chargers: Charger[]; siteNames: Map<string, string> }) {
  if (!chargers.length) return <div className="site-empty"><PlugZap size={17}/><strong>Nenhum carregador cadastrado</strong><span>Cadastre o equipamento para criar sua credencial de conexão OCPP.</span></div>;
  return <div className="site-list">{chargers.map((charger) => <article className="panel site-row" key={charger.id}><div className="site-row-icon"><PlugZap size={16}/></div><div className="site-row-main"><strong>{charger.charge_point_id}</strong><span>{[charger.vendor, charger.model].filter(Boolean).join(" · ") || "Fabricante e modelo não informados"} · {siteNames.get(charger.site_id) ?? "Local indisponível"}</span></div><span className={`status-badge ${charger.online ? "active" : "available"}`}><i className="status-dot"/>{charger.online ? charger.status : "Offline"}</span><div className="site-row-meta"><span>Potência máx.</span><strong>{charger.max_power_kw ? `${Number(charger.max_power_kw).toLocaleString("pt-BR")} kW` : "Não definida"}</strong></div><div className="site-row-meta"><span>Último heartbeat</span><strong>{charger.last_heartbeat_at ? new Date(charger.last_heartbeat_at).toLocaleString("pt-BR") : "Ainda sem conexão"}</strong></div></article>)}</div>;
}
