import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptClaim } from "./actions";

const messages: Record<string, string> = {
  CLAIM_INVALID: "Este QR code foi substituído ou desativado. Peça um novo a quem entregou o carregador.",
  NO_ORGANIZATION: "Sua conta ainda não tem uma área própria. Crie sua conta Telektro na página inicial e escaneie este QR code de novo.",
};

export default async function ClaimPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { token } = await params;
  const { erro } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: preview } = await supabase.rpc("get_charger_claim_preview", { p_token: token });
  const info = Array.isArray(preview) ? preview[0] as { charge_point_id: string; vendor: string | null; model: string | null } | undefined : null;
  const { data: { user } } = await supabase.auth.getUser();
  const valid = Boolean(info);
  const chargerLabel = [info?.vendor, info?.model].filter(Boolean).join(" ");
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark">T</span><span>TELEKTRO</span></div>
    <p className="eyebrow">PROVISIONAMENTO</p>
    {!valid ? <>
      <h1>QR code inválido</h1>
      <p className="login-description">Este QR code expirou, foi substituído ou o carregador já foi reivindicado. Peça um novo a quem entregou o equipamento.</p>
    </> : <>
      <h1>Este carregador é seu?</h1>
      <p className="login-description">{chargerLabel ? `${chargerLabel} · ` : ""}ID {info!.charge_point_id}. Ao confirmar, o carregador passa a aparecer na sua conta Telektro e você acompanha e controla as recargas por aqui.</p>
      {erro && <p className="login-error" role="alert">{messages[erro] ?? "Não foi possível confirmar o carregador."}</p>}
      {user ? <form action={acceptClaim.bind(null, token)}><button className="primary-button login-submit" type="submit">Sim, este carregador é meu</button></form>
        : <Link className="primary-button login-submit" href={`/c/${token}/entrar`}>Entrar para confirmar</Link>}
      {erro === "NO_ORGANIZATION" && <p className="field-help"><Link href="/">Criar minha conta Telektro</Link></p>}
    </>}
    {user && <p className="field-help">Conectado como {user.email}. <Link href="/login">Trocar conta</Link></p>}
  </section></main>;
}
