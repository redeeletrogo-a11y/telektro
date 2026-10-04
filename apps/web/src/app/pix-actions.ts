"use server";

import { headers } from "next/headers";
import { mercadoPagoConfigured } from "@/lib/billing";
import { createPixCharge, syncPendingPix, type PixCharge } from "@/lib/pix";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PixState = { error?: string; charge?: PixCharge };

async function ownerOf(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." } as const;
  const { data: membership } = await supabase.from("memberships").select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return { error: "Só o responsável da conta pode pagar." } as const;
  const { data: org } = await supabase.from("organizations").select("account_type").eq("id", organizationId).maybeSingle();
  if (org?.account_type !== "residencial" && org?.account_type !== "condominio") return { error: "Pix disponível só para os planos Residencial e Condomínio." } as const;
  return { user } as const;
}

export async function createPix(_previous: PixState, formData: FormData): Promise<PixState> {
  const organizationId = String(formData.get("organization_id") ?? "");
  const who = await ownerOf(organizationId);
  if ("error" in who) return { error: who.error };
  if (!mercadoPagoConfigured()) return { error: "Pagamento online indisponível no momento." };
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return { error: "Não foi possível gerar o Pix." };
  try {
    const charge = await createPixCharge({ organizationId, userId: who.user.id, payerEmail: who.user.email ?? "", origin: `https://${host}` });
    return { charge };
  } catch (caught) {
    return { error: `Não foi possível gerar o Pix agora. Tente novamente em instantes. (${caught instanceof Error ? caught.message : "erro"})` };
  }
}

export async function checkPix(organizationId: string): Promise<{ paid: boolean }> {
  const who = await ownerOf(organizationId);
  if ("error" in who) return { paid: false };
  return { paid: await syncPendingPix(organizationId) };
}
