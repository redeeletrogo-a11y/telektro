"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/workspace-actions";

export type StatementRow = { user_id: string; email: string; sessions: number; kwh: number; amount: number };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDecimal(value: FormDataEntryValue | null) {
  return Number(String(value ?? "").trim().replace(",", "."));
}

// Saves the condo tariff (kWh price + optional per-session fee). The previous one is closed, so old charges keep their own price.
export async function saveCondoTariff(organizationId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  if (!uuidPattern.test(organizationId)) return { error: "Conta inválida." };
  const price = parseDecimal(formData.get("price_per_kwh"));
  const fee = formData.get("session_fee") === "" ? 0 : parseDecimal(formData.get("session_fee"));
  if (!Number.isFinite(price) || price <= 0 || price > 20) return { error: "Informe o valor do kWh entre R$ 0,01 e R$ 20,00." };
  if (!Number.isFinite(fee) || fee < 0 || fee > 50) return { error: "A taxa por sessão deve ficar entre R$ 0,00 e R$ 50,00." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  const { data: org } = await supabase.from("organizations").select("account_type").eq("id", organizationId).maybeSingle();
  if (org?.account_type !== "condominio") return { error: "A tarifa por kWh vale para contas de condomínio." };
  const { data: created, error } = await supabase.from("tariffs").insert({
    organization_id: organizationId, name: "Tarifa do condomínio", price_per_kwh: Math.round(price * 10000) / 10000, session_fee: Math.round(fee * 100) / 100,
  }).select("id").single();
  if (error || !created) return { error: "Não foi possível salvar. Só o responsável da conta pode alterar a tarifa." };
  await supabase.from("tariffs").update({ active: false, valid_until: new Date().toISOString() })
    .eq("organization_id", organizationId).eq("active", true).is("site_id", null).neq("id", created.id);
  revalidatePath("/");
  return { success: "Tarifa salva. Vale para as próximas recargas." };
}

export async function getStatement(organizationId: string, month: string): Promise<{ error?: string; rows?: StatementRow[] }> {
  if (!uuidPattern.test(organizationId) || !/^\d{4}-\d{2}$/.test(month)) return { error: "Mês inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("condo_statement", { p_organization_id: organizationId, p_month: `${month}-01` });
  if (error) return { error: "Não foi possível carregar o extrato." };
  return { rows: (data ?? []).map((row: { user_id: string; email: string; sessions: number; kwh: string | number; amount: string | number }) => ({ user_id: row.user_id, email: row.email, sessions: Number(row.sessions), kwh: Number(row.kwh), amount: Number(row.amount) })) };
}

export type ChargerSummaryRow = { charger_id: string; charge_point_id: string; sessions: number; kwh: number; amount: number };

export async function getChargersSummary(organizationId: string, month: string): Promise<{ error?: string; rows?: ChargerSummaryRow[] }> {
  if (!uuidPattern.test(organizationId) || !/^\d{4}-\d{2}$/.test(month)) return { error: "Mês inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("condo_chargers_summary", { p_organization_id: organizationId, p_month: `${month}-01` });
  if (error) return { error: "Não foi possível carregar o resumo." };
  return { rows: (data ?? []).map((row: { charger_id: string; charge_point_id: string; sessions: number; kwh: string | number; amount: string | number }) => ({ charger_id: row.charger_id, charge_point_id: row.charge_point_id, sessions: Number(row.sessions), kwh: Number(row.kwh), amount: Number(row.amount) })) };
}

const tagUuid = /^[0-9a-f-]{36}$/i;

export async function registerResidentTag(organizationId: string, userId: string, idTagRaw: string, label: string): Promise<{ error?: string }> {
  const idTag = idTagRaw.trim();
  if (!tagUuid.test(organizationId) || !tagUuid.test(userId)) return { error: "Dados inválidos." };
  if (!idTag || idTag.length > 20 || /[\u0000-\u001f]/.test(idTag)) return { error: "Informe o identificador do cartão (máximo de 20 caracteres)." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("register_resident_tag", {
    p_organization_id: organizationId, p_user_id: userId,
    p_id_tag_hash: createHash("sha256").update(idTag, "utf8").digest("hex"), p_label: label.trim().slice(0, 60),
  });
  if (error) {
    if (error.message.includes("TAG_IN_USE")) return { error: "Este cartão já está em uso neste condomínio." };
    if (error.message.includes("TAG_LIMIT")) return { error: "Limite de 5 cartões por morador." };
    if (error.message.includes("NOT_RESIDENT")) return { error: "Este usuário não é morador do condomínio." };
    return { error: "Não foi possível cadastrar o cartão." };
  }
  revalidatePath("/");
  return {};
}

export async function revokeResidentTag(tagId: string): Promise<{ error?: string }> {
  if (!tagUuid.test(tagId)) return { error: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_resident_tag", { p_tag_id: tagId });
  if (error) return { error: "Não foi possível revogar o cartão." };
  revalidatePath("/");
  return {};
}
