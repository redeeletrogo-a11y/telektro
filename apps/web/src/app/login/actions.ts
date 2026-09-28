"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; message?: string };

function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const isLocalUrl = configured ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(configured) : false;
  const deploymentUrl = process.env.VERCEL_ENV === "preview"
    ? process.env.VERCEL_URL
    : process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (deploymentUrl && (process.env.VERCEL_ENV === "preview" || !configured || isLocalUrl)) return `https://${deploymentUrl}`;
  if (configured) return configured.replace(/\/$/, "");
  return deploymentUrl ? `https://${deploymentUrl}` : "http://localhost:3000";
}

export async function signIn(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe seu e-mail e sua senha." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "O acesso ainda não está configurado. Adicione as credenciais do Supabase ao ambiente local." }; }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Não foi possível entrar. Confira suas credenciais e tente novamente." };
  redirect(getSiteUrl());
}

export async function resendConfirmation(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Informe um e-mail válido." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "O acesso ainda não está configurado. Confira as credenciais do Supabase." }; }

  const siteUrl = getSiteUrl();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) return { error: "Não foi possível solicitar o link agora. Aguarde alguns minutos e tente novamente." };
  return { message: "Se esta conta aguarda confirmação, um novo link será enviado. Confira sua caixa de entrada e o spam." };
}

export async function signInWithGoogle() {
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { redirect("/login?error=configuration"); }

  const siteUrl = getSiteUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signUp(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Informe um e-mail válido." };
  if (password.length < 8) return { error: "A senha deve ter pelo menos 8 caracteres." };

  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return { error: "O cadastro ainda não está configurado. Confira as credenciais do Supabase." }; }

  const siteUrl = getSiteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) return { error: "Não foi possível criar a conta. Confira os dados e tente novamente." };
  if (data.session) redirect(getSiteUrl());
  return { message: "Cadastro iniciado. Confira seu e-mail para confirmar a conta e continuar." };
}
