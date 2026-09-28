import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Dashboard } from "@/components/dashboard";
import { OrganizationOnboarding } from "@/components/organization-onboarding";

type Organization = { id: string; name: string; slug: string };
type Site = { id: string; name: string; address: string | null; timezone: string; max_power_kw: number | null };
type Charger = { id: string; site_id: string; charge_point_id: string; vendor: string | null; model: string | null; max_power_kw: number | null; status: string; online: boolean; last_heartbeat_at: string | null };
type ActiveSession = { id: string; charger_id: string; connector_id: number | null; started_at: string | null; start_meter_wh: number | null; ocpp_transaction_id: number | null };
type MeterReading = { session_id: string | null; measurand: string; value: number; unit: string | null; sampled_at: string };
type CommandRecord = { id: string; charger_id: string; action: string; status: string; requested_at: string; completed_at: string | null };

function SetupMessage({ title, message }: { title: string; message: string }) {
  return <main className="login-page"><section className="login-card"><div className="login-brand"><span className="brand-mark">T</span><span>TELEKTRO</span></div><p className="eyebrow">CONFIGURAÇÃO</p><h1>{title}</h1><p className="login-description">{message}</p></section></main>;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return <SetupMessage title="Conecte o Supabase" message="Confira NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em apps/web/.env.local e reinicie o dashboard."/>; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships, error: membershipsError } = await supabase.from("memberships").select("organization_id, role").eq("user_id", user.id);
  if (membershipsError) return <SetupMessage title="Não foi possível carregar seu workspace" message="Atualize a página. Se o problema continuar, confira as migrations e as permissões RLS do projeto."/>;
  if (!memberships?.length) return <OrganizationOnboarding email={user.email ?? "Conta Telektro"}/>;

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const { data: organizations, error: organizationsError } = await supabase.from("organizations").select("id, name, slug").in("id", organizationIds).order("name");
  if (organizationsError || !organizations?.length) return <SetupMessage title="Organização indisponível" message="Não conseguimos carregar as organizações vinculadas à sua conta."/>;

  const { org: requestedOrganizationId } = await searchParams;
  const availableOrganizations = organizations as Organization[];
  const activeOrganization = availableOrganizations.find((organization) => organization.id === requestedOrganizationId) ?? availableOrganizations[0];
  const activeMembership = memberships.find((membership) => membership.organization_id === activeOrganization.id);

  const [sitesResult, chargerListResult, chargersResult, onlineResult, sessionsResult, commandsResult] = await Promise.all([
    supabase.from("sites").select("id, name, address, timezone, max_power_kw").eq("organization_id", activeOrganization.id).order("name"),
    supabase.from("chargers").select("id, site_id, charge_point_id, vendor, model, max_power_kw, status, online, last_heartbeat_at").eq("organization_id", activeOrganization.id).order("charge_point_id"),
    supabase.from("chargers").select("id", { count: "exact", head: true }).eq("organization_id", activeOrganization.id),
    supabase.from("chargers").select("id", { count: "exact", head: true }).eq("organization_id", activeOrganization.id).eq("online", true),
    supabase.from("sessions").select("id, charger_id, connector_id, started_at, start_meter_wh, ocpp_transaction_id").eq("organization_id", activeOrganization.id).is("ended_at", null).order("started_at", { ascending: false }),
    supabase.from("commands").select("id, charger_id, action, status, requested_at, completed_at").eq("organization_id", activeOrganization.id).order("requested_at", { ascending: false }).limit(20),
  ]);
  if (sitesResult.error || chargerListResult.error || chargersResult.error || onlineResult.error || sessionsResult.error || commandsResult.error) {
    return <SetupMessage title="Falha ao consultar a operação" message="A sessão foi reconhecida, mas não conseguimos ler os dados protegidos do workspace. Confira as policies RLS."/>;
  }

  const sites = (sitesResult.data ?? []) as Site[];
  const chargers = (chargerListResult.data ?? []) as Charger[];
  const activeSessions = (sessionsResult.data ?? []) as ActiveSession[];
  const commandRows = (commandsResult.data ?? []) as CommandRecord[];
  let meterReadings: MeterReading[] = [];
  if (activeSessions.length) {
    const { data: meterData, error: meterError } = await supabase.from("meter_values")
      .select("session_id, measurand, value, unit, sampled_at")
      .in("session_id", activeSessions.map((session) => session.id))
      .order("sampled_at", { ascending: false }).limit(500);
    if (meterError) return <SetupMessage title="Falha ao carregar medições" message="As sessões foram encontradas, mas não conseguimos consultar as leituras recentes dos carregadores."/>;
    meterReadings = (meterData ?? []) as MeterReading[];
  }
  const capacityKw = sites.reduce((total, site) => total + Number(site.max_power_kw ?? 0), 0);

  return <Dashboard email={user.email ?? ""} organizations={availableOrganizations} organization={activeOrganization}
    role={activeMembership?.role ?? "viewer"} sites={sites} chargers={chargers} capacityKw={capacityKw}
    totalChargers={chargersResult.count ?? 0} onlineChargers={onlineResult.count ?? 0} activeSessions={activeSessions.length}
    sessionRows={activeSessions} meterReadings={meterReadings} commandRows={commandRows}/>;
}
