import type { Metadata } from "next";
import { getPublicStatus, isValidToken } from "@/lib/eletroposto";
import { brl, dateTime, duration, kwhText } from "@/lib/eletroposto-format";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comprovante de recarga", robots: { index: false, follow: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = isValidToken(token) ? await getPublicStatus(token, false).catch(() => null) : null;
  const ready = s && s.status === "settled" && s.failure !== "start";
  const card = s?.method === "card";
  return <main className="ep-page"><div className="ep-wrap">
    <section className="ep-card ep-state ep-receipt">
      {!s || !ready ? <><h1>Comprovante indisponível</h1><p className="ep-sub">O comprovante aparece quando a recarga termina. Volte para a página da recarga.</p><a className="secondary-button ep-btn ep-noprint" href={`/carregar/pagamento/${token}`}>Voltar</a></> : <>
        <p className="eyebrow">TELEKTRO</p><h1>Comprovante de recarga</h1>
        <p className="ep-sub">Nº {s.receiptNo} · {s.chargerName}{s.connectorId ? `, conector ${s.connectorId}` : ""}</p>
        <div className="ep-sum">
          <div><span>Pagamento</span><strong>{dateTime(s.paidAt)}</strong></div>
          <div><span>Início da recarga</span><strong>{dateTime(s.startedAt)}</strong></div>
          <div><span>Fim da recarga</span><strong>{dateTime(s.endedAt)}</strong></div>
          <div><span>Tempo total</span><strong>{duration(s.startedAt, s.endedAt)}</strong></div>
          <div><span>Consumo</span><strong>{kwhText(s.kwh)}</strong></div>
          <div><span>Tarifa</span><strong>{brl(s.pricePerKwh)}/kWh</strong></div>
          <div><span>Forma de pagamento</span><strong>{card ? `Cartão${s.cardBrand ? ` ${s.cardBrand}` : ""}${s.cardLast4 ? ` final ${s.cardLast4}` : ""}` : "Pix"}</strong></div>
          <div><span>{card ? "Reservado" : "Pago antecipado"}</span><strong>{brl(s.cap)}</strong></div>
          <div><span>Valor cobrado</span><strong>{brl(s.charged)}</strong></div>
          <div><span>{card ? "Reserva liberada" : "Valor devolvido"}</span><strong>{brl(s.refund)}</strong></div>
        </div>
        <p className="ep-sub">Este comprovante mostra o que foi consumido e cobrado nesta recarga. Não é nota fiscal.</p>
        <PrintButton/>
        <a className="secondary-button ep-btn ep-noprint" href={`/carregar/pagamento/${token}`}>Voltar</a>
      </>}
    </section>
  </div></main>;
}
