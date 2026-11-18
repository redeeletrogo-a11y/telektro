"use client";

import { useActionState } from "react";
import { addLeadAction, addMemberAction, setStatusAction, type AdminState } from "@/app/indique/admin/actions";
import { REFERRAL_STATUSES } from "@/lib/referral";

const initial: AdminState = {};

function Feedback({ state }: { state: AdminState }) {
  return <>{state.error && <p className="ra-err" role="alert">{state.error}</p>}{state.message && <p className="ra-msg" role="status">{state.message}</p>}</>;
}

export function AdminForms({ members }: { members?: boolean }) {
  const [leadState, leadAction, leadPending] = useActionState(addLeadAction, initial);
  const [memberState, memberAction, memberPending] = useActionState(addMemberAction, initial);
  if (members) {
    return (
      <form action={memberAction} className="ra-form" style={{ marginTop: 14 }}>
        <input name="email" type="email" placeholder="E-mail da conta Telektro do novo membro" required/>
        <button className="lp-btn ghost" disabled={memberPending}>{memberPending ? "Adicionando…" : "Adicionar à equipe"}</button>
        <Feedback state={memberState}/>
      </form>
    );
  }
  return (
    <form action={leadAction} className="ra-form" style={{ marginTop: 14 }}>
      <input name="referrer_email" type="email" placeholder="E-mail da conta de quem indicou" required/>
      <input name="name" placeholder="Nome da pessoa indicada" required/>
      <input name="contact" placeholder="WhatsApp ou e-mail do indicado"/>
      <textarea name="notes" placeholder="Observação (opcional)" rows={2}/>
      <button className="lp-btn primary" disabled={leadPending}>{leadPending ? "Registrando…" : "Registrar indicação"}</button>
      <Feedback state={leadState}/>
    </form>
  );
}

export function StatusSelect({ id, status, label }: { id: string; status: string; label: string }) {
  const [state, action, pending] = useActionState(setStatusAction, initial);
  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="referral_id" value={id}/>
      <select name="status" defaultValue={status} className="ra-sel" aria-label={`Status atual: ${label}`}>
        {Object.entries(REFERRAL_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <button className="lp-btn ghost" disabled={pending}>{pending ? "Salvando…" : "Atualizar"}</button>
      <Feedback state={state}/>
    </form>
  );
}
