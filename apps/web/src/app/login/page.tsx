import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const authError = error === "google"
    ? "Não foi possível conectar com o Google. Confira se o provedor está habilitado no Supabase."
    : error === "confirmation"
      ? "Não foi possível confirmar o acesso. Abra novamente o link recebido por e-mail ou solicite outro."
      : error === "configuration"
        ? "O acesso ainda não está configurado. Confira as credenciais do Supabase."
        : undefined;
  return <LoginForm authError={authError}/>;
}
