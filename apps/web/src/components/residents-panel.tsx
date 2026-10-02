"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Trash2, UserPlus } from "lucide-react";
import { registerResidentTag, revokeResidentTag } from "@/app/condo-actions";
import { createResidentInvite, removeResident, revokeResidentInvite } from "@/app/workspace-actions";

export type Resident = { user_id: string; email: string; joined_at: string };
export type ResidentTag = { id: string; user_id: string; label: string | null; id_tag_hash: string; enabled: boolean };
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

export function ResidentsPanel({ organizationId, residents, invites, residentLimit, tags = [] }: { organizationId: string; residents: Resident[]; invites: Invite[]; residentLimit: number | null; tags?: ResidentTag[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [tagFor, setTagFor] = useState<string | null>(null);
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
      {residents.map((resident) => {
        const mine = tags.filter((tag) => tag.user_id === resident.user_id && tag.enabled);
        return <div className="resident-block" key={resident.user_id}>
        <div className="resident-row">
          <span>{resident.email}<small> · desde {new Date(resident.joined_at).toLocaleDateString("pt-BR")}</small></span>
          <span><button type="button" className="secondary-button" disabled={pending} onClick={() => setTagFor(tagFor === resident.user_id ? null : resident.user_id)}>Cartão RFID</button> <button type="button" className="secondary-button" disabled={pending} onClick={() => { if (confirm(`Remover ${resident.email}? Os cartões dele deixam de valer.`)) run(() => removeResident(organizationId, resident.user_id)); }}><Trash2 size={13}/>Remover</button></span>
        </div>
        {mine.map((tag) => <div className="rfid-row" key={tag.id}><span>{tag.label || "Cartão"} · impressão {tag.id_tag_hash.slice(0, 8)}</span><button type="button" className="credential-copy" disabled={pending} onClick={() => run(() => revokeResidentTag(tag.id))}>Revogar</button></div>)}
        {tagFor === resident.user_id && <form className="rfid-manager" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          run(async () => { const result = await registerResidentTag(organizationId, resident.user_id, String(data.get("id_tag") ?? ""), String(data.get("label") ?? "")); if (!result.error) { form.reset(); setTagFor(null); } return result; });
        }}>
          <input name="id_tag" maxLength={20} autoComplete="off" placeholder="Identificador impresso do cartão" required/>
          <input name="label" maxLength={60} autoComplete="off" placeholder="Apelido (ex.: apto 12)"/>
          <button type="submit" className="secondary-button" disabled={pending}>Vincular cartão</button>
          <small>Vale em todos os carregadores do condomínio e a recarga é cobrada deste morador. Guardamos só o hash.</small>
        </form>}
      </div>; })}
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
