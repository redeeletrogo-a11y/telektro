"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/workspace-actions";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const messages: Record<string, string> = {
  AUTH_REQUIRED: "Sua sessão expirou. Entre novamente para continuar.",
  CHARGER_NOT_FOUND: "Carregador não encontrado.",
  FORBIDDEN: "Você não tem permissão para controlar este carregador.",
  NOT_CONDOMINIO: "Esta função é só para moradores de condomínio.",
  ACCESS_BLOCKED: "O acesso do condomínio está suspenso. Fale com a pessoa responsável.",
  NO_TARIFF: "O condomínio ainda não definiu a tarifa. Fale com a pessoa responsável.",
  CHARGER_OFFLINE: "O carregador está offline ou sem comunicação recente. Tente novamente em instantes.",
  ALREADY_CHARGING: "Você já tem uma recarga em andamento ou um pedido pendente.",
  CONNECTOR_UNAVAILABLE: "Este conector não está disponível. Confira se o carro está conectado ao carregador.",
  CHOOSE_CONNECTOR: "Escolha qual conector você quer usar.",
  CONNECTOR_BUSY: "Este conector já está em uso.",
  START_PENDING: "Já existe um pedido de início para este carregador. Aguarde a confirmação.",
  SESSION_NOT_FOUND: "Recarga em andamento não encontrada.",
  STOP_PENDING: "Já existe um pedido de parada para esta recarga.",
};

function friendly(error: { message?: string } | null) {
  const code = Object.keys(messages).find((key) => error?.message?.includes(key));
  return code ? messages[code] : "Não foi possível enviar o pedido. Atualize a página e tente novamente.";
}

export async function residentStartCharge(chargerId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  if (!uuidPattern.test(chargerId)) return { error: "Carregador inválido." };
  const rawConnector = String(formData.get("connector_id") ?? "").trim();
  const connectorId = rawConnector ? Number(rawConnector) : null;
  if (connectorId !== null && (!Number.isInteger(connectorId) || connectorId < 1 || connectorId > 99)) return { error: "Conector inválido." };
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { error } = await supabase.rpc("resident_request_start", { p_charger_id: chargerId, p_connector_id: connectorId });
  if (error) return { error: friendly(error) };
  revalidatePath("/");
  return { success: "Pedido enviado. Mantenha o carro conectado: a recarga aparece aqui assim que o carregador confirmar." };
}

export async function residentStopCharge(sessionId: string, _previous: FormState, _formData: FormData): Promise<FormState> {
  void _previous;
  void _formData;
  if (!uuidPattern.test(sessionId)) return { error: "Recarga inválida." };
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "Não foi possível conectar ao Supabase." }; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };
  const { error } = await supabase.rpc("resident_request_stop", { p_session_id: sessionId });
  if (error) return { error: friendly(error) };
  revalidatePath("/");
  return { success: "Pedido de parada enviado. A recarga termina quando o carregador confirmar." };
}
