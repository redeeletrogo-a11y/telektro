"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSubscriptionCheckoutUrl, mercadoPagoConfigured } from "@/lib/billing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupportedTimeZone } from "@/lib/time-zone";

export type FormState = { error?: string; success?: string; credential?: string; chargePointId?: string };

async function accessBlocked(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, organizationId: string) {
  const { data, error } = await supabase.rpc("org_has_access", { target_organization_id: organizationId });
  return !error && data === false;
}
const blockedMessage = "Seu teste grátis terminou. Assine o plano para continuar usando os controles.";
const chargerStaleAfterMs = Math.max(60, Number(process.env.OCPP_CHARGER_STALE_AFTER_SECONDS ?? 180)) * 1000;

function chargerHasRecentHeartbeat(lastHeartbeatAt: string | null) {
  const heartbeatAt = lastHeartbeatAt ? new Date(lastHeartbeatAt).getTime() : Number.NaN;
  return Number.isFinite(heartbeatAt) && Date.now() - heartbeatAt <= chargerStaleAfterMs;
}

export async function createOrganization(_previous: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const accountType = String(formData.get("account_type") ?? "residencial");
  if (accountType === "eletroposto") return { error: "O plano Eletroposto ainda não está disponível. Fale com a Telektro." };
  if (!["residencial", "condominio"].includes(accountType)) return { error: "Escolha o tipo de conta." };
  if (name.length < 1 || name.length > 120) return { error: "O nome deve ter entre 1 e 120 caracteres." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: "Use letras minúsculas, números e hífens no identificador." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Configure a conexão com o Supabase no arquivo apps/web/.env.local." }; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };

  const { data: newOrganizationId, error } = await supabase.rpc("create_organization_with_owner", { p_name: name, p_slug: slug, p_account_type: accountType });
  if (!error && newOrganizationId) {
    // Default location so the first charger can be registered right away.
    await supabase.from("sites").insert({ organization_id: newOrganizationId, name: accountType === "residencial" ? "Minha casa" : name, timezone: "America/Fortaleza" });
  }
  if (error) {
    if (error.code === "PGRST202" || error.message.includes("create_organization_with_owner")) {
      return { error: "A migration de criação da organização ainda precisa ser aplicada no Supabase." };
    }
    if (error.code === "23505") return { error: "Esse identificador já está em uso. Escolha outro." };
    return { error: "Não foi possível criar a organização. Confira os dados e tente novamente." };
  }

  revalidatePath("/");
  redirect("/");
}

export async function createSite(organizationId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "America/Fortaleza").trim();
  const rawPower = String(formData.get("max_power_kw") ?? "").trim();
  const maxPower = rawPower ? Number(rawPower) : null;

  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return { error: "Organização inválida." };
  if (name.length < 1 || name.length > 120) return { error: "O nome do local deve ter entre 1 e 120 caracteres." };
  if (!isSupportedTimeZone(timezone)) return { error: "Informe um fuso horário IANA válido, como America/Fortaleza." };
  if (maxPower !== null && (!Number.isFinite(maxPower) || maxPower <= 0)) return { error: "A capacidade precisa ser maior que zero." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Configure a conexão com o Supabase no arquivo apps/web/.env.local." }; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };

  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Seu perfil não tem permissão para cadastrar locais nesta organização." };
  }

  const { error } = await supabase.from("sites").insert({ organization_id: organizationId, name, address, timezone, max_power_kw: maxPower });
  if (error) return { error: "Não foi possível salvar o local. Confira os dados e tente novamente." };

  revalidatePath("/");
  return { success: "Local cadastrado." };
}

export async function registerCharger(organizationId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const chargePointId = String(formData.get("charge_point_id") ?? "").trim();
  const siteId = String(formData.get("site_id") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const modelCode = String(formData.get("model_code") ?? "").trim() || null;
  const catalogCode = String(formData.get("catalog_code") ?? "").trim() || null;
  const serialNumber = String(formData.get("serial_number") ?? "").trim() || null;
  const connectorType = String(formData.get("connector_type") ?? "").trim() || null;
  const rawConnectorCount = String(formData.get("connector_count") ?? "").trim();
  const connectorCount = rawConnectorCount ? Number(rawConnectorCount) : null;
  const rawInstallationPower = String(formData.get("installation_power_kw") ?? "").trim();
  const installationPower = rawInstallationPower ? Number(rawInstallationPower) : null;
  const ocppVersion = String(formData.get("ocpp_version") ?? "").trim() || null;
  const nominalVoltage = String(formData.get("nominal_voltage") ?? "").trim() || null;
  const electricalPhases = String(formData.get("electrical_phases") ?? "").trim() || null;
  const otherNetworks = String(formData.get("other_network_interfaces") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const networkInterfaces = [...formData.getAll("network_interfaces").map(String), ...otherNetworks];
  const hasRfid = String(formData.get("has_rfid") ?? "");
  const hasEnergyMeter = String(formData.get("has_energy_meter") ?? "");
  const hasDisplay = String(formData.get("has_display") ?? "");
  const authorizationMode = String(formData.get("authorization_mode") ?? "").trim() || null;
  const rawPower = String(formData.get("max_power_kw") ?? "").trim();
  const maxPower = rawPower ? Number(rawPower) : null;

  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(siteId)) return { error: "Selecione um local válido." };
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(chargePointId)) return { error: "Use de 1 a 64 letras, números, pontos, hífens ou sublinhados no ID OCPP." };
  if (vendor && vendor.length > 50) return { error: "O fabricante deve ter no máximo 50 caracteres." };
  if (model && model.length > 80) return { error: "O modelo deve ter no máximo 80 caracteres." };
  if (modelCode && modelCode.length > 80) return { error: "O código do modelo deve ter no máximo 80 caracteres." };
  if (catalogCode && catalogCode.length > 80) return { error: "O código do produto deve ter no máximo 80 caracteres." };
  if (serialNumber && serialNumber.length > 100) return { error: "O número de série deve ter no máximo 100 caracteres." };
  if (connectorType && connectorType.length > 80) return { error: "O tipo de conector deve ter no máximo 80 caracteres." };
  if (connectorCount !== null && (!Number.isInteger(connectorCount) || connectorCount < 1 || connectorCount > 64)) return { error: "A quantidade de conectores deve ser um número entre 1 e 64." };
  if (installationPower !== null && (!Number.isFinite(installationPower) || installationPower <= 0)) return { error: "O limite configurado na instalação precisa ser maior que zero." };
  if (ocppVersion && !["1.6J", "2.0.1", "other", "unknown"].includes(ocppVersion)) return { error: "Selecione uma versão OCPP válida." };
  if (nominalVoltage && nominalVoltage.length > 120) return { error: "A tensão de alimentação deve ter no máximo 120 caracteres." };
  if (electricalPhases && electricalPhases.length > 80) return { error: "O tipo de alimentação deve ter no máximo 80 caracteres." };
  if (networkInterfaces.length > 12 || networkInterfaces.some((item) => item.length > 40 || /[\u0000-\u001f]/.test(item))) return { error: "Informe até 12 interfaces de rede com no máximo 40 caracteres cada." };
  if (!["", "yes", "no"].includes(hasRfid) || !["", "yes", "no"].includes(hasEnergyMeter) || !["", "yes", "no"].includes(hasDisplay)) return { error: "Selecione uma opção válida para os recursos do carregador." };
  if (authorizationMode && !["ocpp_server", "local_list", "always_authorized", "other"].includes(authorizationMode)) return { error: "Selecione um método de autorização válido." };
  if (maxPower !== null && (!Number.isFinite(maxPower) || maxPower <= 0)) return { error: "A potência precisa ser maior que zero." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Configure a conexão com o Supabase no arquivo apps/web/.env.local." }; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  if (await accessBlocked(supabase, organizationId)) return { error: blockedMessage };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin", "technician"].includes(membership.role)) {
    return { error: "Seu perfil não pode cadastrar carregadores nesta organização." };
  }

  const { data: site } = await supabase.from("sites").select("id").eq("id", siteId).eq("organization_id", organizationId).maybeSingle();
  if (!site) return { error: "O local selecionado não pertence a esta organização." };

  const credential = randomBytes(20).toString("hex");
  const credentialHash = createHash("sha256").update(credential, "utf8").digest("hex");
  const { error } = await supabase.from("chargers").insert({
    organization_id: organizationId,
    site_id: siteId,
    charge_point_id: chargePointId,
    vendor,
    model,
    model_code: modelCode,
    serial_number: serialNumber,
    connector_type: connectorType,
    connector_count: connectorCount,
    max_power_kw: maxPower,
    installation_power_kw: installationPower,
    ocpp_version: ocppVersion,
    technical_specs: {
      catalog_code: catalogCode,
      nominal_voltage: nominalVoltage,
      electrical_phases: electricalPhases,
      network_interfaces: [...new Set(networkInterfaces)],
      has_rfid: hasRfid === "" ? null : hasRfid === "yes",
      has_energy_meter: hasEnergyMeter === "" ? null : hasEnergyMeter === "yes",
      has_display: hasDisplay === "" ? null : hasDisplay === "yes",
      authorization_mode: authorizationMode,
    },
    ocpp_credential_hash: credentialHash,
  });
  if (error) {
    if (error.code === "23505") return { error: "Esse ID OCPP já está cadastrado. Cada carregador precisa de um ID globalmente único." };
    if (error.code === "42703" || error.code === "PGRST204" || error.message.includes("ocpp_credential_hash")) return { error: "A migration 006 de perfis de carregadores ainda precisa ser aplicada no Supabase." };
    return { error: "Não foi possível cadastrar o carregador. Confira as permissões e os dados." };
  }

  revalidatePath("/");
  return { success: "Carregador cadastrado.", credential, chargePointId };
}

export async function requestRemoteStart(organizationId: string, chargerId: string, _previous: FormState, _formData: FormData): Promise<FormState> {
  void _previous;
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(chargerId)) return { error: "Organização ou carregador inválido." };
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  if (await accessBlocked(supabase, organizationId)) return { error: blockedMessage };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin", "operator", "technician"].includes(membership.role)) {
    return { error: "Seu perfil não pode controlar carregadores nesta organização." };
  }
  const { data: charger } = await supabase.from("chargers").select("id, online, status, connector_count, last_heartbeat_at")
    .eq("id", chargerId).eq("organization_id", organizationId).is("removed_at", null).maybeSingle();
  if (!charger) return { error: "Carregador não encontrado nesta organização." };
  if (!charger.online || !chargerHasRecentHeartbeat(charger.last_heartbeat_at)) return { error: "O carregador está offline ou sem comunicação recente. Confira a conexão antes de pedir uma recarga." };
  const { data: connectors, error: connectorsError } = await supabase.from("connectors")
    .select("connector_id, status").eq("charger_id", chargerId).order("connector_id");
  if (connectorsError) return { error: "Não foi possível conferir o estado dos conectores." };
  const rawConnectorId = String(_formData.get("connector_id") ?? "").trim();
  let connectorId: number | null = rawConnectorId ? Number(rawConnectorId) : null;
  if (rawConnectorId && (!Number.isInteger(connectorId) || Number(connectorId) < 1)) return { error: "Selecione um conector válido." };
  const eligible = (connectors ?? []).filter((connector) => connector.connector_id >= 1 && ["Available", "Preparing"].includes(connector.status));
  if (connectorId !== null) {
    const connector = (connectors ?? []).find((item) => item.connector_id === connectorId);
    if (!connector || !["Available", "Preparing"].includes(connector.status)) return { error: "Este conector não está disponível para iniciar uma recarga." };
  } else if (eligible.length === 1) {
    connectorId = eligible[0].connector_id;
  } else if (eligible.length > 1) {
    return { error: "Selecione qual conector deve iniciar a recarga." };
  } else if (!connectors?.length && charger.connector_count === 1 && ["Available", "Preparing"].includes(charger.status)) {
    connectorId = 1;
  } else {
    return { error: "O carregador ainda não confirmou um conector disponível. Confira o estado no equipamento." };
  }
  const { data: activeSession, error: sessionError } = await supabase.from("sessions").select("id")
    .eq("charger_id", chargerId).eq("connector_id", connectorId).is("ended_at", null).maybeSingle();
  if (sessionError) return { error: "Não foi possível conferir as sessões deste carregador." };
  if (activeSession) return { error: "Este conector já tem uma recarga em andamento." };

  const { data: pendingStarts, error: pendingError } = await supabase.from("commands").select("payload")
    .eq("charger_id", chargerId).eq("action", "RemoteStartTransaction")
    .in("status", ["pending", "sent", "accepted", "unknown"]);
  if (pendingError) return { error: "Não foi possível conferir pedidos de início anteriores." };
  const connectorHasPendingStart = (pendingStarts ?? []).some((command) => {
    const pendingConnectorId = typeof command.payload?.connectorId === "number" ? command.payload.connectorId : null;
    return pendingConnectorId === null || pendingConnectorId === connectorId;
  });
  if (connectorHasPendingStart) return { error: "Já existe um pedido de início pendente para este conector. Aguarde a confirmação antes de tentar novamente." };

  const idTag = `TK${randomBytes(9).toString("hex")}`;
  const { error } = await supabase.from("commands").insert({
    organization_id: organizationId,
    charger_id: chargerId,
    action: "RemoteStartTransaction",
    payload: { idTag, ...(connectorId === null ? {} : { connectorId }) },
    operation_key: `start:${connectorId ?? "*"}`,
    requested_by: user.id,
  });
  if (error?.code === "23505") return { error: "Já existe uma solicitação de início em andamento para este carregador." };
  if (error) return { error: "Não foi possível enfileirar o pedido. Atualize a página e tente novamente." };
  revalidatePath("/");
  return { success: "Pedido enviado à fila. A recarga aparecerá após a confirmação do carregador e o início da transação OCPP." };
}

export async function requestGetConfiguration(organizationId: string, chargerId: string, _previous: FormState, _formData: FormData): Promise<FormState> {
  void _previous;
  void _formData;
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(chargerId)) return { error: "Organização ou carregador inválido." };
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin", "technician"].includes(membership.role)) return { error: "Somente owners, admins e técnicos podem consultar configurações OCPP." };
  const { data: charger } = await supabase.from("chargers").select("id, online, last_heartbeat_at")
    .eq("id", chargerId).eq("organization_id", organizationId).is("removed_at", null).maybeSingle();
  if (!charger) return { error: "Carregador não encontrado nesta organização." };
  if (!charger.online || !chargerHasRecentHeartbeat(charger.last_heartbeat_at)) return { error: "O carregador está offline ou sem comunicação recente." };
  const { error } = await supabase.from("commands").insert({
    organization_id: organizationId, charger_id: chargerId, action: "GetConfiguration",
    payload: { key: ["AuthorizeRemoteTxRequests"] }, requested_by: user.id,
  });
  if (error) return { error: "Não foi possível enfileirar a consulta OCPP." };
  revalidatePath("/");
  return { success: "Consulta de configuração enviada. O resultado aparecerá no diagnóstico do carregador." };
}

export async function registerRfidAuthorization(organizationId: string, chargerId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  const idTag = String(formData.get("id_tag") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(chargerId)) return { error: "Organização ou carregador inválido." };
  if (!idTag || idTag.length > 20 || /[\u0000-\u001f]/.test(idTag)) return { error: "Informe o identificador do cartão RFID (máximo de 20 caracteres)." };
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin", "technician"].includes(membership.role)) return { error: "Seu perfil não pode autorizar cartões RFID nesta organização." };
  const { data: activeCharger } = await supabase.from("chargers").select("id")
    .eq("id", chargerId).eq("organization_id", organizationId).is("removed_at", null).maybeSingle();
  if (!activeCharger) return { error: "Este carregador foi removido e não aceita novas autorizações." };
  const { error } = await supabase.from("charger_authorizations").insert({
    organization_id: organizationId, charger_id: chargerId, user_id: user.id,
    id_tag_hash: createHash("sha256").update(idTag, "utf8").digest("hex"), authorization_type: "RFID", created_by: user.id,
  });
  if (error?.code === "23505") return { error: "Este cartão já está autorizado para este carregador." };
  if (error) return { error: "Não foi possível autorizar o cartão. Confira as migrations e tente novamente." };
  revalidatePath("/");
  return { success: "Cartão autorizado. O valor do RFID foi armazenado somente como hash." };
}

export async function revokeRfidAuthorization(organizationId: string, chargerId: string, authorizationId: string, _previous: FormState, _formData: FormData): Promise<FormState> {
  void _previous;
  void _formData;
  if (![organizationId, chargerId, authorizationId].every((value) => /^[0-9a-f-]{36}$/i.test(value))) return { error: "Organização, carregador ou autorização inválida." };
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin", "technician"].includes(membership.role)) return { error: "Seu perfil não pode revogar cartões RFID nesta organização." };
  const { error } = await supabase.from("charger_authorizations").update({ enabled: false })
    .eq("id", authorizationId).eq("charger_id", chargerId).eq("organization_id", organizationId);
  if (error) return { error: "Não foi possível revogar esta autorização." };
  revalidatePath("/");
  return { success: "Autorização do cartão revogada." };
}

export async function removeCharger(organizationId: string, chargerId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(chargerId)) return { error: "Organização ou carregador inválido." };
  const confirmation = String(formData.get("confirm_charge_point_id") ?? "").trim();
  if (!confirmation || confirmation.length > 64) return { error: "Digite o ID OCPP para confirmar a remoção." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (membership?.role !== "owner") return { error: "Somente o dono da organização pode remover carregadores." };
  const { data: charger, error: chargerError } = await supabase.from("chargers")
    .select("id, charge_point_id, removed_at").eq("id", chargerId).eq("organization_id", organizationId).maybeSingle();
  if (chargerError || !charger) return { error: "Carregador não encontrado nesta organização." };
  if (charger.removed_at) return { error: "Este carregador já foi removido." };
  if (confirmation !== charger.charge_point_id) return { error: "O ID digitado não corresponde ao carregador." };

  const { error } = await supabase.rpc("remove_charger", { p_organization_id: organizationId, p_charger_id: chargerId });
  if (error) {
    if (error.message.includes("ACTIVE_SESSION")) return { error: "Pare a recarga antes de remover." };
    if (error.message.includes("OWNER_REQUIRED")) return { error: "Somente o dono da organização pode remover carregadores." };
    if (error.message.includes("CHARGER_NOT_FOUND")) return { error: "Carregador não encontrado nesta organização." };
    if (error.code === "PGRST202" || error.message.includes("remove_charger")) return { error: "A migration de remoção e restauração de carregadores ainda precisa ser aplicada no Supabase." };
    return { error: "Não foi possível remover o carregador. Atualize a página e tente novamente." };
  }
  revalidatePath("/");
  return { success: "Carregador removido. As sessões e medições antigas foram preservadas." };
}

export async function restoreCharger(organizationId: string, chargerId: string, _previous: FormState, _formData: FormData): Promise<FormState> {
  void _previous;
  void _formData;
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(chargerId)) return { error: "Organização ou carregador inválido." };
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (membership?.role !== "owner") return { error: "Somente o dono da organização pode restaurar carregadores." };
  const { data: charger, error: chargerError } = await supabase.from("chargers")
    .select("id, charge_point_id, removed_at").eq("id", chargerId).eq("organization_id", organizationId).maybeSingle();
  if (chargerError || !charger?.removed_at) return { error: "Carregador removido não encontrado nesta organização." };
  if (Date.now() - new Date(charger.removed_at).getTime() > 30 * 24 * 60 * 60 * 1000) return { error: "O prazo de restauração de 30 dias expirou." };

  const credential = randomBytes(20).toString("hex");
  const credentialHash = createHash("sha256").update(credential, "utf8").digest("hex");
  const { error } = await supabase.rpc("restore_charger", {
    p_organization_id: organizationId, p_charger_id: chargerId, p_credential_hash: credentialHash,
  });
  if (error) {
    if (error.code === "23505") return { error: "Já existe um carregador ativo com este ID OCPP. Remova-o antes de restaurar este cadastro." };
    if (error.message.includes("RESTORE_WINDOW_EXPIRED")) return { error: "O prazo de restauração de 30 dias expirou." };
    if (error.message.includes("OWNER_REQUIRED")) return { error: "Somente o dono da organização pode restaurar carregadores." };
    if (error.code === "PGRST202" || error.message.includes("restore_charger")) return { error: "A migration de remoção e restauração de carregadores ainda precisa ser aplicada no Supabase." };
    return { error: "Não foi possível restaurar o carregador. Atualize a página e tente novamente." };
  }
  return { success: "Carregador restaurado. A credencial anterior continua revogada.", credential, chargePointId: charger.charge_point_id };
}

export async function rotateChargerCredential(organizationId: string, chargerId: string, _previous: FormState, _formData: FormData): Promise<FormState> {
  void _previous;
  void _formData;
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(chargerId)) return { error: "Organização ou carregador inválido." };
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (membership?.role !== "owner") return { error: "Somente o dono da organização pode gerar uma nova credencial." };
  const { data: charger, error: chargerError } = await supabase.from("chargers").select("charge_point_id")
    .eq("id", chargerId).eq("organization_id", organizationId).is("removed_at", null).maybeSingle();
  if (chargerError || !charger) return { error: "Carregador não encontrado ou já removido nesta organização." };
  const credential = randomBytes(20).toString("hex");
  const credentialHash = createHash("sha256").update(credential, "utf8").digest("hex");
  const { error } = await supabase.rpc("rotate_charger_credential", {
    p_organization_id: organizationId, p_charger_id: chargerId, p_credential_hash: credentialHash,
  });
  if (error) {
    if (error.message.includes("OWNER_REQUIRED")) return { error: "Somente o dono da organização pode gerar uma nova credencial." };
    if (error.message.includes("CHARGER_NOT_FOUND")) return { error: "Carregador não encontrado nesta organização." };
    if (error.message.includes("CHARGER_REMOVED")) return { error: "Restaure o carregador antes de gerar uma nova credencial." };
    if (error.code === "PGRST202" || error.message.includes("rotate_charger_credential")) return { error: "A nova migration de credenciais ainda precisa ser aplicada no Supabase." };
    return { error: "Não foi possível gerar a nova credencial. Atualize a página e tente novamente." };
  }
  revalidatePath("/");
  return { success: "Nova credencial gerada. A anterior foi invalidada.", credential, chargePointId: charger.charge_point_id };
}

export async function requestRemoteStop(organizationId: string, sessionId: string, _previous: FormState, _formData: FormData): Promise<FormState> {
  void _previous;
  void _formData;
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(sessionId)) return { error: "Organização ou sessão inválida." };
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin", "operator", "technician"].includes(membership.role)) {
    return { error: "Seu perfil não pode controlar carregadores nesta organização." };
  }
  const { data: session, error: sessionError } = await supabase.from("sessions")
    .select("id, charger_id, ocpp_transaction_id").eq("id", sessionId).eq("organization_id", organizationId).is("ended_at", null).maybeSingle();
  if (sessionError || !session) return { error: "Recarga ativa não encontrada." };
  if (!Number.isInteger(Number(session.ocpp_transaction_id)) || Number(session.ocpp_transaction_id) < 1) {
    return { error: "Esta recarga não tem um identificador OCPP válido para solicitar a parada." };
  }
  const { data: charger } = await supabase.from("chargers").select("online, last_heartbeat_at")
    .eq("id", session.charger_id).eq("organization_id", organizationId).is("removed_at", null).maybeSingle();
  if (!charger?.online || !chargerHasRecentHeartbeat(charger.last_heartbeat_at)) return { error: "O carregador está offline ou sem comunicação recente; não é possível enviar o pedido de parada." };

  const { data: pendingStop, error: pendingStopError } = await supabase.from("commands").select("id")
    .eq("charger_id", session.charger_id).eq("action", "RemoteStopTransaction")
    .filter("payload->>transactionId", "eq", String(session.ocpp_transaction_id))
    .in("status", ["pending", "sent", "accepted", "unknown"]).limit(1).maybeSingle();
  if (pendingStopError) return { error: "Não foi possível conferir pedidos de parada anteriores." };
  if (pendingStop) return { error: "Já existe um pedido de parada pendente para esta recarga." };

  const { error } = await supabase.from("commands").insert({
    organization_id: organizationId,
    charger_id: session.charger_id,
    action: "RemoteStopTransaction",
    payload: { transactionId: Number(session.ocpp_transaction_id) },
    operation_key: `stop:${session.ocpp_transaction_id}`,
    requested_by: user.id,
  });
  if (error?.code === "23505") return { error: "Já existe um pedido de parada pendente para esta recarga." };
  if (error) return { error: "Não foi possível enfileirar o pedido. Atualize a página e tente novamente." };
  revalidatePath("/");
  return { success: "Pedido enviado à fila. A recarga só será encerrada quando o carregador confirmar e enviar StopTransaction." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}


const uuidPattern = /^[0-9a-f-]{36}$/i;

export async function createResidentInvite(organizationId: string): Promise<{ error?: string; code?: string }> {
  if (!uuidPattern.test(organizationId)) return { error: "Organização inválida." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_resident_invite", { p_organization_id: organizationId });
  if (error) return { error: "Não foi possível criar o convite. Só a pessoa responsável pelo condomínio pode convidar moradores." };
  revalidatePath("/");
  return { code: String(data) };
}

export async function revokeResidentInvite(inviteId: string): Promise<{ error?: string }> {
  if (!uuidPattern.test(inviteId)) return { error: "Convite inválido." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_resident_invite", { p_invite_id: inviteId });
  if (error) return { error: "Não foi possível revogar o convite." };
  revalidatePath("/");
  return {};
}

export async function removeResident(organizationId: string, userId: string): Promise<{ error?: string }> {
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(userId)) return { error: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_resident", { p_organization_id: organizationId, p_user_id: userId });
  if (error) return { error: "Não foi possível remover o morador." };
  revalidatePath("/");
  return {};
}

export async function startSubscription(_previous: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get("organization_id") ?? "");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return { error: "Só o responsável da conta pode assinar." };
  if (!mercadoPagoConfigured()) return { error: "Pagamento online indisponível no momento." };
  const { data: orgRow } = await supabase.from("organizations").select("subscription_status, trial_ends_at")
    .eq("id", organizationId).maybeSingle();
  const trialEndsAt = orgRow?.subscription_status === "trialing" ? (orgRow.trial_ends_at as string | null) : null;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return { error: "Não foi possível iniciar a assinatura." };
  let checkoutUrl: string;
  try {
    checkoutUrl = await createSubscriptionCheckoutUrl({ organizationId, origin: `https://${host}`, payerEmail: user.email ?? "", trialEndsAt });
  } catch (caught) {
    return { error: `Não foi possível abrir o pagamento agora. Tente novamente em instantes. (${caught instanceof Error ? caught.message : "erro"})` };
  }
  redirect(checkoutUrl);
}
