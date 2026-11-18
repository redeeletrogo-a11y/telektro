"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminState = { error?: string; message?: string };

export async function addLeadAction(_previous: AdminState, formData: FormData): Promise<AdminState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_add_referral", {
    p_referrer_email: String(formData.get("referrer_email") ?? ""),
    p_name: String(formData.get("name") ?? ""),
    p_contact: String(formData.get("contact") ?? ""),
    p_notes: String(formData.get("notes") ?? "") || null,
  });
  if (error) return { error: "Não foi possível registrar. Tente novamente." };
  if (data === "NAME_REQUIRED") return { error: "Informe o nome da pessoa indicada." };
  if (data === "REFERRER_NOT_FOUND") return { error: "Quem indicou precisa ter conta Telektro com esse e-mail." };
  revalidatePath("/indique/admin");
  return { message: "Indicação registrada." };
}

export async function setStatusAction(_previous: AdminState, formData: FormData): Promise<AdminState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_set_referral_status", {
    p_referral_id: String(formData.get("referral_id") ?? ""),
    p_status: String(formData.get("status") ?? ""),
    p_notes: null,
  });
  if (error || data !== "OK") return { error: "Não foi possível atualizar o status. Tente novamente." };
  revalidatePath("/indique/admin");
  return { message: "Status atualizado." };
}

export async function addMemberAction(_previous: AdminState, formData: FormData): Promise<AdminState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_add_member", { p_email: String(formData.get("email") ?? "") });
  if (error) return { error: "Não foi possível adicionar. Tente novamente." };
  if (data === "NOT_FOUND") return { error: "Nenhuma conta Telektro com esse e-mail. Peça para a pessoa criar a conta primeiro." };
  revalidatePath("/indique/admin");
  return { message: "Membro adicionado à equipe." };
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("admin_remove_member", { p_user_id: String(formData.get("user_id") ?? "") });
  revalidatePath("/indique/admin");
}
