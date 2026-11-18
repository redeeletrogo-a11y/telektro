"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
