"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { error?: string; success?: string };

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

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
