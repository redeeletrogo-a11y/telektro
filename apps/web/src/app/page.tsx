import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Landing } from "@/components/landing";
import { Dashboard } from "@/components/dashboard";
import { PIX_GRACE_DAYS, syncPendingPix } from "@/lib/pix";
import { SubscribeScreen } from "@/components/subscribe-screen";
import { mercadoPagoConfigured, organizationHasAccess, reconcileSubscription, trialDaysLeft } from "@/lib/billing";
import { ResidentHome } from "@/components/resident-home";
import type { Invite, Resident, ResidentTag } from "@/components/residents-panel";
import { OrganizationOnboarding } from "@/components/organization-onboarding";

// Pix subscribers: days until the paid month ends (current_period_end holds that date plus the grace days). Negative = in grace.
function pixDueDays(org: { subscription_provider: string | null; current_period_end: string | null }) {
  if (org.subscription_provider !== "mercadopago_pix" || !org.current_period_end) return null;
  const due = new Date(org.current_period_end).getTime() - PIX_GRACE_DAYS * 86_400_000;
  return Math.ceil((due - Date.now()) / 86_400_000);
}

type Organization = { id: string; name: string; slug: string; account_type: string; resident_limit: number | null; subscription_status: string; trial_ends_at: string | null; current_period_end: string | null; subscription_provider: string | null };
type Site = { id: string; name: string; address: string | null; timezone: string; max_power_kw: number | null };
type Charger = { id: string; organization_id: string; site_id: string; charge_point_id: string; vendor: string | null; model: string | null; firmware: string | null; model_code: string | null; serial_number: string | null; connector_type: string | null; connector_count: number | null; installation_power_kw: number | null; ocpp_version: string | null; technical_specs: Record<string, unknown>; capabilities: Record<string, unknown>; max_power_kw: number | null; status: string; online: boolean; last_heartbeat_at: string | null; last_boot_at: string | null; last_status_notification_at: string | null; last_transaction_at: string | null; last_transaction_id: number | null; last_ocpp_error: string | null; removed_at: string | null; removed_by: string | null };
type Connector = { id: string; organization_id: string; charger_id: string; connector_id: number; status: string; updated_at: string };
type ChargerAuthorization = { id: string; charger_id: string; id_tag_hash: string; authorization_type: string; enabled: boolean; created_at: string };
type ActiveSession = { id: string; charger_id: string; connector_id: number | null; started_at: string | null; start_meter_wh: number | null; ocpp_transaction_id: number | null; authorization_type: string | null; authorized_user_id: string | null };
type CompletedSession = ActiveSession & { ended_at: string | null; end_meter_wh: number | null };
type MeterReading = { session_id: string | null; measurand: string; value: number; unit: string | null; sampled_at: string; requires_review: boolean; review_reason: string | null };
type CommandRecord = { id: string; charger_id: string; action: string; status: string; requested_at: string; completed_at: string | null; result: Record<string, unknown> | null };

function SetupMessage({ title, message }: { title: string; message: string }) {
  return <main className="login-page"><section className="login-card"><div className="login-brand"><span className="brand-mark">T</span><span>TELEKTRO</span></div><p className="eyebrow">CONFIGURAÇÃO</p><h1>{title}</h1><p className="login-description">{message}</p></section></main>;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return <SetupMessage title="Conecte o Supabase" message="Confira NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em apps/web/.env.local e reinicie o dashboard."/>; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <Landing/>;

  const { data: memberships, error: membershipsError } = await supabase.from("memberships").select("organization_id, role").eq("user_id", user.id);
  if (membershipsError) return <SetupMessage title="Não foi possível carregar seu workspace" message="Atualize a página. Se o problema continuar, confira as migrations e as permissões RLS do projeto."/>;
  const pendingInvite = (await cookies()).get("telektro_invite")?.value;
  if (pendingInvite && /^[a-z0-9]{10,32}$/.test(pendingInvite)) redirect(`/convite/${pendingInvite}`);
  if (!memberships?.length) return <OrganizationOnboarding email={user.email ?? "Conta Telektro"}/>;

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const { data: organizations, error: organizationsError } = await supabase.from("organizations").select("id, name, slug, account_type, resident_limit, subscription_status, trial_ends_at, current_period_end, subscription_provider").in("id", organizationIds).order("name");
  if (organizationsError || !organizations?.length) return <SetupMessage title="Organização indisponível" message="Não conseguimos carregar as organizações vinculadas à sua conta."/>;

  const { org: requestedOrganizationId } = await searchParams;
  const availableOrganizations = organizations as Organization[];
  const activeOrganization = availableOrganizations.find((organization) => organization.id === requestedOrganizationId) ?? availableOrganizations[0];
  const activeMembership = memberships.find((membership) => membership.organization_id === activeOrganization.id);

  if (activeMembership?.role === "resident") {
    const [residentChargers, residentConnectors, residentSessions] = await Promise.all([
      supabase.from("chargers").select("id, charge_point_id, model, status, online").eq("organization_id", activeOrganization.id).is("removed_at", null).order("charge_point_id"),
      supabase.from("connectors").select("charger_id, connector_id, status").eq("organization_id", activeOrganization.id).order("connector_id"),
      supabase.from("sessions").select("id, charger_id, started_at, ended_at").eq("organization_id", activeOrganization.id).order("started_at", { ascending: false }).limit(20),
    ]);
    let usage: { ended_at: string; kwh: number; price_per_kwh: number; amount: number }[] | null = null;
    if (activeOrganization.account_type === "condominio") {
      const { data: usageRows, error: usageError } = await supabase.rpc("my_condo_usage", { p_organization_id: activeOrganization.id, p_month: new Date().toISOString().slice(0, 7) + "-01" });
      if (!usageError) usage = (usageRows ?? []).map((row: { ended_at: string; kwh: string | number; price_per_kwh: string | number; amount: string | number }) => ({ ended_at: row.ended_at, kwh: Number(row.kwh), price_per_kwh: Number(row.price_per_kwh), amount: Number(row.amount) }));
    }
    return <ResidentHome email={user.email ?? ""} organizationName={activeOrganization.name} chargers={residentChargers.data ?? []} connectors={residentConnectors.data ?? []} canControl={activeOrganization.account_type === "condominio"} sessions={residentSessions.data ?? []} usage={usage}/>;
  }

  if (!organizationHasAccess(activeOrganization)) {
    if (activeOrganization.account_type === "residencial" && (await reconcileSubscription(activeOrganization.id) || await syncPendingPix(activeOrganization.id))) redirect("/");
    return <SubscribeScreen organizationId={activeOrganization.id} paymentsEnabled={mercadoPagoConfigured()} organizationName={activeOrganization.name} email={user.email ?? ""} trialEnded={activeOrganization.subscription_status === "trialing"}/>;
  }

  const isCondoAdmin = activeOrganization.account_type === "condominio" && ["owner", "admin"].includes(activeMembership?.role ?? "");
  let residents: Resident[] = [];
  let invites: Invite[] = [];
  let residentTags: ResidentTag[] = [];
  if (isCondoAdmin) {
    const [residentsResult, invitesResult, tagsResult] = await Promise.all([
      supabase.rpc("list_residents", { p_organization_id: activeOrganization.id }),
      supabase.from("organization_invites").select("id, code, expires_at, revoked_at, accepted_count").eq("organization_id", activeOrganization.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("resident_tags").select("id, user_id, label, id_tag_hash, enabled").eq("organization_id", activeOrganization.id).eq("enabled", true).order("created_at", { ascending: false }),
    ]);
    residents = (residentsResult.data ?? []) as Resident[];
    invites = (invitesResult.data ?? []) as Invite[];
    residentTags = (tagsResult.data ?? []) as ResidentTag[];
  }

  const [sitesResult, chargerListResult, removedChargersResult, chargersResult, onlineResult, sessionsResult, historyResult, commandsResult, connectorResult, authorizationResult] = await Promise.all([
    supabase.from("sites").select("id, name, address, timezone, max_power_kw").eq("organization_id", activeOrganization.id).order("name"),
    supabase.from("chargers").select("id, organization_id, site_id, charge_point_id, vendor, model, firmware, model_code, serial_number, connector_type, connector_count, installation_power_kw, ocpp_version, technical_specs, capabilities, max_power_kw, status, online, last_heartbeat_at, last_boot_at, last_status_notification_at, last_transaction_at, last_transaction_id, last_ocpp_error, removed_at, removed_by").eq("organization_id", activeOrganization.id).is("removed_at", null).order("charge_point_id"),
    supabase.from("chargers").select("id, organization_id, site_id, charge_point_id, vendor, model, firmware, model_code, serial_number, connector_type, connector_count, installation_power_kw, ocpp_version, technical_specs, capabilities, max_power_kw, status, online, last_heartbeat_at, last_boot_at, last_status_notification_at, last_transaction_at, last_transaction_id, last_ocpp_error, removed_at, removed_by").eq("organization_id", activeOrganization.id).not("removed_at", "is", null).order("removed_at", { ascending: false }),
    supabase.from("chargers").select("id", { count: "exact", head: true }).eq("organization_id", activeOrganization.id).is("removed_at", null),
    supabase.from("chargers").select("id", { count: "exact", head: true }).eq("organization_id", activeOrganization.id).eq("online", true).is("removed_at", null),
    supabase.from("sessions").select("id, charger_id, connector_id, started_at, start_meter_wh, ocpp_transaction_id, authorization_type, authorized_user_id").eq("organization_id", activeOrganization.id).is("ended_at", null).order("started_at", { ascending: false }),
    supabase.from("sessions").select("id, charger_id, connector_id, started_at, start_meter_wh, ocpp_transaction_id, authorization_type, authorized_user_id, ended_at, end_meter_wh").eq("organization_id", activeOrganization.id).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(50),
    supabase.from("commands").select("id, charger_id, action, status, requested_at, completed_at, result").eq("organization_id", activeOrganization.id).order("requested_at", { ascending: false }).limit(20),
    supabase.from("connectors").select("id, organization_id, charger_id, connector_id, status, updated_at").eq("organization_id", activeOrganization.id).order("connector_id"),
    supabase.from("charger_authorizations").select("id, charger_id, id_tag_hash, authorization_type, enabled, created_at").eq("organization_id", activeOrganization.id).eq("authorization_type", "RFID").order("created_at", { ascending: false }),
  ]);
  if (sitesResult.error || chargerListResult.error || removedChargersResult.error || chargersResult.error || onlineResult.error || sessionsResult.error || historyResult.error || commandsResult.error || connectorResult.error || authorizationResult.error) {
    return <SetupMessage title="Falha ao consultar a operação" message="A sessão foi reconhecida, mas não conseguimos ler os dados protegidos do workspace. Confira as policies RLS."/>;
  }

  const sites = (sitesResult.data ?? []) as Site[];
  const chargers = (chargerListResult.data ?? []) as Charger[];
  const removedChargers = (removedChargersResult.data ?? []) as Charger[];
  const connectors = (connectorResult.data ?? []) as Connector[];
  const authorizations = (authorizationResult.data ?? []) as ChargerAuthorization[];
  const activeSessions = (sessionsResult.data ?? []) as ActiveSession[];
  const completedSessions = (historyResult.data ?? []) as CompletedSession[];
  const commandRows = (commandsResult.data ?? []) as CommandRecord[];
  let meterReadings: MeterReading[] = [];
  if (activeSessions.length) {
    const { data: meterData, error: meterError } = await supabase.from("meter_values")
      .select("session_id, measurand, value, unit, sampled_at, requires_review, review_reason")
      .in("session_id", activeSessions.map((session) => session.id))
      .order("sampled_at", { ascending: false }).limit(500);
    if (meterError) return <SetupMessage title="Falha ao carregar medições" message="As sessões foram encontradas, mas não conseguimos consultar as leituras recentes dos carregadores."/>;
    meterReadings = (meterData ?? []) as MeterReading[];
  }
  let condoTariff: { price_per_kwh: number; session_fee: number } | null = null;
  if (activeOrganization.account_type === "condominio" && (activeMembership?.role === "owner" || activeMembership?.role === "admin")) {
    const { data: tariffRow } = await supabase.from("tariffs").select("price_per_kwh, session_fee").eq("organization_id", activeOrganization.id).eq("active", true).is("site_id", null).order("valid_from", { ascending: false }).limit(1).maybeSingle();
    if (tariffRow) condoTariff = { price_per_kwh: Number(tariffRow.price_per_kwh), session_fee: Number(tariffRow.session_fee) };
  }
  const capacityKw = sites.reduce((total, site) => total + Number(site.max_power_kw ?? 0), 0);

  return <Dashboard email={user.email ?? ""} organizations={availableOrganizations} organization={activeOrganization}
    role={activeMembership?.role ?? "viewer"} accountType={activeOrganization.account_type} trialDaysLeft={trialDaysLeft(activeOrganization)} pixDueDays={pixDueDays(activeOrganization)} condoTariff={condoTariff} residents={residents} residentTags={residentTags} invites={invites} sites={sites} chargers={chargers} removedChargers={removedChargers} connectors={connectors} authorizations={authorizations} capacityKw={capacityKw}
    totalChargers={chargersResult.count ?? 0} onlineChargers={onlineResult.count ?? 0} activeSessions={activeSessions.length}
    sessionRows={activeSessions} completedSessionRows={completedSessions} meterReadings={meterReadings} commandRows={commandRows} dataLoadedAt={new Date().toISOString()}/>;
}
