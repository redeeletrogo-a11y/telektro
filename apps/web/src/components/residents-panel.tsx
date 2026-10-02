"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Trash2, UserPlus } from "lucide-react";
import { createResidentInvite, removeResident, revokeResidentInvite } from "@/app/workspace-actions";

export type Resident = { user_id: string; email: string; joined_at: string };
export type Invite = { id: string; code: string; expires_at: string; revoked_at: string | null; accepted_count: number };

function InviteCard({ code }: { code: string }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}/convite/${code}`;
    QRCode.toDataURL(url, { margin: 1, width: 336 }).then((data) => { setLink(url); setQr(data); });
  }, [code]);
  return <div className="invite-card">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {qr ? <img src={qr} alt="QR Code do convite"/> : <span>Gerando QR…</span>}
    <div className="invite-link">{link}</div>
    <button type="button" className="secondary-button" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy size={13}/>{copied ? "Copiado" : "Copiar link"}</button>
  </div>;
}

export function ResidentsPanel({ organizationId, residents, invites, residentLimit }: { organizationId: string; residents: Resident[]; invites: Invite[]; residentLimit: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [shownCode, setShownCode] = useState<string | null>(null);
  const activeInvites = invites.filter((invite) => !invite.revoked_at && new Date(invite.expires_at) > new Date());
  const full = residentLimit !== null && residents.length >= residentLimit;
  const run = (job: () => Promise<{ error?: string; code?: string }>) => startTransition(async () => {
    setError("");
    const result = await job();
    if (result.error) setError(result.error);
    if (result.code) setShownCode(result.code);
    router.refresh();
  });
  return <div className="residents-panel">
    <section className="panel" style={{ padding: 16 }}>
      <h2 className="panel-title">Moradores</h2>
      <div className="panel-kicker">{residents.length}{residentLimit !== null ? ` de ${residentLimit}` : ""} moradores cadastrados</div>
      {residentLimit !== null && residentLimit > 0 && <div className="limit-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (residents.length / residentLimit) * 100)}%` }}/></div>}
      {full && <p className="form-error" role="status">Limite de moradores atingido. Para aumentar, fale com a Telektro.</p>}
      {residents.map((resident) => <div className="resident-row" key={resident.user_id}>
        <span>{resident.email}<small> · desde {new Date(resident.joined_at).toLocaleDateString("pt-BR")}</small></span>
        <button type="button" className="secondary-button" disabled={pending} onClick={() => { if (confirm(`Remover ${resident.email}?`)) run(() => removeResident(organizationId, resident.user_id)); }}><Trash2 size={13}/>Remover</button>
      </div>)}
      {!residents.length && <p className="field-help">Nenhum morador ainda. Gere um convite e compartilhe o QR ou o link.</p>}
    </section>
    <section className="panel" style={{ padding: 16 }}>
      <h2 className="panel-title">Convites</h2>
      <div className="panel-kicker">Valem por 7 dias. Cada link pode ser usado por vários moradores até o limite do condomínio.</div>
      <button type="button" className="primary-button" disabled={pending || full} onClick={() => run(() => createResidentInvite(organizationId))}><UserPlus size={14}/>Gerar convite</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {shownCode && <InviteCard code={shownCode}/>}
      {activeInvites.filter((invite) => invite.code !== shownCode).map((invite) => <div className="invite-row" key={invite.id}>
        <span>Convite até {new Date(invite.expires_at).toLocaleDateString("pt-BR")} · {invite.accepted_count} uso(s)</span>
        <span><button type="button" className="secondary-button" onClick={() => setShownCode(invite.code)}>Ver QR</button> <button type="button" className="secondary-button" disabled={pending} onClick={() => run(() => revokeResidentInvite(invite.id))}>Revogar</button></span>
      </div>)}
    </section>
  </div>;
}
