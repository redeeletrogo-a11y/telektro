import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: true }, alternates: { canonical: "/login" } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  let signedIn = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    // Keep the login screen available when auth is not configured or unavailable.
  }
  if (signedIn) redirect("/");
  const { error } = await searchParams;
  const authError = error === "expired"
    ? "Esta tentativa de acesso expirou ou já foi usada. Toque em Continuar com o Google para iniciar uma nova."
    : error === "google"
    ? "Não foi possível conectar com o Google. Confira se o provedor está habilitado no Supabase."
    : error === "confirmation"
      ? "Não foi possível confirmar o acesso. Abra novamente o link recebido por e-mail ou solicite outro."
      : error === "configuration"
        ? "O acesso ainda não está configurado. Confira as credenciais do Supabase."
        : undefined;
  return <LoginForm authError={authError}/>;
}
