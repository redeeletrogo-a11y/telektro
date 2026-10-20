"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { CreditCard, Info, Lock, Mail, Phone, User } from "lucide-react";
import { startEletropostoCard, startEletropostoPayment, type StartState } from "@/app/carregar/actions";

const brl = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

type BrickController = { unmount: () => void };
type MercadoPagoCtor = new (key: string, options?: { locale: string }) => { bricks: () => { create: (name: string, container: string, settings: unknown) => Promise<BrickController> } };
declare global { interface Window { MercadoPago?: MercadoPagoCtor; MP_DEVICE_SESSION_ID?: string } }

function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("sdk"));
    document.head.appendChild(script);
  });
}

export function StartForm({ code, min, max, pricePerKwh, cardPublicKey }: { code: string; min: number; max: number; pricePerKwh: number; cardPublicKey: string | null }) {
  const [state, action, pending] = useActionState(startEletropostoPayment.bind(null, code), {} as StartState);
  const presets = [10, 20, 30, 50].filter((value) => value >= min && value <= max);
  const [amount, setAmount] = useState(String(presets[0] ?? min));
  const [cardOpen, setCardOpen] = useState(false);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [cardError, setCardError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const brickRef = useRef<BrickController | null>(null);
  const value = Number(amount.replace(",", "."));
  const kwh = Number.isFinite(value) && value > 0 ? value / pricePerKwh : 0;

  useEffect(() => () => { brickRef.current?.unmount(); }, []);

  async function openCard() {
    setCardError("");
    const form = formRef.current;
    if (!form || !cardPublicKey) return;
    if (!form.reportValidity()) return;
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) { setCardError(`Informe um valor entre ${brl(min)} e ${brl(max)}.`); return; }
    setCardOpen(true);
    try {
      await loadSdk();
      const mp = new window.MercadoPago!(cardPublicKey, { locale: "pt-BR" });
      brickRef.current?.unmount();
      brickRef.current = await mp.bricks().create("cardPayment", "ep-card-brick", {
        initialization: { amount: parsed, payer: { email: String(new FormData(form).get("email") ?? "") } },
        customization: { paymentMethods: { maxInstallments: 1, minInstallments: 1, types: { excluded: ["debit_card"] } }, visual: { hidePaymentButton: false } },
        callbacks: {
          onReady: () => {},
          onError: () => setCardError("Não foi possível carregar o formulário do cartão. Use o Pix."),
          onSubmit: async (data: { token: string; payment_method_id: string; issuer_id?: string | number }) => {
            const fd = new FormData(form);
            const result = await startEletropostoCard(code, {
              amount, name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), phone: String(fd.get("phone") ?? ""), consent: fd.get("consent") === "on",
              token: data.token, paymentMethodId: data.payment_method_id, issuerId: data.issuer_id ? String(data.issuer_id) : null, deviceId: window.MP_DEVICE_SESSION_ID ?? null,
            });
            if ("error" in result) { setCardError(result.error); throw new Error("card_failed"); }
            window.location.href = `/carregar/pagamento/${result.token}`;
          },
        },
      });
    } catch {
      setCardError("Não foi possível carregar o formulário do cartão. Use o Pix.");
      setCardOpen(false);
    }
  }

  const isCard = method === "card";
  const clean = Number.isFinite(value) ? value : 0;
  return <form ref={formRef} action={action} className="ep-form">
    <section className="ep-card">
      <h2>Quanto deseja {isCard ? "reservar" : "carregar"}?</h2>
      <p className="ep-sub">{isCard ? "Esse valor fica reservado no cartão. Você paga apenas o consumo realizado." : "Esse é o valor máximo da recarga, pago agora no Pix. Você paga apenas o consumo realizado."}</p>
      <div className="ep-amount"><span>R$</span>
        <input name="amount" inputMode="decimal" aria-label="Valor máximo da recarga em reais" value={amount} onChange={(event) => setAmount(event.target.value)} required aria-describedby="amount-help" readOnly={cardOpen}/>
      </div>
      <div className="ep-chips">{presets.map((preset) => <button key={preset} type="button" className={clean === preset ? "ep-chip on" : "ep-chip"} aria-pressed={clean === preset} disabled={cardOpen} onClick={() => setAmount(String(preset))}>R$ {preset}</button>)}</div>
      <small id="amount-help" className="ep-range">Entre {brl(min)} e {brl(max)}. Dá cerca de {kwh.toFixed(1).replace(".", ",")} kWh.</small>
      <div className="ep-info"><Info size={18} aria-hidden="true"/><p><strong>Você paga apenas o consumo realizado.</strong> {isCard ? "O saldo não utilizado é liberado no cartão." : "O saldo não utilizado volta no mesmo Pix."}</p></div>
    </section>
    <section className="ep-card">
      <h2>Seus dados</h2>
      <label className="ep-field"><User size={16} aria-hidden="true"/><input name="name" placeholder="Seu nome" aria-label="Seu nome" autoComplete="name" required minLength={2} maxLength={120}/></label>
      <label className="ep-field"><Mail size={16} aria-hidden="true"/><input name="email" type="email" placeholder="E-mail para o recibo" aria-label="E-mail para o recibo" autoComplete="email" required maxLength={200}/></label>
      <label className="ep-field"><Phone size={16} aria-hidden="true"/><input name="phone" type="tel" placeholder="Celular (opcional)" aria-label="Celular (opcional)" autoComplete="tel" maxLength={30}/></label>
    </section>
    <section className="ep-card">
      <h2>Forma de pagamento</h2>
      <div role="radiogroup" aria-label="Forma de pagamento" className="ep-methods">
        <label className={`ep-method${!isCard ? " on" : ""}`}><input type="radio" name="method" value="pix" checked={!isCard} disabled={cardOpen} onChange={() => setMethod("pix")}/>
          <span className="ep-pix" aria-hidden="true">◆</span><span><strong>Pix</strong><small>Pague agora; a sobra volta no mesmo Pix</small></span></label>
        {cardPublicKey && <label className={`ep-method${isCard ? " on" : ""}`}><input type="radio" name="method" value="card" checked={isCard} disabled={cardOpen} onChange={() => setMethod("card")}/>
          <CreditCard size={22} aria-hidden="true"/><span><strong>Cartão de crédito</strong><small>Reserva no cartão; só o consumo é cobrado</small></span></label>}
      </div>
      <label className="ep-consent"><input name="consent" type="checkbox" required/> <span>{isCard
        ? "Concordo em reservar no cartão o valor máximo escolhido. Será cobrado só o consumo medido e o resto da reserva é liberado."
        : "Concordo em pagar antecipadamente, via Pix, o valor máximo escolhido. Será cobrado só o consumo medido e a sobra volta ao mesmo Pix."} Usaremos meus dados apenas para esta recarga e o recibo.</span></label>
    </section>
    {state.error && <p className="login-error" role="alert">{state.error}</p>}
    {!cardOpen && (isCard
      ? <button className="ep-primary" type="button" onClick={openCard}>Continuar para pagar com cartão →</button>
      : <button className="ep-primary" type="submit" disabled={pending}>{pending ? "Gerando Pix..." : "Continuar para pagar com Pix →"}</button>)}
    {cardOpen && <section className="ep-card"><small className="ep-range">Reservamos {brl(value)} no cartão e cobramos só o consumo medido, em 1x.</small><div id="ep-card-brick"/><button className="ep-secondary" type="button" onClick={() => { brickRef.current?.unmount(); brickRef.current = null; setCardOpen(false); setCardError(""); }}>Voltar</button></section>}
    {cardError && <p className="login-error" role="alert">{cardError}</p>}
    <p className="ep-secure"><Lock size={13} aria-hidden="true"/> Pagamento seguro · Acompanhe sua recarga nesta página</p>
    <small className="ep-legal">Processado pelo Mercado Pago. Os dados do cartão não passam pelos nossos servidores.</small>
  </form>;
}
