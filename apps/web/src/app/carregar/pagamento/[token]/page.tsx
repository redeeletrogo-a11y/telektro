import type { Metadata } from "next";
import { SessionView } from "@/components/eletroposto-session";
import { getPublicStatus, isValidToken } from "@/lib/eletroposto";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sua recarga", robots: { index: false, follow: false } };

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const initial = isValidToken(token) ? await getPublicStatus(token, false).catch(() => null) : null;
  return <main className="ep-page"><div className="ep-wrap">
    <div className="ep-top"><span className="ep-brand"><img src="/icon.svg" alt="" width={32} height={32}/>TELEKTRO</span></div>
    <section className="ep-card ep-state">
      {!initial ? <><h1>Recarga não encontrada</h1><p className="ep-sub">Confira o link ou escaneie o QR Code do carregador de novo.</p></> : <SessionView token={token} initial={initial}/>}
    </section>
    <p className="ep-secure"><span aria-hidden="true">🔒</span> Pagamento seguro · Acompanhe sua recarga nesta página</p>
  </div></main>;
}
