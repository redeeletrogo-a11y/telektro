import type { Metadata } from "next";
import { SessionView } from "@/components/eletroposto-session";
import { getPublicStatus, isValidToken } from "@/lib/eletroposto";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sua recarga", robots: { index: false, follow: false } };

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const initial = isValidToken(token) ? await getPublicStatus(token, false).catch(() => null) : null;
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark">T</span><span>TELEKTRO</span></div>
    {!initial ? <><h1>Recarga não encontrada</h1><p className="login-description">Confira o link ou escaneie o QR Code do carregador de novo.</p></> : <SessionView token={token} initial={initial}/>}
  </section></main>;
}
