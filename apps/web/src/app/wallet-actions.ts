"use server";

import { headers } from "next/headers";
import { mercadoPagoConfigured } from "@/lib/billing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createWalletTopup, syncPendingTopups, type WalletTopup } from "@/lib/wallet";

export type TopupState = { error?: string; topup?: WalletTopup };

async function residentOf(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." } as const;
  const { data: membership } = await supabase.from("memberships").select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership) return { error: "Você não faz parte desta conta." } as const;
  return { user } as const;
}

export async function createTopup(_previous: TopupState, formData: FormData): Promise<TopupState> {
  const organizationId = String(formData.get("organization_id") ?? "");
  const amountCents = Math.round(Number(formData.get("amount_reais") ?? 0)) * 100;
  const who = await residentOf(organizationId);
  if ("error" in who) return { error: who.error };
  if (!mercadoPagoConfigured()) return { error: "Pagamento online indisponível no momento." };
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return { error: "Não foi possível gerar o Pix." };
  try {
    return { topup: await createWalletTopup({ organizationId, userId: who.user.id, amountCents, payerEmail: who.user.email ?? "", origin: `https://${host}` }) };
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "erro";
    if (code === "amount_invalid") return { error: "Escolha um valor inteiro entre R$ 10 e R$ 500." };
    if (code === "wallet_disabled") return { error: "A carteira ainda não está ativa neste condomínio." };
    return { error: `Não foi possível gerar o Pix agora. Tente novamente em instantes. (${code})` };
  }
}

export async function checkTopup(organizationId: string): Promise<{ paid: boolean }> {
  const who = await residentOf(organizationId);
  if ("error" in who) return { paid: false };
  return { paid: await syncPendingTopups(organizationId, who.user.id) };
}
