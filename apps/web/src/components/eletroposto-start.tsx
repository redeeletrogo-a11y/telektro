"use client";
import { useActionState, useEffect, useRef, useState } from "react";
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

  return <form ref={formRef} action={action} className="login-form">
    <label>Valor máximo da recarga
      <input name="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required aria-describedby="amount-help" readOnly={cardOpen}/>
    </label>
    <div className="resend-row">{presets.map((preset) => <button key={preset} type="button" className="secondary-button" disabled={cardOpen} onClick={() => setAmount(String(preset))}>{brl(preset)}</button>)}</div>
    <small id="amount-help" className="field-help">Entre {brl(min)} e {brl(max)}. Dá cerca de {kwh.toFixed(1).replace(".", ",")} kWh. Você só paga o que consumir; no Pix a sobra volta ao mesmo Pix e no cartão só o consumo é cobrado (o resto da reserva é liberado).</small>
    <label>Seu nome<input name="name" autoComplete="name" required minLength={2} maxLength={120}/></label>
    <label>E-mail (para o recibo)<input name="email" type="email" autoComplete="email" required maxLength={200}/></label>
    <label>Celular (opcional)<input name="phone" type="tel" autoComplete="tel" maxLength={30}/></label>
    <label className="field-help"><input name="consent" type="checkbox" required/> Concordo em pagar antecipadamente (Pix) ou reservar no cartão o valor máximo escolhido. Será cobrado só o consumo medido. Usaremos meus dados apenas para esta recarga e o recibo.</label>
    {state.error && <p className="login-error" role="alert">{state.error}</p>}
    {!cardOpen && <button className="primary-button login-submit" type="submit" disabled={pending}>{pending ? "Gerando Pix..." : "Pagar com Pix"}</button>}
    {cardPublicKey && !cardOpen && <button className="secondary-button" type="button" onClick={openCard}>Pagar com cartão de crédito</button>}
    {cardOpen && <><small className="field-help">Reservamos {brl(value)} no cartão e cobramos só o consumo medido, em 1x.</small><div id="ep-card-brick"/><button className="secondary-button" type="button" onClick={() => { brickRef.current?.unmount(); brickRef.current = null; setCardOpen(false); setCardError(""); }}>Voltar e escolher Pix</button></>}
    {cardError && <p className="login-error" role="alert">{cardError}</p>}
    <small className="field-help">Pagamento processado com segurança pelo Mercado Pago. Os dados do cartão não passam pelos nossos servidores.</small>
  </form>;
}
