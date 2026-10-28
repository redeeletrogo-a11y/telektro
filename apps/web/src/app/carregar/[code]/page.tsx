import type { Metadata } from "next";
import { StartForm } from "@/components/eletroposto-start";
import { ResumeBanner } from "@/components/eletroposto-resume";
import { getPointInfo, isValidCode } from "@/lib/eletroposto";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recarregar", robots: { index: false, follow: false } };

export default async function ChargePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const info = isValidCode(code) ? await getPointInfo(code).catch(() => null) : null;
  const brand = <div className="ep-top"><span className="ep-brand"><img src="/icon.svg" alt="" width={32} height={32}/>TELEKTRO</span>
    <details className="ep-help"><summary aria-label="Como funciona">?</summary><p>Escolha o valor, pague e conecte o carro. A recarga começa sozinha e você acompanha nesta página. Só o consumo medido é cobrado; o que sobrar volta para você.</p></details></div>;
  return <main className="ep-page"><div className="ep-wrap">
    {brand}
    {isValidCode(code) && <ResumeBanner code={code}/>}
    {!info ? <section className="ep-card"><h1>Ponto não encontrado</h1><p className="ep-sub">Confira o QR Code do carregador.</p></section> : <>
      <header className="ep-hero"><div><p className="ep-eyebrow">RECARGA SEM APP</p><h1>{info.siteName || info.chargerName}</h1>
        <p className="ep-meta">Carregador {info.chargerName} · Conector {info.connectorId}<br/>{info.pricePerKwh ? `R$ ${info.pricePerKwh.toFixed(2).replace(".", ",")}/kWh` : "Tarifa não definida"}</p></div>
        <svg className="ep-charger" viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="6" width="30" height="46" rx="8" fill="#0f776c"/><rect x="19" y="12" width="20" height="20" rx="4" fill="#bcebd1"/><path d="m31 14-8 10h6l-3 7 9-11h-6z" fill="#0f776c"/><path d="M44 22h5a4 4 0 0 1 4 4v14a5 5 0 0 1-10 0" fill="none" stroke="#0f776c" strokeWidth="3"/></svg></header>
      {info.available ? <StartForm code={info.code} min={info.minAmount} max={info.maxAmount} pricePerKwh={info.pricePerKwh!} cardPublicKey={process.env.NEXT_PUBLIC_MERCADOPAGO_ELETROPOSTO_PUBLIC_KEY ?? null}/> : <p className="login-error" role="alert">{info.reason}</p>}
    </>}
  </div></main>;
}
