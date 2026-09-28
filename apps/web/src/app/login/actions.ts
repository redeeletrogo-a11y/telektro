"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function signIn(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe seu e-mail e sua senha." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "O acesso ainda não está configurado. Adicione as credenciais do Supabase ao ambiente local." }; }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Não foi possível entrar. Confira suas credenciais e tente novamente." };
  redirect("/");
}
