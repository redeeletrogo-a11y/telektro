"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; message?: string };

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

export async function signUp(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Informe um e-mail válido." };
  if (password.length < 8) return { error: "A senha deve ter pelo menos 8 caracteres." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "O cadastro ainda não está configurado. Confira as credenciais do Supabase." }; }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) return { error: "Não foi possível criar a conta. Confira os dados e tente novamente." };
  if (data.session) redirect("/");
  return { message: "Cadastro iniciado. Confira seu e-mail para confirmar a conta e continuar." };
}
