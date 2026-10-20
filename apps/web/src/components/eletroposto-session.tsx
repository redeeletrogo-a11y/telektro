"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BatteryCharging, Car, Clock, Copy, Info, ReceiptText, ShieldCheck, Zap } from "lucide-react";
import { eletropostoStatus, eletropostoStop } from "@/app/carregar/actions";
import type { PublicStatus } from "@/lib/eletroposto";
import { brl, dateTime, duration, kwhText, maxKwh } from "@/lib/eletroposto-format";

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

  const step = ({ awaiting_payment: 0, paid: 1, starting: 1, charging: 2, settling: 3, settled: 4 } as Record<string, number>)[s.status];
  const showSteps = step !== undefined && !(s.status === "settled" && s.failure === "start");
  const card = s.method === "card";
  const spent = s.spent ?? 0;
  const left = Math.max(0, s.cap - spent);
  const pct = s.cap > 0 ? Math.min(100, Math.round((spent / s.cap) * 100)) : 0;
  const max = maxKwh(s.cap, s.pricePerKwh);
  const back = card ? "A parte não usada da reserva é liberada no cartão." : "O que não for usado volta no mesmo Pix.";
  const dark = ["paid", "starting", "charging", "settling"].includes(s.status) || (s.status === "settled" && s.failure !== "start");
  return <div className={dark ? "login-form ep-dark" : "login-form"}>
    {showSteps && <ol className="ep-steps" aria-label="Etapas da recarga">
      {["Pagamento", "Carregador", "Recarga", "Finalização"].map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined} className={index < step ? "done" : index === step ? "now" : ""}>
        <span className="ep-dot">{index < step ? "✓" : index + 1}</span>{label}</li>)}
    </ol>}
    {s.status === "awaiting_payment" && s.method === "card" && <><p className="eyebrow">CARTÃO</p><h1>Aguardando aprovação do cartão</h1><p className="login-description">Estamos confirmando a reserva de {brl(s.cap)} no seu cartão. Isso leva alguns segundos. Não feche esta página.</p></>}
    {s.status === "awaiting_payment" && s.method !== "card" && <div className="ep-pixscreen">
      <p className="eyebrow">PAGAMENTO VIA PIX</p><h1>Pague <span className="ep-green">{brl(s.cap)}</span></h1>
      <p className="login-description">Escaneie o QR Code ou copie o código Pix para pagar.</p>
      {s.qrBase64 && <div className="ep-qr"><img alt="QR Code Pix" width={200} height={200} src={`data:image/png;base64,${s.qrBase64}`}/></div>}
      <label className="ep-code"><span>Código Pix copia e cola</span><textarea readOnly value={s.qrCode ?? ""} rows={2} aria-label="Pix copia e cola"/></label>
      <button className="ep-primary" type="button" onClick={() => { navigator.clipboard?.writeText(s.qrCode ?? ""); setCopied(true); }}><Copy size={18} aria-hidden="true"/> {copied ? "Copiado!" : "Copiar código Pix"}</button>
      <div className="ep-wait" role="status"><Clock size={22} aria-hidden="true"/><div><strong>Aguardando confirmação do pagamento</strong><p>Esta página atualiza sozinha. Mantenha o carro conectado. O código vale 10 minutos.</p></div></div>
      <p className="ep-next"><Car size={18} aria-hidden="true"/> A recarga começa depois da confirmação do pagamento.</p>
    </div>}

    {(s.status === "paid" || s.status === "starting") && <div className="ep-pixscreen">
      <p className="eyebrow">PAGAMENTO CONFIRMADO</p><h1>Aguardando liberação do carregador</h1>
      <p className="login-description">{card ? `Reserva de ${brl(s.cap)} aprovada no cartão${s.cardLast4 ? ` final ${s.cardLast4}` : ""}.` : "Pagamento confirmado."} Estamos liberando o carregador. Se não iniciar em alguns minutos, {card ? "a reserva é liberada" : "o valor é devolvido"} sem cobrança.</p>
      <div className="ep-sum"><h2>Resumo</h2>
        <div><span>{card ? "Valor reservado" : "Valor pago"}</span><strong>{brl(s.cap)}</strong></div>
        <div><span>Tarifa</span><strong>{brl(s.pricePerKwh)}/kWh</strong></div>
        <p><ShieldCheck size={16} aria-hidden="true"/> Você paga apenas o consumo realizado.</p></div>
      <div className="ep-info"><Info size={18} aria-hidden="true"/><p>{back}</p></div>
      <p className="ep-next"><Car size={18} aria-hidden="true"/> Mantenha o veículo conectado.</p>
    </div>}
    {s.status === "charging" && <div className="ep-pixscreen">
      <p className="eyebrow">CARREGANDO</p>
      <div className="ep-ring" style={{ background: `conic-gradient(#3ee0a8 ${pct * 3.6}deg, rgb(255 255 255 / 16%) 0)` }}><div><BatteryCharging size={22} aria-hidden="true"/><strong>{s.kwh === null ? "..." : s.kwh.toFixed(2).replace(".", ",")}</strong><span>kWh</span></div></div>
      <div className="ep-tiles">
        <div><span>Valor utilizado</span><strong>{brl(spent)}</strong><small>de {brl(s.cap)}</small></div>
        <div><span>Consumo</span><strong>{kwhText(s.kwh)}</strong><small>{max === null ? "" : `até cerca de ${kwhText(max)}`}</small></div>
        <div><span>Saldo estimado</span><strong>{brl(left)}</strong><small>para uso</small></div>
      </div>
      <div className="ep-info"><Info size={18} aria-hidden="true"/><p>A recarga para sozinha perto do valor {card ? "reservado" : "pago"}. Você paga só o que consumir. {back}</p></div>
      {s.canStop && <button className="secondary-button" type="button" onClick={stop}>Parar recarga</button>}
      {message && <small className="field-help" role="status">{message}</small>}
    </div>}
    {s.status === "settling" && <><p className="eyebrow">{s.refundDelayed ? "DEVOLUÇÃO PENDENTE" : "FINALIZANDO"}</p><h1>{s.refundDelayed ? "Ainda não conseguimos concluir" : "Calculando seu comprovante"}</h1><p className="login-description">{s.failure === "connection_lost" ? "A conexão com o carregador caiu, então fechamos a recarga com o último consumo medido. " : ""}{s.refundDelayed ? (s.method === "card" ? "A cobrança do consumo no cartão ainda não foi concluída." : `A devolução de ${brl(s.refund)} ainda não foi concluída.`) + " Vamos tentar de novo sozinhos. Guarde este link; se não resolver em 1 dia útil, fale com o suporte." : s.method === "card" ? "Estamos cobrando só o consumo e liberando o restante da reserva." : s.refund && s.refund > 0 ? `Estamos devolvendo ${brl(s.refund)} no Pix. Isso leva alguns minutos.` : "Estamos fechando a recarga."}</p></>}
    {s.status === "settled" && s.failure === "start" && <>
      <p className="eyebrow">FALHA AO INICIAR</p><h1>O carregador não iniciou</h1>
      <p className="login-description">Nada foi cobrado. {s.method === "card" ? "A reserva no cartão foi cancelada e o limite volta em breve." : `Devolvemos ${brl(s.refund)} no mesmo Pix.`} Confira o encaixe do cabo e escaneie o QR de novo.</p>
    </>}
    {s.status === "settled" && s.failure !== "start" && <div className="ep-pixscreen">
      <p className="eyebrow">CONCLUÍDO</p><h1>{s.charged === 0 ? "Nada foi cobrado" : "Recarga finalizada"}</h1>
      {s.failure === "connection_lost" && <p className="login-description">A conexão com o carregador caiu durante a recarga. Cobramos só o consumo medido até lá.</p>}
      <div className="ep-tiles">
        <div><span>Consumo total</span><strong>{kwhText(s.kwh)}</strong></div>
        <div><span>Valor cobrado</span><strong>{brl(s.charged)}</strong></div>
        <div><span>{card ? "Reserva liberada" : "Valor devolvido"}</span><strong>{brl(s.refund)}</strong><small>{card ? "no cartão" : "no mesmo Pix"}</small></div>
      </div>
      <div className="ep-sum"><h2>Resumo da recarga</h2>
        <div><span>Início</span><strong>{dateTime(s.startedAt)}</strong></div>
        <div><span>Fim</span><strong>{dateTime(s.endedAt)}</strong></div>
        <div><span>Tempo total</span><strong>{duration(s.startedAt, s.endedAt)}</strong></div>
        <div><span>Consumo</span><strong>{kwhText(s.kwh)}</strong></div>
        <div><span>Tarifa</span><strong>{brl(s.pricePerKwh)}/kWh</strong></div>
        <div><span>{card ? "Reservado" : "Pago antecipado"}</span><strong>{brl(s.cap)}</strong></div>
        <div><span>Cobrado</span><strong>{brl(s.charged)}</strong></div>
        <div><span>{card ? "Liberado" : "Devolvido"}</span><strong>{brl(s.refund)}</strong></div></div>
      <div className="ep-info"><Info size={18} aria-hidden="true"/><p>{card ? "A parte não usada da reserva foi liberada no seu cartão. O prazo para sumir da fatura depende do seu banco." : s.refund && s.refund > 0 ? "A devolução foi enviada ao mesmo Pix. O horário em que aparece depende do seu banco. Se passar de 1 dia útil, fale com o suporte." : "Não houve sobra para devolver."}</p></div>
      <Link className="ep-primary ep-btn" href={`/carregar/pagamento/${token}/recibo`}><ReceiptText size={18} aria-hidden="true"/> Ver comprovante</Link>
      {s.pointCode && <Link className="secondary-button ep-btn" href={`/carregar/${s.pointCode}`}><Zap size={18} aria-hidden="true"/> Nova recarga</Link>}
    </div>}
    {s.status === "expired" && <><h1>Pagamento não concluído</h1><p className="login-description">O pagamento não foi concluído a tempo. Escaneie o QR Code do carregador para tentar de novo. Se pagou e o valor não voltou, fale com o suporte.</p></>}
    {s.status === "review" && <><h1>Em análise</h1><p className="login-description">Detectamos uma leitura incomum do medidor. O responsável vai conferir e ajustar o valor. Guarde este link.</p></>}
  </div>;
}
