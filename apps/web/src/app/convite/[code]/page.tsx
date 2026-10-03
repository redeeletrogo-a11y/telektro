import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptInvite } from "./actions";

const messages: Record<string, string> = {
  INVITE_INVALID: "Este convite expirou ou foi revogado. Peça um novo à pessoa responsável pelo condomínio.",
  RESIDENT_LIMIT_REACHED: "O condomínio atingiu o limite de moradores. Peça à pessoa responsável para falar com a Telektro.",
};

export default async function InvitePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { code } = await params;
  const { erro } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: preview } = await supabase.rpc("get_invite_preview", { p_code: code });
  const info = Array.isArray(preview) ? preview[0] : null;
  const { data: { user } } = await supabase.auth.getUser();
  const valid = Boolean(info?.valid);
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark">T</span><span>TELEKTRO</span></div>
    <p className="eyebrow">CONVITE</p>
    {!valid ? <><h1>Convite inválido</h1><p className="login-description">Este convite expirou ou foi revogado. Peça um novo à pessoa responsável pelo condomínio.</p></> : <>
      <h1>Entrar em {info!.organization_name}</h1>
      <p className="login-description">Você foi convidado como morador. Terá acesso aos carregadores do condomínio e às suas próprias recargas.</p>
      {erro && <p className="login-error" role="alert">{messages[erro] ?? "Não foi possível aceitar o convite."}</p>}
      {user ? <form action={acceptInvite.bind(null, code)}><button className="primary-button login-submit" type="submit">Aceitar convite como {user.email}</button></form>
        : <Link className="primary-button login-submit" href={`/convite/${code}/entrar`}>Entrar para aceitar</Link>}
    </>}
    {user && <p className="field-help">Conectado como {user.email}. <Link href="/login">Trocar conta</Link></p>}
  </section></main>;
}

