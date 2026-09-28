"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { error?: string; success?: string; credential?: string; chargePointId?: string };

export async function createOrganization(_previous: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (name.length < 1 || name.length > 120) return { error: "O nome deve ter entre 1 e 120 caracteres." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: "Use letras minúsculas, números e hífens no identificador." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Configure a conexão com o Supabase no arquivo apps/web/.env.local." }; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };

  const { error } = await supabase.rpc("create_organization_with_owner", { p_name: name, p_slug: slug });
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
  if (timezone.length < 1 || timezone.length > 100) return { error: "Informe um fuso horário válido." };
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
  const rawPower = String(formData.get("max_power_kw") ?? "").trim();
  const maxPower = rawPower ? Number(rawPower) : null;

  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(siteId)) return { error: "Selecione um local válido." };
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(chargePointId)) return { error: "Use de 1 a 64 letras, números, pontos, hífens ou sublinhados no ID OCPP." };
  if (vendor && vendor.length > 50) return { error: "O fabricante deve ter no máximo 50 caracteres." };
  if (model && model.length > 50) return { error: "O modelo deve ter no máximo 50 caracteres." };
  if (maxPower !== null && (!Number.isFinite(maxPower) || maxPower <= 0)) return { error: "A potência precisa ser maior que zero." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Configure a conexão com o Supabase no arquivo apps/web/.env.local." }; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { data: membership } = await supabase.from("memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin", "technician"].includes(membership.role)) {
    return { error: "Seu perfil não pode cadastrar carregadores nesta organização." };
  }

  const { data: site } = await supabase.from("sites").select("id").eq("id", siteId).eq("organization_id", organizationId).maybeSingle();
  if (!site) return { error: "O local selecionado não pertence a esta organização." };

  const credential = randomBytes(32).toString("base64url");
  const credentialHash = createHash("sha256").update(credential, "utf8").digest("hex");
  const { error } = await supabase.from("chargers").insert({
    organization_id: organizationId,
    site_id: siteId,
    charge_point_id: chargePointId,
    vendor,
    model,
    max_power_kw: maxPower,
    ocpp_credential_hash: credentialHash,
  });
  if (error) {
    if (error.code === "23505") return { error: "Esse ID OCPP já está cadastrado. Cada carregador precisa de um ID globalmente único." };
    if (error.code === "42703" || error.code === "PGRST204" || error.message.includes("ocpp_credential_hash")) return { error: "A migration de credenciais OCPP ainda precisa ser aplicada no Supabase." };
    return { error: "Não foi possível cadastrar o carregador. Confira as permissões e os dados." };
  }

  revalidatePath("/");
  return { success: "Carregador cadastrado.", credential, chargePointId };
}

export async function requestRemoteStart(organizationId: string, chargerId: string, _previous: FormState, _formData: FormData): Promise<FormState> {
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
  if (!membership || !["owner", "admin", "operator", "technician"].includes(membership.role)) {
    return { error: "Seu perfil não pode controlar carregadores nesta organização." };
  }
  const { data: charger } = await supabase.from("chargers").select("id, online")
    .eq("id", chargerId).eq("organization_id", organizationId).maybeSingle();
  if (!charger) return { error: "Carregador não encontrado nesta organização." };
  if (!charger.online) return { error: "O carregador está offline. Conecte-o ao gateway antes de pedir uma recarga." };
  const { data: activeSession, error: sessionError } = await supabase.from("sessions").select("id")
    .eq("charger_id", chargerId).is("ended_at", null).maybeSingle();
  if (sessionError) return { error: "Não foi possível conferir as sessões deste carregador." };
  if (activeSession) return { error: "Este carregador já tem uma recarga em andamento." };

  const idTag = `TK${randomBytes(9).toString("hex")}`;
  const { error } = await supabase.from("commands").insert({
    organization_id: organizationId,
    charger_id: chargerId,
    action: "RemoteStartTransaction",
    payload: { idTag },
    requested_by: user.id,
  });
  if (error) return { error: "Não foi possível enfileirar o pedido. Atualize a página e tente novamente." };
  revalidatePath("/");
  return { success: "Pedido enviado à fila. A recarga aparecerá após a confirmação do carregador e o início da transação OCPP." };
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
  const { data: charger } = await supabase.from("chargers").select("online")
    .eq("id", session.charger_id).eq("organization_id", organizationId).maybeSingle();
  if (!charger?.online) return { error: "O carregador está offline; não é possível enviar o pedido de parada." };

  const { error } = await supabase.from("commands").insert({
    organization_id: organizationId,
    charger_id: session.charger_id,
    action: "RemoteStopTransaction",
    payload: { transactionId: Number(session.ocpp_transaction_id) },
    requested_by: user.id,
  });
  if (error) return { error: "Não foi possível enfileirar o pedido. Atualize a página e tente novamente." };
  revalidatePath("/");
  return { success: "Pedido enviado à fila. A recarga só será encerrada quando o carregador confirmar e enviar StopTransaction." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
