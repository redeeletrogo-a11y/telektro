"use client";
import { useEffect, useState } from "react";
import { eletropostoStatus, eletropostoStop } from "@/app/carregar/actions";
import type { PublicStatus } from "@/lib/eletroposto";

const brl = (value: number | null) => value === null ? "-" : `R$ ${value.toFixed(2).replace(".", ",")}`;
const FINAL = ["settled", "expired", "review"];

export function SessionView({ token, initial }: { token: string; initial: PublicStatus }) {
  const [s, setS] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (FINAL.includes(s.status)) return;
    const timer = window.setInterval(async () => {
      const next = await eletropostoStatus(token).catch(() => null);
      if (next) setS(next);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [token, s.status]);

  async function stop() {
    const { result } = await eletropostoStop(token);
    setMessage(result === "requested" || result === "already_requested" ? "Pedido de parada enviado. Aguarde o carregador confirmar." : "Não há recarga em andamento para parar.");
  }

  return <div className="login-form">
    {s.status === "awaiting_payment" && s.method === "card" && <><p className="eyebrow">CARTÃO</p><h1>Aguardando aprovação do cartão</h1><p className="login-description">Estamos confirmando a reserva de {brl(s.cap)} no seu cartão. Isso leva alguns segundos. Não feche esta página.</p></>}
    {s.status === "awaiting_payment" && s.method !== "card" && <>
      <p className="eyebrow">PAGAMENTO</p><h1>Pague {brl(s.cap)} no Pix</h1>
      {s.qrBase64 && <img alt="QR Code Pix" width={200} height={200} src={`data:image/png;base64,${s.qrBase64}`}/>}
      <textarea readOnly value={s.qrCode ?? ""} rows={3} aria-label="Pix copia e cola"/>
      <button className="primary-button" type="button" onClick={() => { navigator.clipboard?.writeText(s.qrCode ?? ""); setCopied(true); }}>{copied ? "Copiado!" : "Copiar código Pix"}</button>
      <small className="field-help">Mantenha o carro conectado. A recarga começa sozinha depois do pagamento. Este código vale 10 minutos.</small>
    </>}
    {(s.status === "paid" || s.status === "starting") && <><p className="eyebrow">PAGO</p><h1>Iniciando a recarga</h1><p className="login-description">{s.method === "card" ? `Reserva de ${brl(s.cap)} aprovada no cartão${s.cardLast4 ? ` final ${s.cardLast4}` : ""}. Só será cobrado o consumo.` : "Pagamento confirmado."} Confira se o carro está conectado ao carregador. Se não iniciar em alguns minutos, a reserva é liberada sem cobrança.</p></>}
    {s.status === "charging" && <>
      <p className="eyebrow">CARREGANDO</p><h1>{s.kwh === null ? "Aguardando medição" : `${s.kwh.toFixed(2).replace(".", ",")} kWh`}</h1>
      <p className="login-description">Consumo até agora: {brl(s.spent)} de {brl(s.cap)} pagos. A recarga para sozinha perto do valor pago.</p>
      {s.canStop && <button className="secondary-button" type="button" onClick={stop}>Parar recarga</button>}
      {message && <small className="field-help" role="status">{message}</small>}
    </>}
    {s.status === "settling" && <><p className="eyebrow">FINALIZANDO</p><h1>Calculando seu recibo</h1><p className="login-description">{s.method === "card" ? "Estamos cobrando só o consumo e liberando o restante da reserva." : "Estamos devolvendo a sobra. Isso leva só alguns instantes."}</p></>}
    {s.status === "settled" && <>
      <p className="eyebrow">CONCLUÍDO</p><h1>{s.charged === 0 ? "Nada foi cobrado" : "Recarga finalizada"}</h1>
      <p className="login-description">Consumo: {s.kwh === null ? "0" : s.kwh.toFixed(2).replace(".", ",")} kWh a {brl(s.pricePerKwh)}/kWh. Cobrado: {brl(s.charged)}. {s.method === "card" ? `Liberado no cartão: ${brl(s.refund)} (a reserva da sobra some da fatura em poucos dias, conforme o banco).` : `Devolvido no Pix: ${brl(s.refund)}.`}</p>
    </>}
    {s.status === "expired" && <><h1>Pagamento não concluído</h1><p className="login-description">O pagamento não foi concluído a tempo. Escaneie o QR Code do carregador para tentar de novo. Se pagou e o valor não voltou, fale com o suporte.</p></>}
    {s.status === "review" && <><h1>Em análise</h1><p className="login-description">Detectamos uma leitura incomum do medidor. O responsável vai conferir e ajustar o valor. Guarde este link.</p></>}
  </div>;
}
