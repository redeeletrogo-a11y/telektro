"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/pix";
import type { FormState } from "@/app/workspace-actions";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (value: FormDataEntryValue | null) => Number(String(value ?? "").trim().replace(",", "."));

// Confere que quem chama e dono/admin de uma conta Eletroposto. A leitura usa o login do usuario (RLS).
async function requireOwner(organizationId: string) {
  if (!uuidPattern.test(organizationId)) return { error: "Conta inválida." } as const;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." } as const;
  const [{ data: membership }, { data: org }] = await Promise.all([
    supabase.from("memberships").select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle(),
    supabase.from("organizations").select("account_type").eq("id", organizationId).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role)) return { error: "Só o responsável da conta pode fazer isso." } as const;
  if (org?.account_type !== "eletroposto") return { error: "Disponível só para contas Eletroposto." } as const;
  return { supabase } as const;
}

// Gera o QR (ponto de recarga publico) de um carregador. 1 conector por carregador por enquanto.
export async function createChargingPoint(organizationId: string, chargerId: string): Promise<FormState> {
  const auth = await requireOwner(organizationId);
  if ("error" in auth) return { error: auth.error };
  if (!uuidPattern.test(chargerId)) return { error: "Carregador inválido." };
  const { data: charger } = await auth.supabase.from("chargers").select("id").eq("id", chargerId).eq("organization_id", organizationId).is("removed_at", null).maybeSingle();
  if (!charger) return { error: "Carregador não encontrado." };
  const service = serviceClient();
  const { data: existing } = await service.from("eletroposto_points").select("id").eq("charger_id", chargerId).eq("connector_id", 1).maybeSingle();
  if (existing) return { success: "Esse carregador já tem QR." };
  const { error } = await service.from("eletroposto_points").insert({
    public_code: randomBytes(8).toString("hex"), organization_id: organizationId, charger_id: chargerId, connector_id: 1, enabled: true,
  });
  if (error) return { error: "Não foi possível gerar o QR agora. Tente de novo." };
  revalidatePath("/");
  return { success: "QR criado e ativo." };
}

export async function setPointEnabled(organizationId: string, pointId: string, enabled: boolean): Promise<FormState> {
  const auth = await requireOwner(organizationId);
  if ("error" in auth) return { error: auth.error };
  if (!uuidPattern.test(pointId)) return { error: "Ponto inválido." };
  const { error } = await serviceClient().from("eletroposto_points").update({ enabled }).eq("id", pointId).eq("organization_id", organizationId);
  if (error) return { error: "Não foi possível alterar agora." };
  revalidatePath("/");
  return { success: enabled ? "QR ativado: clientes já podem pagar." : "QR pausado: ninguém consegue pagar até reativar." };
}

// Valores minimo e maximo da recarga deste QR.
export async function savePointLimits(organizationId: string, pointId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  const auth = await requireOwner(organizationId);
  if ("error" in auth) return { error: auth.error };
  if (!uuidPattern.test(pointId)) return { error: "Ponto inválido." };
  const min = num(formData.get("min_amount"));
  const max = num(formData.get("max_amount"));
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 5 || max < min || max > 500) return { error: "Mínimo a partir de R$ 5 e máximo até R$ 500 (máximo maior que o mínimo)." };
  const { error } = await serviceClient().from("eletroposto_points").update({ min_amount: Math.round(min * 100) / 100, max_amount: Math.round(max * 100) / 100 }).eq("id", pointId).eq("organization_id", organizationId);
  if (error) return { error: "Não foi possível salvar agora." };
  revalidatePath("/");
  return { success: "Valores salvos." };
}

// Tarifa (R$/kWh) valida para todos os carregadores da conta. A anterior e encerrada; recargas ja feitas mantem o preco delas.
export async function saveEletropostoTariff(organizationId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  const auth = await requireOwner(organizationId);
  if ("error" in auth) return { error: auth.error };
  const price = num(formData.get("price_per_kwh"));
  if (!Number.isFinite(price) || price < 0.5 || price > 20) return { error: "Informe o valor do kWh entre R$ 0,50 e R$ 20,00." };
  const { data: created, error } = await auth.supabase.from("tariffs").insert({
    organization_id: organizationId, name: "Tarifa do eletroposto", price_per_kwh: Math.round(price * 10000) / 10000, session_fee: 0,
  }).select("id").single();
  if (error || !created) return { error: "Não foi possível salvar a tarifa." };
  await auth.supabase.from("tariffs").update({ active: false, valid_until: new Date().toISOString() })
    .eq("organization_id", organizationId).eq("active", true).is("site_id", null).neq("id", created.id);
  revalidatePath("/");
  return { success: "Tarifa salva. Vale para as próximas recargas." };
}

export type SalesPeriod = "hoje" | "7d" | "30d" | "mes";
export type SalesRow = { id: string; at: string; charger: string; payer: string; method: string; reserved: number; charged: number; kwh: number; fee: number; status: string; label: string };
export type SalesSummary = {
  sold: { count: number; kwh: number; gross: number; fee: number; net: number };
  notSold: { count: number; expired: number; refundedFull: number; failed: number };
  inProgress: number; attention: number;
  byCharger: { charger: string; count: number; kwh: number; gross: number; net: number }[];
};
export type SalesResult = { error?: string; summary?: SalesSummary; rows?: SalesRow[]; from?: string; truncated?: boolean };

const TZ_OFFSET = "-03:00"; // America/Fortaleza (sem horario de verao)

function periodStart(period: SalesPeriod) {
  const nowLocal = new Date(Date.now() - 3 * 3600_000);
  const day = nowLocal.toISOString().slice(0, 10);
  if (period === "hoje") return new Date(`${day}T00:00:00${TZ_OFFSET}`);
  if (period === "mes") return new Date(`${day.slice(0, 8)}01T00:00:00${TZ_OFFSET}`);
  const days = period === "7d" ? 6 : 29;
  return new Date(new Date(`${day}T00:00:00${TZ_OFFSET}`).getTime() - days * 86_400_000);
}

const activeStatuses = ["awaiting_payment", "paid", "starting", "charging", "settling"];

function labelFor(row: { status: string; charged_amount: number | null; refund_reason: string | null; needs_attention: boolean | null }) {
  if (row.needs_attention || row.status === "review") return "Precisa de atenção";
  if (row.status === "settled") {
    if (Number(row.charged_amount ?? 0) > 0) return "Vendido";
    if (row.refund_reason === "start_rejected") return "Devolvido: carregador não iniciou";
    return "Devolvido sem consumo";
  }
  if (row.status === "expired") return "Não pago / recusado";
  if (activeStatuses.includes(row.status)) return "Em andamento";
  return row.status;
}

// Vendas do eletroposto: so dono/admin da conta. Leitura com a chave de servidor, sempre filtrada pela conta.
export async function getEletropostoSales(organizationId: string, period: SalesPeriod): Promise<SalesResult> {
  const auth = await requireOwner(organizationId);
  if ("error" in auth) return { error: auth.error };
  if (!["hoje", "7d", "30d", "mes"].includes(period)) return { error: "Período inválido." };
  const from = periodStart(period);
  const service = serviceClient();
  const limit = 1000;
  const [{ data, error }, { data: chargerRows }] = await Promise.all([
    service.from("eletroposto_payments")
      .select("id, created_at, charger_id, payer_name, payment_method, cap_amount, status, charged_amount, refund_reason, energy_wh, fee_amount, needs_attention")
      .eq("organization_id", organizationId).gte("created_at", from.toISOString()).order("created_at", { ascending: false }).limit(limit),
    service.from("chargers").select("id, charge_point_id").eq("organization_id", organizationId),
  ]);
  if (error) return { error: "Não foi possível carregar as vendas agora." };
  const names = new Map((chargerRows ?? []).map((row) => [row.id as string, row.charge_point_id as string]));
  const summary: SalesSummary = { sold: { count: 0, kwh: 0, gross: 0, fee: 0, net: 0 }, notSold: { count: 0, expired: 0, refundedFull: 0, failed: 0 }, inProgress: 0, attention: 0, byCharger: [] };
  const per = new Map<string, { charger: string; count: number; kwh: number; gross: number; net: number }>();
  const rows: SalesRow[] = [];
  for (const row of data ?? []) {
    const charged = Number(row.charged_amount ?? 0);
    const fee = Number(row.fee_amount ?? 0);
    const kwh = Number(row.energy_wh ?? 0) / 1000;
    const charger = names.get(row.charger_id as string) ?? "Carregador";
    if (row.needs_attention || row.status === "review") summary.attention += 1;
    if (row.status === "settled" && charged > 0) {
      summary.sold.count += 1; summary.sold.kwh += kwh; summary.sold.gross += charged; summary.sold.fee += fee; summary.sold.net += charged - fee;
      const item = per.get(charger) ?? { charger, count: 0, kwh: 0, gross: 0, net: 0 };
      item.count += 1; item.kwh += kwh; item.gross += charged; item.net += charged - fee; per.set(charger, item);
    } else if (row.status === "settled") {
      summary.notSold.count += 1;
      if (row.refund_reason === "start_rejected") summary.notSold.failed += 1; else summary.notSold.refundedFull += 1;
    } else if (row.status === "expired") { summary.notSold.count += 1; summary.notSold.expired += 1; }
    else if (activeStatuses.includes(row.status as string)) summary.inProgress += 1;
    rows.push({
      id: row.id as string, at: row.created_at as string, charger, payer: String(row.payer_name ?? "").split(" ")[0], method: row.payment_method === "card" ? "Cartão" : "Pix",
      reserved: Number(row.cap_amount ?? 0), charged, kwh, fee,
      status: row.status as string, label: labelFor({ status: row.status as string, charged_amount: row.charged_amount as number | null, refund_reason: row.refund_reason as string | null, needs_attention: row.needs_attention as boolean | null }),
    });
  }
  summary.byCharger = [...per.values()].sort((a, b) => b.gross - a.gross);
  const round = (n: number) => Math.round(n * 100) / 100;
  summary.sold.gross = round(summary.sold.gross); summary.sold.fee = round(summary.sold.fee); summary.sold.net = round(summary.sold.net); summary.sold.kwh = Math.round(summary.sold.kwh * 100) / 100;
  return { summary, rows, from: from.toISOString(), truncated: (data?.length ?? 0) >= limit };
}
