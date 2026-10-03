"use client";
import { useActionState, useState } from "react";
import { startEletropostoPayment, type StartState } from "@/app/carregar/actions";

const brl = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export function StartForm({ code, min, max, pricePerKwh }: { code: string; min: number; max: number; pricePerKwh: number }) {
  const [state, action, pending] = useActionState(startEletropostoPayment.bind(null, code), {} as StartState);
  const presets = [10, 20, 30, 50].filter((value) => value >= min && value <= max);
  const [amount, setAmount] = useState(String(presets[0] ?? min));
  const value = Number(amount.replace(",", "."));
  const kwh = Number.isFinite(value) && value > 0 ? value / pricePerKwh : 0;
  return <form action={action} className="login-form">
    <label>Valor máximo da recarga
      <input name="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required aria-describedby="amount-help"/>
    </label>
    <div className="resend-row">{presets.map((preset) => <button key={preset} type="button" className="secondary-button" onClick={() => setAmount(String(preset))}>{brl(preset)}</button>)}</div>
    <small id="amount-help" className="field-help">Entre {brl(min)} e {brl(max)}. Dá cerca de {kwh.toFixed(1).replace(".", ",")} kWh. Você só paga o que consumir; a sobra volta pelo Pix.</small>
    <label>Seu nome<input name="name" autoComplete="name" required minLength={2} maxLength={120}/></label>
    <label>E-mail (para o recibo)<input name="email" type="email" autoComplete="email" required maxLength={200}/></label>
    <label>Celular (opcional)<input name="phone" type="tel" autoComplete="tel" maxLength={30}/></label>
    <label className="field-help"><input name="consent" type="checkbox" required/> Concordo em pagar antecipadamente o valor máximo escolhido. Será cobrado só o consumo medido e a sobra devolvida ao mesmo Pix. Usaremos meus dados apenas para esta recarga e o recibo.</label>
    {state.error && <p className="login-error" role="alert">{state.error}</p>}
    <button className="primary-button login-submit" type="submit" disabled={pending}>{pending ? "Gerando Pix..." : "Pagar com Pix"}</button>
  </form>;
}
