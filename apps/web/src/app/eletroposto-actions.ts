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
