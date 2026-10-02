"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { checkPix, createPix, type PixState } from "@/app/pix-actions";

export function PixPay({ organizationId, label = "Pagar com Pix" }: { organizationId: string; label?: string }) {
  const [state, action, pending] = useActionState(createPix, {} as PixState);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const chargeId = state.charge?.id;
  useEffect(() => {
    if (!chargeId) return;
    const timer = window.setInterval(async () => {
      const result = await checkPix(organizationId).catch(() => ({ paid: false }));
      if (result.paid) { window.clearInterval(timer); router.refresh(); }
    }, 7000);
    return () => window.clearInterval(timer);
  }, [chargeId, organizationId, router]);
  const charge = state.charge;
  return <div className="pix-pay">
    {!charge && <form action={action}>
      <input type="hidden" name="organization_id" value={organizationId}/>
      <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Gerando Pix..." : label}</button>
    </form>}
    {state.error && <small className="form-error" role="alert">{state.error}</small>}
    {charge && <div className="pix-box">
      <strong>Pix de R$ {charge.amount.toFixed(2).replace(".", ",")}</strong>
      {charge.qr_code_base64 && <img alt="QR Code Pix" width={180} height={180} src={`data:image/png;base64,${charge.qr_code_base64}`}/>}
      <textarea readOnly value={charge.qr_code ?? ""} rows={3} aria-label="Pix copia e cola"/>
      <button className="primary-button" type="button" onClick={() => { navigator.clipboard?.writeText(charge.qr_code ?? ""); setCopied(true); }}>{copied ? "Copiado!" : "Copiar código Pix"}</button>
      <span className="field-help">Pague no app do seu banco. A liberação é automática em alguns segundos depois do pagamento. O código vale por 3 dias.</span>
    </div>}
  </div>;
}
