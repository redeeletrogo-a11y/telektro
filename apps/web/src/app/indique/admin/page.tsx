import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL, formatDate, statusLabel } from "@/lib/referral";
import { AdminForms, StatusSelect } from "@/components/referral-admin";
import { removeMemberAction } from "./actions";
import "@/components/landing.css";

export const metadata: Metadata = { title: "Equipe: indicações", robots: { index: false, follow: false } };

type Row = { id: string; referrer_label: string; referred_label: string; referred_contact: string | null; status: string; source: string; notes: string | null; commission_amount: number; commission_eligible: boolean; created_at: string };
type Member = { user_id: string; email: string; created_at: string };

export default async function ReferralAdminPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_referral_admin");
  if (!isAdmin) redirect("/indique");

  const [rowsResult, membersResult] = await Promise.all([supabase.rpc("admin_list_referrals"), supabase.rpc("admin_list_members")]);
  const rows = (Array.isArray(rowsResult.data) ? rowsResult.data : []) as Row[];
  const members = (Array.isArray(membersResult.data) ? membersResult.data : []) as Member[];
  const due = rows.filter((r) => r.commission_eligible && r.status === "ativo").reduce((s, r) => s + Number(r.commission_amount), 0);
  const paid = rows.filter((r) => r.commission_eligible && r.status === "pago").reduce((s, r) => s + Number(r.commission_amount), 0);

  return (
    <div className="lp">
      <style>{`
        .ra h1 {font-size:clamp(26px,6vw,40px);margin:14px 0}
        .ra-grid {display:grid;gap:12px;margin-top:20px}
        .ra-item {border:1px solid var(--lp-line);border-radius:14px;padding:14px 18px;background:var(--lp-card);display:grid;gap:8px}
        .ra-item small {color:var(--lp-mut)}
        .ra-form {display:grid;gap:10px;max-width:520px}
        .ra-form input, .ra-form textarea, .ra-sel {background:#0a1317;border:1px solid var(--lp-line);color:var(--lp-ink);border-radius:10px;padding:12px;font-size:15px;min-height:44px}
        .ra-msg {color:var(--lp-acc2);font-size:14px;margin:0}
        .ra-err {color:#ff8f8f;font-size:14px;margin:0}
        .ra-members {list-style:none;padding:0;margin:12px 0 0;display:grid;gap:8px}
        .ra-members li {display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid var(--lp-line);border-radius:12px;padding:10px 14px}
        .ra-members button {background:transparent;border:1px solid var(--lp-line);color:var(--lp-mut);border-radius:8px;padding:6px 10px;cursor:pointer}
      `}</style>
      <header className="lp-nav"><div className="lp-wrap">
        <Link href="/" className="lp-logo"><Zap size={22} aria-hidden="true"/> TELEKTRO</Link>
        <Link href="/indique" style={{ fontSize: 14, color: "var(--lp-mut)" }}>Voltar</Link>
      </div></header>
      <main className="lp-wrap ra" style={{ padding: "32px 0 80px" }}>
        <span className="lp-eyebrow">Painel da equipe</span>
        <h1>Indicações</h1>
        <p className="lp-lead">Acompanhe quem indicou quem. Aqui só registramos: a comissão é paga manualmente, fora do sistema.</p>
        <div className="lp-stats" style={{ gridTemplateColumns: "repeat(3,1fr)", maxWidth: 680 }}>
          <div className="lp-stat"><b>{rows.length}</b><span>Indicações</span></div>
          <div className="lp-stat"><b>{formatBRL(due)}</b><span>A pagar</span></div>
          <div className="lp-stat"><b>{formatBRL(paid)}</b><span>Pago</span></div>
        </div>

        <h2 style={{ marginTop: 32 }}>Cadastrar indicação</h2>
        <AdminForms/>

        <h2 style={{ marginTop: 36 }}>Todas as indicações</h2>
        {rows.length === 0 ? <p className="lp-lead">Nenhuma indicação ainda.</p> : (
          <div className="ra-grid">
            {rows.map((r) => (
              <div key={r.id} className="ra-item">
                <div><strong>{r.referred_label}</strong> <small>indicado por {r.referrer_label}</small></div>
                <small>{r.referred_contact ?? "sem contato"} · {formatDate(r.created_at)} · {r.source === "admin" ? "cadastro da equipe" : "pelo link"}{r.commission_eligible ? "" : " · sem comissão (equipe)"}</small>
                {r.notes && <small>{r.notes}</small>}
                <StatusSelect id={r.id} status={r.status} label={statusLabel(r.status)}/>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ marginTop: 36 }}>Equipe com acesso</h2>
        <ul className="ra-members">
          {members.map((m) => (
            <li key={m.user_id}><span>{m.email}</span>
              {members.length > 1 && <form action={removeMemberAction}><input type="hidden" name="user_id" value={m.user_id}/><button type="submit">Remover</button></form>}
            </li>
          ))}
        </ul>
        <AdminForms members/>
      </main>
    </div>
  );
}
