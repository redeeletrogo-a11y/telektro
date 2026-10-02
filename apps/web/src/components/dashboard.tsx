"use client";

import "./dashboard-theme.css";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ResidentsPanel, type Invite, type Resident } from "@/components/residents-panel";
import { Activity, ArrowRight, Building2, Check, Clock3, Copy, LayoutDashboard, MapPin, Play, PlugZap, RotateCcw, Square, Trash2, Users, Zap } from "lucide-react";
import { createSite, registerCharger, registerRfidAuthorization, removeCharger, requestGetConfiguration, requestRemoteStart, requestRemoteStop, restoreCharger, rotateChargerCredential, revokeRfidAuthorization, signOut, type FormState } from "@/app/workspace-actions";

type Organization = { id: string; name: string; slug: string; account_type?: string; resident_limit?: number | null };
type Site = { id: string; name: string; address: string | null; timezone: string; max_power_kw: number | null };
type Charger = { id: string; site_id: string; charge_point_id: string; vendor: string | null; model: string | null; firmware: string | null; model_code: string | null; serial_number: string | null; connector_type: string | null; connector_count: number | null; installation_power_kw: number | null; ocpp_version: string | null; technical_specs: Record<string, unknown>; capabilities: Record<string, unknown>; max_power_kw: number | null; status: string; online: boolean; last_heartbeat_at: string | null; last_boot_at: string | null; last_status_notification_at: string | null; last_transaction_at: string | null; last_transaction_id: number | null; last_ocpp_error: string | null; removed_at: string | null; removed_by: string | null };
type ConnectorInfo = { id: string; organization_id: string; charger_id: string; connector_id: number; status: string; updated_at: string };
type ChargerAuthorization = { id: string; charger_id: string; id_tag_hash: string; authorization_type: string; enabled: boolean; created_at: string };
type ActiveSession = { id: string; charger_id: string; connector_id: number | null; started_at: string | null; start_meter_wh: number | null; ocpp_transaction_id: number | null; authorization_type: string | null; authorized_user_id: string | null };
type CompletedSession = ActiveSession & { ended_at: string | null; end_meter_wh: number | null };
type MeterReading = { session_id: string | null; measurand: string; value: number; unit: string | null; sampled_at: string; requires_review: boolean; review_reason: string | null };
type CommandRecord = { id: string; charger_id: string; action: string; status: string; requested_at: string; completed_at: string | null; result: Record<string, unknown> | null };

const initialState: FormState = {};

function ChargeArt() {
  return <svg className="charge-art" viewBox="0 0 400 200" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" fill="none">
    <defs><linearGradient id="ca-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22e0a0" stopOpacity=".9"/><stop offset="1" stopColor="#22e0a0" stopOpacity="0"/></linearGradient></defs>
    <circle cx="310" cy="95" r="110" stroke="#22e0a0" strokeOpacity=".10" strokeWidth="1.5"/>
    <circle cx="310" cy="95" r="82" stroke="#22e0a0" strokeOpacity=".16" strokeWidth="1.5"/>
    <circle cx="310" cy="95" r="54" stroke="#22e0a0" strokeOpacity=".28" strokeWidth="1.5"/>
    <path d="M326 28 L282 108 H312 L296 168 L352 80 H320 Z" fill="url(#ca-g)" stroke="#6bf5c4" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M0 160 C80 140 120 190 200 170 S340 150 400 175" stroke="#22e0a0" strokeOpacity=".25" strokeWidth="1.5"/>
  </svg>;
}

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
      <div><label htmlFor="site-timezone">Fuso horário</label><input id="site-timezone" name="timezone" list="brazil-timezones" defaultValue="America/Fortaleza" required/><datalist id="brazil-timezones"><option value="America/Fortaleza"/><option value="America/Sao_Paulo"/><option value="America/Manaus"/><option value="America/Belem"/><option value="America/Recife"/><option value="America/Rio_Branco"/></datalist></div>
    </div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <p className="form-success" role="status">{state.success}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "Salvando…" : "Cadastrar local"}<ArrowRight size={14}/></button>
  </form>;
}

function ChargerForm({ organizationId, sites }: { organizationId: string; sites: Site[] }) {
  const [state, action, pending] = useActionState(registerCharger.bind(null, organizationId), initialState);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [profile, setProfile] = useState("manual");
  const [formValues, setFormValues] = useState({ vendor: "", model: "", modelCode: "", catalogCode: "", serialNumber: "", maxPower: "", installationPower: "", connectorType: "", connectorCount: "1", ocppVersion: "1.6J", voltage: "", phases: "", networkInterfaces: [] as string[], otherNetwork: "", hasRfid: "", hasMeter: "", hasDisplay: "", authorizationMode: "" });
  const gatewayBaseUrl = (process.env.NEXT_PUBLIC_OCPP_GATEWAY_BASE_URL ?? (process.env.NODE_ENV === "production" ? "wss://telektro-ocpp-gateway.fly.dev" : "ws://localhost:9000")).replace(/\/+$/, "");
  const serverUrl = gatewayBaseUrl ? `${gatewayBaseUrl}/ocpp` : null;
  const connectionUrl = gatewayBaseUrl && state.chargePointId ? `${gatewayBaseUrl}/ocpp/${state.chargePointId}` : null;
  function chooseProfile(value: string) {
    setProfile(value);
    if (value === "byd-dolphin-ac") setFormValues((current) => ({
      ...current,
      vendor: "",
      model: "Wallbox AC Tipo 2 (veículo BYD Dolphin)",
      modelCode: "",
      catalogCode: "",
      maxPower: "",
      connectorType: "Tipo 2 (AC)",
      connectorCount: "1",
      ocppVersion: "unknown",
      voltage: "",
      phases: "",
      networkInterfaces: [],
      hasRfid: "",
      hasMeter: "",
      hasDisplay: "",
      authorizationMode: "",
    }));
    if (value === "weg-wemob-parking-g2") setFormValues((current) => ({
      ...current,
      vendor: "WEG",
      model: "WEMOB PARKING Geração 2",
      modelCode: "WEMOB-P-023-W-R-1T2",
      catalogCode: "15846064",
      connectorType: "Tipo 2 com cabo",
      connectorCount: "1",
      maxPower: "22",
      ocppVersion: "1.6J",
      voltage: "127/220 V ou 220/380 V",
      phases: "Monofásica, bifásica ou trifásica",
      networkInterfaces: ["Wi-Fi", "4G", "Ethernet"],
      hasRfid: "yes",
      hasMeter: "yes",
      hasDisplay: "no",
    }));
  }
  function setValue(key: "vendor" | "model" | "modelCode" | "catalogCode" | "serialNumber" | "maxPower" | "installationPower" | "connectorType" | "connectorCount" | "ocppVersion" | "voltage" | "phases" | "otherNetwork" | "hasRfid" | "hasMeter" | "hasDisplay" | "authorizationMode", value: string) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }
  async function copyCredential(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopyFeedback(`${label} copiado para a área de transferência.`); }
    catch { setCopyFeedback("Selecione e copie a credencial manualmente."); }
  }
  if (!sites.length) return <div className="site-empty charger-form-empty"><MapPin size={17}/><strong>Cadastre um local primeiro</strong><span>O carregador precisa pertencer a um local da organização.</span></div>;

  return <form action={action} className="site-form">
    <label htmlFor="charger-profile">Modelo de referência <span>opcional · você pode cadastrar outras marcas</span></label>
    <select id="charger-profile" value={profile} onChange={(event) => chooseProfile(event.currentTarget.value)}><option value="manual">Outro modelo — preencher dados</option><option value="weg-wemob-parking-g2">WEG WEMOB-P-023-W-R-1T2 · Parking Geração 2</option><option value="byd-dolphin-ac">BYD Dolphin · wallbox AC Tipo 2 (modelo a confirmar)</option></select>
    <p className="form-help">O perfil só preenche os campos conhecidos. O cadastro aceita qualquer fabricante; para conectar, o equipamento precisa usar OCPP 1.6J, compatível com o gateway atual.</p>
    <div className="site-form-row">
      <div><label htmlFor="charger-id">ID OCPP / Charge Box ID</label><input id="charger-id" name="charge_point_id" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={64} placeholder="Copie o ID configurado no carregador" required/><small className="form-help">Use exatamente o mesmo ID, respeitando maiúsculas e minúsculas.</small></div>
      <div><label htmlFor="charger-site">Local</label><select id="charger-site" name="site_id" defaultValue="" required><option value="" disabled>Selecione um local</option>{sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></div>
    </div>
    <div className="site-form-row">
      <div><label htmlFor="charger-vendor">Fabricante <span>opcional</span></label><input id="charger-vendor" name="vendor" value={formValues.vendor} onChange={(event) => setValue("vendor", event.currentTarget.value)} maxLength={50} placeholder="Ex.: WEG, ABB, Schneider"/></div>
      <div><label htmlFor="charger-model">Modelo comercial <span>opcional</span></label><input id="charger-model" name="model" value={formValues.model} onChange={(event) => setValue("model", event.currentTarget.value)} maxLength={80} placeholder="Nome da linha ou modelo"/></div>
    </div>
    <div className="site-form-row">
      <div><label htmlFor="charger-model-code">Código do modelo <span>opcional</span></label><input id="charger-model-code" name="model_code" value={formValues.modelCode} onChange={(event) => setValue("modelCode", event.currentTarget.value)} maxLength={80} placeholder="Ex.: WEMOB-P-023-W-R-1T2"/></div>
      <div><label htmlFor="charger-catalog-code">Código do produto <span>opcional</span></label><input id="charger-catalog-code" name="catalog_code" value={formValues.catalogCode} onChange={(event) => setValue("catalogCode", event.currentTarget.value)} maxLength={80} placeholder="Código comercial do fabricante"/></div>
    </div>
    <div className="site-form-row">
      <div><label htmlFor="charger-serial">Número de série <span>opcional</span></label><input id="charger-serial" name="serial_number" value={formValues.serialNumber} onChange={(event) => setValue("serialNumber", event.currentTarget.value)} maxLength={100} placeholder="Identificação na etiqueta"/></div>
      <div><label htmlFor="charger-protocol">Versão OCPP</label><select id="charger-protocol" name="ocpp_version" value={formValues.ocppVersion} onChange={(event) => setValue("ocppVersion", event.currentTarget.value)}><option value="1.6J">OCPP 1.6J / JSON</option><option value="2.0.1">OCPP 2.0.1</option><option value="other">Outra versão</option><option value="unknown">Não informado</option></select></div>
    </div>
    <div className="site-form-row">
      <div><label htmlFor="charger-power">Potência máxima do modelo <span>kW · opcional</span></label><input id="charger-power" name="max_power_kw" value={formValues.maxPower} onChange={(event) => setValue("maxPower", event.currentTarget.value)} type="number" min="0.001" step="0.001" placeholder="Ex.: 22"/></div>
      <div><label htmlFor="charger-installed-power">Limite configurado na instalação <span>kW · opcional</span></label><input id="charger-installed-power" name="installation_power_kw" value={formValues.installationPower} onChange={(event) => setValue("installationPower", event.currentTarget.value)} type="number" min="0.001" step="0.001" placeholder="Confirme a alimentação elétrica"/></div>
    </div>
    {profile === "weg-wemob-parking-g2" && <p className="form-help profile-note">Neste WEG, 22 kW é a potência máxima do modelo. A instalação pode entregar 4,06 kW (127 V), 7,04 kW (220 V mono/bifásico), 12,19 kW (220 V trifásico) ou 21,06 kW (380 V trifásico), conforme a rede local.</p>}
    {profile === "byd-dolphin-ac" && <p className="form-help profile-note">O Dolphin é o veículo; o Telektro conecta à wallbox. O perfil informa apenas o conector Tipo 2 AC e deixa fabricante, potência e protocolo em aberto para confirmar pela etiqueta/manual. A ficha comercial consultada da BYD/E-Wolf EW1005 não lista OCPP; para conectar, confirme que a estação real suporta OCPP 1.6J e configure nela o endpoint, Charge Point ID e credencial exibidos após o cadastro.</p>}
    <div className="site-form-row">
      <div><label htmlFor="charger-connector">Tipo de conector <span>opcional</span></label><input id="charger-connector" name="connector_type" value={formValues.connectorType} onChange={(event) => setValue("connectorType", event.currentTarget.value)} maxLength={80} placeholder="Ex.: Tipo 2, CCS2, NACS"/></div>
      <div><label htmlFor="charger-connectors">Quantidade de conectores <span>opcional</span></label><input id="charger-connectors" name="connector_count" value={formValues.connectorCount} onChange={(event) => setValue("connectorCount", event.currentTarget.value)} type="number" min="1" max="64" step="1"/></div>
    </div>
    <div className="site-form-row">
      <div><label htmlFor="charger-voltage">Tensão de alimentação <span>opcional · informativa</span></label><input id="charger-voltage" name="nominal_voltage" value={formValues.voltage} onChange={(event) => setValue("voltage", event.currentTarget.value)} maxLength={120} placeholder="Ex.: 220/380 V"/></div>
      <div><label htmlFor="charger-phases">Tipo de alimentação <span>opcional</span></label><input id="charger-phases" name="electrical_phases" value={formValues.phases} onChange={(event) => setValue("phases", event.currentTarget.value)} maxLength={80} placeholder="Ex.: monofásica ou trifásica"/></div>
    </div>
    <fieldset className="charger-options"><legend>Recursos e conectividade <span>opcionais</span></legend>
      <div className="charger-network-options">{["Wi-Fi", "4G", "Ethernet"].map((network) => <label key={network}><input type="checkbox" name="network_interfaces" value={network} checked={formValues.networkInterfaces.includes(network)} onChange={(event) => setFormValues((current) => ({ ...current, networkInterfaces: event.currentTarget.checked ? [...new Set([...current.networkInterfaces, network])] : current.networkInterfaces.filter((item) => item !== network) }))}/>{network}</label>)}</div>
      <div><label htmlFor="charger-other-network">Outras interfaces <span>opcional · separe por vírgula</span></label><input id="charger-other-network" name="other_network_interfaces" value={formValues.otherNetwork} onChange={(event) => setValue("otherNetwork", event.currentTarget.value)} maxLength={160} placeholder="Ex.: LTE-M, Bluetooth, RS-485"/></div>
      <div className="site-form-row">
        <div><label htmlFor="charger-rfid">RFID integrado</label><select id="charger-rfid" name="has_rfid" value={formValues.hasRfid} onChange={(event) => setValue("hasRfid", event.currentTarget.value)}><option value="">Não informado</option><option value="yes">Sim</option><option value="no">Não</option></select></div>
        <div><label htmlFor="charger-meter">Medição de energia</label><select id="charger-meter" name="has_energy_meter" value={formValues.hasMeter} onChange={(event) => setValue("hasMeter", event.currentTarget.value)}><option value="">Não informado</option><option value="yes">Sim</option><option value="no">Não</option></select></div>
      </div>
      <div className="site-form-row">
        <div><label htmlFor="charger-display">Display</label><select id="charger-display" name="has_display" value={formValues.hasDisplay} onChange={(event) => setValue("hasDisplay", event.currentTarget.value)}><option value="">Não informado</option><option value="yes">Sim</option><option value="no">Não</option></select></div>
        <div><label htmlFor="charger-auth-mode">Autorização configurada</label><select id="charger-auth-mode" name="authorization_mode" value={formValues.authorizationMode} onChange={(event) => setValue("authorizationMode", event.currentTarget.value)}><option value="">Não informado</option><option value="ocpp_server">Servidor OCPP</option><option value="local_list">Lista local/RFID</option><option value="always_authorized">Sempre autorizado</option><option value="other">Outra configuração</option></select></div>
      </div>
    </fieldset>
    {(formValues.ocppVersion !== "1.6J" && formValues.ocppVersion !== "unknown") && <p className="form-help profile-note">O cadastro aceita esse equipamento para inventário, mas o gateway Telektro atual conecta somente carregadores OCPP 1.6J.</p>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.credential && <div className="credential-reveal"><strong>Credencial criada — copie agora</strong>{serverUrl && <span>Server URL base: <code>{serverUrl}</code><button className="credential-copy" type="button" onClick={() => void copyCredential(serverUrl, "Server URL base")}>{copyFeedback.startsWith("Server URL base") ? <Check size={12}/> : <Copy size={12}/>}Copiar</button></span>}{connectionUrl ? <span>Endpoint completo: <code>{connectionUrl}</code><button className="credential-copy" type="button" onClick={() => void copyCredential(connectionUrl, "Endpoint completo")}>{copyFeedback.startsWith("Endpoint completo") ? <Check size={12}/> : <Copy size={12}/>}Copiar</button></span> : <small>O endereço público do gateway OCPP ainda não foi configurado neste ambiente.</small>}<span>ID OCPP / usuário: <code>{state.chargePointId}</code><button className="credential-copy" type="button" onClick={() => void copyCredential(state.chargePointId ?? "", "Usuário")}>{copyFeedback.startsWith("Usuário") ? <Check size={12}/> : <Copy size={12}/>}Copiar</button></span><span>Senha: <code>{state.credential}</code><button className="credential-copy" type="button" onClick={() => void copyCredential(state.credential ?? "", "Senha")}>{copyFeedback.startsWith("Senha") ? <Check size={12}/> : <Copy size={12}/>}Copiar</button></span>{copyFeedback && <small role="status">{copyFeedback}</small>}<small>O WEMOB separa Server URL e Charge Box ID; outros equipamentos podem pedir o endpoint completo. Siga o formato do manual do modelo. A senha tem 40 caracteres hexadecimais. O Telektro guarda somente o hash e não a exibe novamente.</small></div>}
    <button className="primary-button" disabled={pending}>{pending ? "Cadastrando…" : "Cadastrar carregador"}<ArrowRight size={14}/></button>
  </form>;
}

export function Dashboard({
  email, organizations, organization, role, accountType, trialDaysLeft, residents, invites, sites, chargers, removedChargers, connectors, authorizations, capacityKw, totalChargers, onlineChargers, activeSessions, sessionRows, completedSessionRows, meterReadings, commandRows, dataLoadedAt,
}: {
  email: string;
  organizations: Organization[];
  organization: Organization;
  role: string;
  accountType: string;
  trialDaysLeft: number | null;
  residents: Resident[];
  invites: Invite[];
  sites: Site[];
  chargers: Charger[];
  removedChargers: Charger[];
  connectors: ConnectorInfo[];
  authorizations: ChargerAuthorization[];
  capacityKw: number;
  totalChargers: number;
  onlineChargers: number;
  activeSessions: number;
  sessionRows: ActiveSession[];
  completedSessionRows: CompletedSession[];
  meterReadings: MeterReading[];
  commandRows: CommandRecord[];
  dataLoadedAt: string;
}) {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("Visão geral");
  const [clockNow, setClockNow] = useState(0);
  useEffect(() => {
    const initialTick = window.setTimeout(() => setClockNow(Date.now()), 0);
    const clockTimer = window.setInterval(() => setClockNow(Date.now()), 5_000);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [router]);
  const canManageSites = role === "owner" || role === "admin";
  const canManageChargers = role === "owner" || role === "admin" || role === "technician";
  const canControlChargers = role === "owner" || role === "admin" || role === "operator" || role === "technician";
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  const stats = [
    { label: "Locais", value: sites.length, detail: "cadastrados na organização", icon: MapPin },
    { label: "Carregadores", value: totalChargers, detail: `${onlineChargers} online`, icon: PlugZap },
    { label: "Sessões ativas", value: activeSessions, detail: "em andamento", icon: Activity },
    { label: "Limite dos locais", value: `${capacityKw.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kW`, detail: "soma dos limites elétricos cadastrados", icon: Zap },
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand/>
      <div className="nav-label">Operação</div>
      <nav className="nav-list" aria-label="Navegação principal">
        <button className={`nav-item ${activeNav === "Visão geral" ? "active" : ""}`} onClick={() => setActiveNav("Visão geral")}><LayoutDashboard size={16}/>Visão geral</button>
        <button className={`nav-item ${activeNav === "Locais" ? "active" : ""}`} onClick={() => setActiveNav("Locais")}><MapPin size={16}/>Locais<span className="nav-count">{sites.length}</span></button>
        <button className={`nav-item ${activeNav === "Carregadores" ? "active" : ""}`} onClick={() => setActiveNav("Carregadores")}><PlugZap size={16}/>Carregadores<span className="nav-count">{chargers.length}</span></button>
        <button className={`nav-item ${activeNav === "Sessões" ? "active" : ""}`} onClick={() => setActiveNav("Sessões")}><Activity size={16}/>Sessões<span className="nav-count">{activeSessions}</span></button>
        <button className={`nav-item ${activeNav === "Energia" ? "active" : ""}`} onClick={() => setActiveNav("Energia")}><Zap size={16}/>Energia</button>
        {accountType === "condominio" && canManageSites ? <button className={`nav-item ${activeNav === "Moradores" ? "active" : ""}`} onClick={() => setActiveNav("Moradores")}><Users size={16}/>Moradores<span className="nav-count">{residents.length}</span></button> : <button className="nav-item nav-item-disabled" disabled title="Disponível em uma próxima etapa"><Users size={16}/>Usuários</button>}
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
        {trialDaysLeft !== null && <div className="trial-banner" role="status">Teste grátis: {trialDaysLeft} dia(s) restante(s). Depois, plano Residencial R$ 19,90/mês.</div>}
        <div className="dash-hello"><h1>{activeNav === "Visão geral" ? organization.name : activeNav}</h1><span className="role-chip">{role}</span></div>

        {activeNav === "Visão geral" ? <>
          <div className="workspace-stats" aria-label="Resumo da organização">
            {stats.filter((item) => item.label !== "Limite dos locais").map(({ label, value, detail, icon: Icon }) => <article className="panel workspace-stat" key={label}><div className="workspace-stat-top"><span>{label}</span><Icon size={16}/></div><strong>{value}</strong><small>{detail}</small></article>)}
          </div>
          <SiteDemand sites={sites} chargers={chargers} sessions={sessionRows} meterReadings={meterReadings} now={clockNow}/>
          <section className="charge-hero"><ChargeArt/><h2>{totalChargers ? "Carregadores cadastrados" : sites.length ? "Cadastre um carregador para conectar" : "Cadastre um local antes de conectar carregadores"}</h2><p>{totalChargers ? `${totalChargers} carregador(es) cadastrado(s); ${onlineChargers} online no último estado recebido do gateway.` : sites.length ? `${sites.length} local(is) já cadastrado(s). Agora você pode provisionar um carregador OCPP 1.6J.` : "Os locais guardam endereço, fuso horário e limite elétrico. Depois deles, você poderá cadastrar e provisionar carregadores OCPP 1.6J."}</p><button className="primary-button" onClick={() => setActiveNav(sites.length ? "Carregadores" : "Locais")}>{sites.length ? "Cadastrar carregador" : "Cadastrar primeiro local"}<ArrowRight size={14}/></button></section>
          <div className="section-row"><div><h2 className="section-title">Locais da organização</h2><p className="section-subtitle">Capacidade e localização configuradas para esta operação.</p></div><button className="link-button" onClick={() => setActiveNav("Locais")}>Ver locais <ArrowRight size={13}/></button></div>
          <SiteList sites={sites}/>
        </> : activeNav === "Moradores" ? <ResidentsPanel organizationId={organization.id} residents={residents} invites={invites} residentLimit={organization.resident_limit ?? null}/> : activeNav === "Energia" ? <SiteDemand sites={sites} chargers={chargers} sessions={sessionRows} meterReadings={meterReadings} now={clockNow} expanded/> : activeNav === "Locais" ? <div className="site-management">
          <section className="panel site-list-panel"><div className="panel-heading"><div><h2 className="panel-title">Locais cadastrados</h2><div className="panel-kicker">{sites.length} local(is) em {organization.name}</div></div><MapPin size={17}/></div><SiteList sites={sites}/></section>
          {canManageSites ? <section className="panel site-create-panel"><div className="panel-heading"><div><h2 className="panel-title">Adicionar local</h2><div className="panel-kicker">Cadastre os dados elétricos e de localização.</div></div></div><SiteForm organizationId={organization.id}/></section> : <section className="panel site-create-panel"><h2 className="panel-title">Cadastro restrito</h2><p className="panel-kicker">Peça a um owner ou admin para cadastrar locais nesta organização.</p></section>}
        </div> : activeNav === "Carregadores" ? <div className="site-management charger-management">
          <section className="charge-hero charge-banner"><ChargeArt/><h2>{onlineChargers ? `${onlineChargers} carregador(es) online` : "Pronto para carregar"}</h2><p>{activeSessions ? `${activeSessions} recarga(s) em andamento` : "Toque em iniciar no carregador desejado."}</p></section>
          <section className="panel site-list-panel"><div className="panel-heading"><div><h2 className="panel-title">Carregadores cadastrados</h2><div className="panel-kicker">{chargers.length} equipamento(s) ativos nesta organização</div></div><PlugZap size={17}/></div><ChargerList chargers={chargers} removedChargers={removedChargers} connectors={connectors} authorizations={authorizations} siteNames={siteNames} organizationId={organization.id} canControl={canControlChargers} canManage={canManageChargers} isOwner={role === "owner"} activeSessionChargerIds={new Set(sessionRows.map((session) => session.charger_id))} now={clockNow}/></section>
          {canManageChargers ? <section className="panel site-create-panel"><div className="panel-heading"><div><h2 className="panel-title">Provisionar carregador</h2><div className="panel-kicker">Crie uma credencial individual para autenticação OCPP.</div></div></div><ChargerForm organizationId={organization.id} sites={sites}/></section> : <section className="panel site-create-panel"><h2 className="panel-title">Cadastro restrito</h2><p className="panel-kicker">Peça a um owner, admin ou technician para cadastrar carregadores.</p></section>}
        </div> : <SessionList sessions={sessionRows} completedSessions={completedSessionRows} meterReadings={meterReadings} chargers={[...chargers, ...removedChargers]} siteNames={siteNames} now={clockNow}
          organizationId={organization.id} canControl={canControlChargers} commands={commandRows}/>}
        <p className="footnote">Dados atualizados automaticamente a cada 20 s enquanto a página está aberta. Última consulta: {clockNow ? new Date(dataLoadedAt).toLocaleTimeString("pt-BR") : "carregando"}. Leituras OCPP podem chegar com atraso.</p>
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Navegação móvel"><button className={activeNav === "Visão geral" ? "active" : ""} onClick={() => setActiveNav("Visão geral")}><LayoutDashboard/>Início</button><button className={activeNav === "Locais" ? "active" : ""} onClick={() => setActiveNav("Locais")}><MapPin/>Locais</button><button className={activeNav === "Carregadores" ? "active" : ""} onClick={() => setActiveNav("Carregadores")}><PlugZap/>Carregadores</button><button className={activeNav === "Sessões" ? "active" : ""} onClick={() => setActiveNav("Sessões")}><Activity/>Sessões</button></nav>
  </div>;
}

function SiteDemand({ sites, chargers, sessions, meterReadings, now, expanded = false }: {
  sites: Site[];
  chargers: Charger[];
  sessions: ActiveSession[];
  meterReadings: MeterReading[];
  now: number;
  expanded?: boolean;
}) {
  const chargerById = new Map(chargers.map((charger) => [charger.id, charger]));
  const latestPowerBySession = new Map<string, MeterReading>();
  for (const reading of meterReadings) {
    if (reading.session_id && reading.measurand === "Power.Active.Import" && !latestPowerBySession.has(reading.session_id)) {
      latestPowerBySession.set(reading.session_id, reading);
    }
  }
  const activeBySite = new Map<string, ActiveSession[]>();
  for (const session of sessions) {
    const siteId = chargerById.get(session.charger_id)?.site_id;
    if (!siteId) continue;
    activeBySite.set(siteId, [...(activeBySite.get(siteId) ?? []), session]);
  }

  return <section className={`panel demand-panel ${expanded ? "demand-panel-expanded" : ""}`}>
    <div className="panel-heading"><div><h2 className="panel-title">Demanda das recargas por local</h2><div className="panel-kicker">Potência recebida das sessões ativas · leituras atualizadas automaticamente</div></div><Zap size={17}/></div>
    {!sites.length ? <div className="session-empty-inline">Cadastre um local para acompanhar as medições das recargas.</div> : <div className="demand-list">{sites.map((site) => {
      const siteSessions = activeBySite.get(site.id) ?? [];
      let totalKw = 0;
      let measuredCount = 0;
      let newestAt = 0;
      for (const session of siteSessions) {
        const reading = latestPowerBySession.get(session.id);
        const unit = reading?.unit?.toLowerCase();
        const sampledAt = reading ? new Date(reading.sampled_at).getTime() : 0;
        const ageMs = now - sampledAt;
        const readingKw = reading && (unit === "w" || unit === "kw") ? Number(reading.value) * (unit === "w" ? 0.001 : 1) : null;
        if (readingKw !== null && Number.isFinite(readingKw) && readingKw >= 0 && ageMs >= 0 && ageMs <= 5 * 60_000) {
          totalKw += readingKw;
          measuredCount += 1;
          newestAt = Math.max(newestAt, sampledAt);
        }
      }
      const limitKw = site.max_power_kw === null ? null : Number(site.max_power_kw);
      const percent = limitKw && limitKw > 0 ? (totalKw / limitKw) * 100 : null;
      const exceeded = percent !== null && percent > 100;
      const nearLimit = percent !== null && percent >= 80 && !exceeded;
      const incomplete = measuredCount < siteSessions.length;
      const state = exceeded ? "exceeded" : nearLimit ? "near" : incomplete ? "incomplete" : "normal";
      const status = exceeded ? "Acima do limite configurado" : nearLimit ? "Próximo do limite configurado" : incomplete ? "Aguardando medições recentes" : siteSessions.length ? "Medições atuais" : "Sem recargas ativas";
      const shownKw = totalKw.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
      return <article className="demand-row" key={site.id}>
        <div className="demand-row-top"><div><strong>{site.name}</strong><span>{siteSessions.length} recarga(s) ativa(s) · {measuredCount}/{siteSessions.length} com medição recente</span></div><div className="demand-reading"><strong>{shownKw} kW</strong><span>{limitKw ? `limite ${limitKw.toLocaleString("pt-BR")} kW` : "limite não configurado"}</span></div></div>
        {limitKw !== null && limitKw > 0 && <div className="demand-meter" role="meter" aria-label={`Potência medida em relação ao limite configurado em ${site.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, percent ?? 0))}><span className={state} style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}/></div>}
        <div className={`demand-status ${state}`}><i className="status-dot"/>{status}{percent !== null && <span>{percent.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%</span>}{newestAt > 0 && <small>Leitura {new Date(newestAt).toLocaleTimeString("pt-BR")}</small>}</div>
      </article>;
    })}</div>}
    <p className="demand-disclaimer">Este total soma somente a potência reportada pelos carregadores. Ele não mede outras cargas do imóvel e não substitui um medidor geral; limites e alertas são informativos e ainda não fazem balanceamento automático.</p>
  </section>;
}

function SiteList({ sites }: { sites: Site[] }) {
  if (!sites.length) return <div className="site-empty"><MapPin size={17}/><strong>Nenhum local cadastrado</strong><span>Adicione um local para começar a organizar sua infraestrutura.</span></div>;
  return <div className="site-list">{sites.map((site) => <article className="panel site-row" key={site.id}><div className="site-row-icon"><MapPin size={16}/></div><div className="site-row-main"><strong>{site.name}</strong><span>{site.address || "Endereço não informado"}</span></div><div className="site-row-meta"><span>Capacidade</span><strong>{site.max_power_kw ? `${Number(site.max_power_kw).toLocaleString("pt-BR")} kW` : "Não definida"}</strong></div><div className="site-row-meta"><span>Fuso horário</span><strong>{site.timezone}</strong></div></article>)}</div>;
}

function ChargerList({ chargers, removedChargers, connectors, authorizations, siteNames, organizationId, canControl, canManage, isOwner, activeSessionChargerIds, now }: { chargers: Charger[]; removedChargers: Charger[]; connectors: ConnectorInfo[]; authorizations: ChargerAuthorization[]; siteNames: Map<string, string>; organizationId: string; canControl: boolean; canManage: boolean; isOwner: boolean; activeSessionChargerIds: Set<string>; now: number }) {
  const [showRemoved, setShowRemoved] = useState(false);
  return <><div className="charger-tabs" role="tablist" aria-label="Situação dos carregadores">
    <button type="button" role="tab" aria-selected={!showRemoved} className={!showRemoved ? "active" : ""} onClick={() => setShowRemoved(false)}>Ativos <span>{chargers.length}</span></button>
    <button type="button" role="tab" aria-selected={showRemoved} className={showRemoved ? "active" : ""} onClick={() => setShowRemoved(true)}>Removidos <span>{removedChargers.length}</span></button>
  </div>{showRemoved ? <RemovedChargerList chargers={removedChargers} siteNames={siteNames} organizationId={organizationId} isOwner={isOwner} now={now}/> : !chargers.length ? <div className="site-empty"><PlugZap size={17}/><strong>Nenhum carregador cadastrado</strong><span>Cadastre o equipamento para criar sua credencial de conexão OCPP.</span></div> : <div className="site-list">{chargers.map((charger) => {
    const specs = charger.technical_specs ?? {};
    const networks = Array.isArray(specs.network_interfaces) ? specs.network_interfaces.filter((value): value is string => typeof value === "string") : [];
    const profileDetails = [
      charger.model_code ? `Código ${charger.model_code}` : null,
      charger.connector_count ? `${charger.connector_count} conector(es)${charger.connector_type ? ` · ${charger.connector_type}` : ""}` : charger.connector_type,
      charger.ocpp_version ? charger.ocpp_version === "unknown" ? "OCPP não informado" : `OCPP ${charger.ocpp_version}` : null,
      networks.length ? networks.join(" / ") : null,
      specs.has_rfid === true ? "RFID" : null,
      specs.has_energy_meter === true ? "Medição de energia" : null,
    ].filter(Boolean).join(" · ");
    const compatibilityPending = Boolean(charger.ocpp_version && !["1.6J", "unknown"].includes(charger.ocpp_version));
    const chargerConnectors = connectors.filter((connector) => connector.charger_id === charger.id);
    const remoteStart = capabilityLabel(charger.capabilities?.remoteStart);
    const remoteStop = capabilityLabel(charger.capabilities?.remoteStop);
    const rfidCapability = capabilityLabel(charger.capabilities?.rfid);
    const remoteAuthorization = charger.capabilities?.authorizeRemoteTxRequests as { state?: string; value?: string | null } | undefined;
    return <article className="panel site-row charger-row" key={charger.id}>
      <div className="site-row-icon"><PlugZap size={16}/></div>
      <div className="site-row-main"><strong>{charger.charge_point_id}</strong><span>{siteNames.get(charger.site_id) ?? "Local indisponível"}</span></div>
      <span className={`status-badge ${charger.online ? "active" : "available"}`}><i className="status-dot"/>{charger.online ? charger.status : "Offline"}</span>
      {compatibilityPending && <span className="status-badge attention">Protocolo ainda não suportado</span>}
      {canControl && <ChargerControl charger={charger} connectors={chargerConnectors} organizationId={organizationId}/>}
      <details className="charger-more"><summary>Detalhes e configuração</summary>
      {profileDetails && <small className="charger-profile-details">{[charger.vendor, charger.model].filter(Boolean).join(" · ")}{[charger.vendor, charger.model].filter(Boolean).length ? " · " : ""}{profileDetails}</small>}
      <div className="site-row-meta"><span>Potência máx. do modelo</span><strong>{charger.max_power_kw ? `${Number(charger.max_power_kw).toLocaleString("pt-BR")} kW` : "Não definida"}</strong></div>
      <div className="site-row-meta"><span>Limite da instalação</span><strong>{charger.installation_power_kw ? `${Number(charger.installation_power_kw).toLocaleString("pt-BR")} kW` : "Não informado"}</strong></div>
      <div className="site-row-meta"><span>Último heartbeat</span><strong>{charger.last_heartbeat_at ? new Date(charger.last_heartbeat_at).toLocaleString("pt-BR") : "Ainda sem conexão"}</strong></div>
      <div className="charger-diagnostics">
        <strong>Diagnóstico OCPP</strong>
        <span>Protocolo cadastrado: {charger.ocpp_version && charger.ocpp_version !== "unknown" ? charger.ocpp_version : "Não informado"} · Boot: {charger.last_boot_at ? new Date(charger.last_boot_at).toLocaleString("pt-BR") : "ainda não recebido"}</span>
        <span>Firmware: {charger.firmware ?? "Não informado"} · StatusNotification: {charger.last_status_notification_at ? new Date(charger.last_status_notification_at).toLocaleString("pt-BR") : "ainda não recebido"}</span>
        <span>Conectores: {chargerConnectors.length ? chargerConnectors.map((item) => `${item.connector_id}: ${item.status}`).join(" · ") : "Ainda sem status reportado"}</span>
        <span>Última transação: {charger.last_transaction_at ? `${new Date(charger.last_transaction_at).toLocaleString("pt-BR")} · ID ${charger.last_transaction_id ?? "—"}` : "ainda não recebida"}</span>
        <span>Remote Start: {remoteStart} · Remote Stop: {remoteStop} · RFID OCPP: {rfidCapability}</span>
        <span>AuthorizeRemoteTxRequests: {remoteAuthorization?.state === "SUPPORTED" ? remoteAuthorization.value === "true" ? "ativado" : "desativado" : remoteAuthorization?.state === "UNSUPPORTED" ? "não informado pelo carregador" : "não consultado"}</span>
        {charger.last_ocpp_error && <span className="form-error">Último erro OCPP: {charger.last_ocpp_error}</span>}
      </div>
      {canManage && <><ConfigurationControl charger={charger} organizationId={organizationId}/><RfidAuthorizationManager charger={charger} authorizations={authorizations.filter((item) => item.charger_id === charger.id)} organizationId={organizationId}/></>}
      {isOwner && <><ChargerCredentialControl charger={charger} organizationId={organizationId}/><ChargerRemovalControl charger={charger} organizationId={organizationId} hasActiveSession={activeSessionChargerIds.has(charger.id)}/></>}
      </details>
    </article>;
  })}</div>}</>;
}

function RemovedChargerList({ chargers, siteNames, organizationId, isOwner, now }: { chargers: Charger[]; siteNames: Map<string, string>; organizationId: string; isOwner: boolean; now: number }) {
  if (!chargers.length) return <div className="site-empty"><Trash2 size={17}/><strong>Nenhum carregador removido</strong><span>Equipamentos removidos aparecerão aqui por histórico.</span></div>;
  return <div className="site-list">{chargers.map((charger) => {
    const removedAt = charger.removed_at ? new Date(charger.removed_at) : null;
    const restoreAllowed = removedAt !== null && now > 0 && now - removedAt.getTime() <= 30 * 24 * 60 * 60 * 1000;
    return <article className="panel site-row charger-row removed-charger-row" key={charger.id}>
      <div className="site-row-icon removed-charger-icon"><Trash2 size={16}/></div>
      <div className="site-row-main"><strong>{charger.charge_point_id}</strong><span>{[charger.vendor, charger.model].filter(Boolean).join(" · ") || "Fabricante e modelo não informados"} · {siteNames.get(charger.site_id) ?? "Local indisponível"}</span>
        <small className="charger-profile-details">Carregador removido · {removedAt?.toLocaleString("pt-BR") ?? "data não informada"}{charger.removed_by ? ` · Conta ${charger.removed_by.slice(0, 8)}` : ""}</small>
      </div>
      {isOwner ? restoreAllowed ? <ChargerRestoreControl charger={charger} organizationId={organizationId} now={now}/> : <span className="restore-expired">{now > 0 ? "Prazo de restauração encerrado" : "Calculando prazo de restauração…"}</span> : <span className="restore-expired">Somente o dono pode restaurar</span>}
    </article>;
  })}</div>;
}

function capabilityLabel(value: unknown) {
  const state = value && typeof value === "object" ? (value as { state?: string }).state : undefined;
  return state === "SUPPORTED" ? "SUPPORTED" : state === "UNSUPPORTED" ? "UNSUPPORTED" : "UNKNOWN";
}

function ChargerControl({ charger, connectors, organizationId }: { charger: Charger; connectors: ConnectorInfo[]; organizationId: string }) {
  const [state, action, pending] = useActionState(requestRemoteStart.bind(null, organizationId, charger.id), initialState);
  const [confirming, setConfirming] = useState(false);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) setConfirming(false);
    wasPending.current = pending;
  }, [pending]);
  const usableConnectors = connectors.filter((item) => item.connector_id >= 1 && ["Available", "Preparing"].includes(item.status));
  return <div className="charger-control"><form action={action}>
    {charger.connector_count !== null && charger.connector_count > 1 && <label>Conector<select name="connector_id" defaultValue=""><option value="" disabled>Selecione</option>{Array.from({ length: charger.connector_count }, (_, index) => index + 1).map((id) => <option key={id} value={id}>{id}{usableConnectors.length && !usableConnectors.some((item) => item.connector_id === id) ? " · indisponível" : ""}</option>)}</select></label>}
    {charger.connector_count === 1 && <input type="hidden" name="connector_id" value="1"/>}
    <button className="secondary-button command-button" type="button" onClick={() => setConfirming(true)} disabled={!charger.online || pending || (connectors.length > 0 && usableConnectors.length === 0)}><Play size={13}/>{pending ? "Enviando…" : "Solicitar início"}</button>
    {confirming && <div className="command-confirm-backdrop"><section className="command-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="start-confirm-title" aria-describedby="start-confirm-description"><h2 id="start-confirm-title">Confirmar início da recarga?</h2><p id="start-confirm-description">O Telektro enviará um pedido ao carregador. A sessão só começa após a confirmação OCPP do equipamento.</p><div className="command-confirm-actions"><button className="secondary-button" type="button" autoFocus onClick={() => setConfirming(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={pending}>{pending ? "Enviando…" : "Confirmar início"}</button></div></section></div>}
  </form>{state.error && <small className="form-error" role="alert">{state.error}</small>}{state.success && <small className="form-success" role="status">{state.success}</small>}</div>;
}

function ChargerRemovalControl({ charger, organizationId, hasActiveSession }: { charger: Charger; organizationId: string; hasActiveSession: boolean }) {
  const [state, action, pending] = useActionState(removeCharger.bind(null, organizationId, charger.id), initialState);
  const [confirming, setConfirming] = useState(false);
  const [typedId, setTypedId] = useState("");
  const displayName = [charger.vendor, charger.model].filter(Boolean).join(" · ") || "Carregador";
  return <div className="charger-removal-control">
    <button type="button" className="remove-charger-button" onClick={() => setConfirming(true)} disabled={hasActiveSession || pending}>
      <Trash2 size={13}/>{pending ? "Removendo…" : "Remover"}
    </button>
    {hasActiveSession && <small className="remove-charger-blocked">Pare a recarga antes de remover</small>}
    {confirming && <div className="command-confirm-backdrop"><form action={action} className="command-confirm-dialog remove-charger-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`remove-charger-title-${charger.id}`} aria-describedby={`remove-charger-description-${charger.id}`}>
      <h2 id={`remove-charger-title-${charger.id}`}>Remover {displayName} ({charger.charge_point_id})?</h2>
      <p id={`remove-charger-description-${charger.id}`}>Isso desconecta e remove o equipamento. As sessões, medições e cobranças antigas serão preservadas.</p>
      <label htmlFor={`remove-charger-id-${charger.id}`}>Digite o ID OCPP <strong>{charger.charge_point_id}</strong> para confirmar</label>
      <input id={`remove-charger-id-${charger.id}`} name="confirm_charge_point_id" value={typedId} onChange={(event) => setTypedId(event.currentTarget.value)} autoComplete="off" autoFocus maxLength={64}/>
      {hasActiveSession && <small className="remove-charger-blocked">Pare a recarga antes de remover</small>}
      {state.error && <small className="form-error" role="alert">{state.error}</small>}
      <div className="command-confirm-actions"><button className="secondary-button" type="button" onClick={() => { setConfirming(false); setTypedId(""); }}>Cancelar</button><button className="remove-charger-confirm" type="submit" disabled={pending || hasActiveSession || typedId.trim() !== charger.charge_point_id}>{pending ? "Removendo…" : "Remover carregador"}</button></div>
    </form></div>}
    {state.error && !confirming && <small className="form-error" role="alert">{state.error}</small>}
  </div>;
}

function ChargerCredentialControl({ charger, organizationId }: { charger: Charger; organizationId: string }) {
  const [state, action, pending] = useActionState(rotateChargerCredential.bind(null, organizationId, charger.id), initialState);
  const [confirming, setConfirming] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  async function copyCredential() {
    if (!state.credential) return;
    try {
      await navigator.clipboard.writeText(state.credential);
      setCopyFeedback("Senha copiada.");
    } catch {
      setCopyFeedback("Não foi possível copiar. Selecione e copie a senha.");
    }
  }
  return <div className="charger-credential-control">
    {!state.credential && <button type="button" className="secondary-button rotate-credential-button" onClick={() => { setConfirming(true); setCopyFeedback(""); }} disabled={pending}><RotateCcw size={13}/>Gerar nova credencial</button>}
    {confirming && !state.credential && <div className="command-confirm-backdrop"><form action={action} className="command-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`rotate-credential-title-${charger.id}`} aria-describedby={`rotate-credential-description-${charger.id}`}>
      <h2 id={`rotate-credential-title-${charger.id}`}>Gerar nova credencial?</h2>
      <p id={`rotate-credential-description-${charger.id}`}>A senha antiga deixa de funcionar e o carregador desconecta. Será necessário atualizar a senha no equipamento para conectá-lo novamente.</p>
      {state.error && <small className="form-error" role="alert">{state.error}</small>}
      <div className="command-confirm-actions"><button className="secondary-button" type="button" onClick={() => setConfirming(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={pending}>{pending ? "Gerando…" : "Confirmar e gerar"}</button></div>
    </form></div>}
    {state.credential && <div className="command-confirm-backdrop"><section className="command-confirm-dialog credential-once-dialog" role="dialog" aria-modal="true" aria-labelledby={`new-credential-title-${charger.id}`}>
      <h2 id={`new-credential-title-${charger.id}`}>Nova credencial gerada</h2>
      <p>A senha antiga foi invalidada. Copie e atualize o equipamento agora; esta senha será exibida somente nesta tela.</p>
      <span>ID OCPP: <code>{state.chargePointId}</code></span>
      <span>Nova senha: <code>{state.credential}</code></span>
      <div className="command-confirm-actions"><button type="button" className="secondary-button" onClick={() => void copyCredential()}><Copy size={13}/>Copiar senha</button><button type="button" className="primary-button" onClick={() => window.location.reload()}>Concluir</button></div>
      {copyFeedback && <small role="status">{copyFeedback}</small>}
    </section></div>}
  </div>;
}

function ChargerRestoreControl({ charger, organizationId, now }: { charger: Charger; organizationId: string; now: number }) {
  const [state, action, pending] = useActionState(restoreCharger.bind(null, organizationId, charger.id), initialState);
  const router = useRouter();
  const removedAt = charger.removed_at ? new Date(charger.removed_at) : null;
  const restoreAllowed = removedAt !== null && now > 0 && now - removedAt.getTime() <= 30 * 24 * 60 * 60 * 1000;
  return <div className="charger-restore-control">
    {!state.credential && <form action={action}><button type="submit" className="restore-charger-button" disabled={pending || !restoreAllowed}><RotateCcw size={13}/>{pending ? "Restaurando…" : "Restaurar"}</button></form>}
    {state.error && <small className="form-error" role="alert">{state.error}</small>}
    {state.credential && <div className="credential-reveal restore-credential"><strong>{state.success} Copie a nova senha agora.</strong><span>ID OCPP: <code>{state.chargePointId}</code></span><span>Nova senha: <code>{state.credential}</code></span><button type="button" className="secondary-button" onClick={() => router.refresh()}>Concluir</button></div>}
  </div>;
}

function ConfigurationControl({ charger, organizationId }: { charger: Charger; organizationId: string }) {
  const [state, action, pending] = useActionState(requestGetConfiguration.bind(null, organizationId, charger.id), initialState);
  return <div className="charger-control"><form action={action}><button className="secondary-button command-button" type="submit" disabled={!charger.online || pending}>{pending ? "Consultando…" : "Ler configuração de autorização"}</button></form>{state.error && <small className="form-error" role="alert">{state.error}</small>}{state.success && <small className="form-success" role="status">{state.success}</small>}</div>;
}

function RfidAuthorizationManager({ charger, authorizations, organizationId }: { charger: Charger; authorizations: ChargerAuthorization[]; organizationId: string }) {
  const [state, action, pending] = useActionState(registerRfidAuthorization.bind(null, organizationId, charger.id), initialState);
  return <div className="rfid-manager"><strong>Cartões RFID autorizados</strong>
    <form action={action}><input name="id_tag" maxLength={20} autoComplete="off" placeholder="Identificador impresso do cartão" required/><button className="secondary-button command-button" type="submit" disabled={pending}>{pending ? "Salvando…" : "Autorizar cartão"}</button></form>
    {authorizations.length > 0 && authorizations.map((authorization) => <RfidAuthorizationRow key={authorization.id} authorization={authorization} organizationId={organizationId} chargerId={charger.id}/>)}
    {state.error && <small className="form-error" role="alert">{state.error}</small>}{state.success && <small className="form-success" role="status">{state.success}</small>}
    <small>O valor digitado é usado para comparar o OCPP idTag e armazenado somente como hash.</small>
  </div>;
}

function RfidAuthorizationRow({ authorization, organizationId, chargerId }: { authorization: ChargerAuthorization; organizationId: string; chargerId: string }) {
  const [state, action, pending] = useActionState(revokeRfidAuthorization.bind(null, organizationId, chargerId, authorization.id), initialState);
  return <div className="rfid-row"><span>{authorization.authorization_type} · impressão digital {authorization.id_tag_hash.slice(0, 10)} · {authorization.enabled ? "ativo" : "revogado"}</span>{authorization.enabled && <form action={action}><button type="submit" className="credential-copy" disabled={pending}>{pending ? "Revogando…" : "Revogar"}</button></form>}{state.error && <small className="form-error">{state.error}</small>}{state.success && <small className="form-success">{state.success}</small>}</div>;
}

function SessionList({ sessions, completedSessions, meterReadings, chargers, siteNames, now, organizationId, canControl, commands }: {
  sessions: ActiveSession[];
  completedSessions: CompletedSession[];
  meterReadings: MeterReading[];
  chargers: Charger[];
  siteNames: Map<string, string>;
  now: number;
  organizationId: string;
  canControl: boolean;
  commands: CommandRecord[];
}) {
  const chargerById = new Map(chargers.map((charger) => [charger.id, charger]));
  const latestBySession = new Map<string, Map<string, MeterReading>>();
  const reviewBySession = new Map<string, string>();
  for (const reading of meterReadings) {
    if (!reading.session_id) continue;
    if (reading.requires_review) {
      if (reading.review_reason && !reviewBySession.has(reading.session_id)) reviewBySession.set(reading.session_id, reading.review_reason);
      continue;
    }
    let readingsByType = latestBySession.get(reading.session_id);
    if (!readingsByType) {
      readingsByType = new Map();
      latestBySession.set(reading.session_id, readingsByType);
    }
    if (!readingsByType.has(reading.measurand)) readingsByType.set(reading.measurand, reading);
  }

  return <section className="panel session-panel">
    <div className="panel-heading"><div><h2 className="panel-title">Recargas em andamento</h2><div className="panel-kicker">A duração atualiza a cada 30 segundos · medições mais recentes recebidas pelo gateway</div></div><Activity size={17}/></div>
    {!sessions.length ? <div className="session-empty-inline">Nenhuma recarga em andamento. Uma sessão aparecerá quando o carregador iniciar e reportar uma transação OCPP.</div> :
    <div className="session-list">{sessions.map((session) => {
      const charger = chargerById.get(session.charger_id);
      const readings = latestBySession.get(session.id) ?? new Map<string, MeterReading>();
      const energy = [...readings.values()].find((reading) => reading.measurand === "Energy.Active.Import.Register");
      const power = readings.get("Power.Active.Import");
      const soc = readings.get("SoC");
      const energyUnit = energy?.unit?.toLowerCase();
      const energyWh = energy && (energyUnit === "wh" || energyUnit === "kwh") ? Number(energy.value) * (energyUnit === "kwh" ? 1000 : 1) : null;
      const energyReadingInvalid = energyWh !== null && (energyWh < 0 || (session.start_meter_wh !== null && energyWh < Number(session.start_meter_wh)));
      const deliveredKwh = energyWh !== null && session.start_meter_wh !== null && !energyReadingInvalid ? (energyWh - Number(session.start_meter_wh)) / 1000 : null;
      const powerUnit = power?.unit?.toLowerCase();
      const powerKw = power && (powerUnit === "w" || powerUnit === "kw") ? Number(power.value) * (powerUnit === "w" ? 0.001 : 1) : null;
      const elapsedSeconds = session.started_at ? Math.max(0, Math.floor((now - new Date(session.started_at).getTime()) / 1000)) : null;
      const elapsed = elapsedSeconds === null ? "Aguardando horário" : `${Math.floor(elapsedSeconds / 3600).toString().padStart(2, "0")}:${Math.floor((elapsedSeconds % 3600) / 60).toString().padStart(2, "0")}:${(elapsedSeconds % 60).toString().padStart(2, "0")}`;
      return <article className="session-row" key={session.id}>
        <div className="site-row-icon"><PlugZap size={16}/></div>
        <div className="session-row-main"><strong>{charger?.charge_point_id ?? "Carregador"}</strong><span>{charger?.removed_at ? "Carregador removido" : siteNames.get(charger?.site_id ?? "") ?? "Local indisponível"} · Conector {session.connector_id ?? "—"} · Autorização {session.authorization_type ?? "não identificada"}</span></div>
        <div className="session-metric"><span><Clock3 size={12}/>Tempo</span><strong>{elapsed}</strong></div>
        <div className="session-metric"><span><Activity size={12}/>Potência agora</span><strong>{powerKw === null ? "Aguardando medição" : `${powerKw.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kW`}</strong></div>
        <div className="session-metric"><span><Zap size={12}/>Energia entregue</span><strong className={energyReadingInvalid ? "meter-reading-error" : undefined}>{energyReadingInvalid ? "Leitura inválida" : deliveredKwh === null ? "Aguardando medição" : `${deliveredKwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh`}</strong></div>
        <div className="session-metric"><span><Activity size={12}/>Bateria (SoC)</span><strong>{soc ? `${Number(soc.value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "Não informado"}</strong></div>
        <small className="session-updated">{reviewBySession.has(session.id) ? `Leitura do medidor marcada para revisão: ${reviewBySession.get(session.id)}` : energy || power ? `Última leitura: ${new Date(Math.max(energy ? new Date(energy.sampled_at).getTime() : 0, power ? new Date(power.sampled_at).getTime() : 0)).toLocaleString("pt-BR")}` : "Nenhuma medição recebida ainda"}</small>
        {canControl && Number.isInteger(session.ocpp_transaction_id) && <SessionStopControl session={session} organizationId={organizationId} online={Boolean(charger?.online)}/>}
      </article>;
    })}</div>}
    <div className="session-history"><h3>Histórico de sessões encerradas</h3>{!completedSessions.length ? <p className="session-empty-inline">Ainda não há sessões encerradas registradas.</p> : <div className="session-history-list">{completedSessions.map((session) => {
      const charger = chargerById.get(session.charger_id);
      const startMeter = session.start_meter_wh === null ? null : Number(session.start_meter_wh);
      const endMeter = session.end_meter_wh === null ? null : Number(session.end_meter_wh);
      const invalidMeters = startMeter !== null && endMeter !== null && endMeter < startMeter;
      const finalKwh = startMeter !== null && endMeter !== null && !invalidMeters ? (endMeter - startMeter) / 1000 : null;
      return <article className="session-history-row" key={session.id}>
        <div><strong>{charger?.charge_point_id ?? "Carregador"} · Conector {session.connector_id ?? "—"}</strong><small>{new Date(session.ended_at ?? "").toLocaleString("pt-BR")} · {charger?.removed_at ? "Carregador removido" : siteNames.get(charger?.site_id ?? "") ?? "Local indisponível"}</small></div>
        <div><span>Medidor inicial</span><strong>{startMeter === null ? "Não informado" : `${startMeter.toLocaleString("pt-BR")} Wh`}</strong></div>
        <div><span>Medidor final</span><strong className={invalidMeters ? "meter-reading-error" : undefined}>{invalidMeters ? "Revisar medidor" : endMeter === null ? "Não informado" : `${endMeter.toLocaleString("pt-BR")} Wh`}</strong></div>
        <div><span>kWh final</span><strong className={invalidMeters ? "meter-reading-error" : undefined}>{invalidMeters ? "Revisar medidor" : finalKwh === null ? "Não informado" : `${finalKwh.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kWh`}</strong></div>
      </article>;
    })}</div>}</div>
    <CommandHistory commands={commands} chargers={chargers}/>
  </section>;
}

function SessionStopControl({ session, organizationId, online }: { session: ActiveSession; organizationId: string; online: boolean }) {
  const [state, action, pending] = useActionState(requestRemoteStop.bind(null, organizationId, session.id), initialState);
  const [confirming, setConfirming] = useState(false);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) setConfirming(false);
    wasPending.current = pending;
  }, [pending]);
  return <div className="session-stop-control"><form action={action}><button className="secondary-button command-button stop-command" type="button" onClick={() => setConfirming(true)} disabled={!online || pending}><Square size={12}/>{pending ? "Enviando…" : "Solicitar parada"}</button>{confirming && <div className="command-confirm-backdrop"><section className="command-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`stop-confirm-title-${session.id}`} aria-describedby={`stop-confirm-description-${session.id}`}><h2 id={`stop-confirm-title-${session.id}`}>Confirmar parada da recarga?</h2><p id={`stop-confirm-description-${session.id}`}>O carregador encerra a sessão quando confirmar o comando pelo OCPP.</p><div className="command-confirm-actions"><button className="secondary-button" type="button" autoFocus onClick={() => setConfirming(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={pending}>{pending ? "Enviando…" : "Confirmar parada"}</button></div></section></div>}</form>{state.error && <small className="form-error" role="alert">{state.error}</small>}{state.success && <small className="form-success" role="status">{state.success}</small>}</div>;
}

function CommandHistory({ commands, chargers }: { commands: CommandRecord[]; chargers: Charger[] }) {
  if (!commands.length) return null;
  const chargerNames = new Map(chargers.map((charger) => [charger.id, charger.charge_point_id]));
  const labels: Record<string, string> = { pending: "Na fila", sent: "Aguardando resposta", accepted: "Aceito · aguardando evento OCPP", confirmed: "Confirmado pelo carregador", rejected: "Recusado pelo carregador", timeout: "Sem resposta ao comando", operation_timeout: "Sem confirmação da transação", unknown: "Resultado desconhecido após reinício", failed: "Falhou" };
  return <div className="command-history"><h3>Pedidos recentes</h3>{commands.map((command) => {
    const reason = typeof command.result?.description === "string" ? command.result.description : typeof command.result?.error === "string" ? command.result.error : null;
    const actionName = command.action === "RemoteStartTransaction" ? "Iniciar recarga" : command.action === "RemoteStopTransaction" ? "Parar recarga" : command.action === "GetConfiguration" ? "Ler configuração OCPP" : command.action;
    return <div className="command-history-row" key={command.id}><span>{actionName} · {chargerNames.get(command.charger_id) ?? "Carregador"}{command.status === "rejected" && command.action === "RemoteStartTransaction" ? <small> O carregador não autorizou o início remoto. Verifique a configuração ou use o cartão RFID.</small> : reason && <small> {reason}</small>}</span><strong className={`command-state command-${command.status}`}>{labels[command.status] ?? command.status}</strong><small>{new Date(command.requested_at).toLocaleString("pt-BR")}</small></div>;
  })}</div>;
}
