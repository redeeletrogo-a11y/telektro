import type { Metadata } from "next";
import { StartForm } from "@/components/eletroposto-start";
import { getPointInfo, isValidCode } from "@/lib/eletroposto";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recarregar", robots: { index: false, follow: false } };

export default async function ChargePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const info = isValidCode(code) ? await getPointInfo(code).catch(() => null) : null;
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark">T</span><span>TELEKTRO</span></div>
    {!info ? <><h1>Ponto não encontrado</h1><p className="login-description">Confira o QR Code do carregador.</p></> : <>
      <p className="eyebrow">RECARGA SEM APP</p>
      <h1>{info.siteName || info.chargerName}</h1>
      <p className="login-description">Carregador {info.chargerName}, conector {info.connectorId}. Tarifa: R$ {info.pricePerKwh?.toFixed(2).replace(".", ",") ?? "-"} por kWh.</p>
      {info.available ? <StartForm code={info.code} min={info.minAmount} max={info.maxAmount} pricePerKwh={info.pricePerKwh!}/> : <p className="login-error" role="alert">{info.reason}</p>}
    </>}
  </section></main>;
}
