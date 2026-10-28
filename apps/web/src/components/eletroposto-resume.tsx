"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BatteryCharging } from "lucide-react";
import { eletropostoStatus } from "@/app/carregar/actions";
import { ACTIVE_STATUSES, clearActiveSession, readActiveSession } from "@/lib/eletroposto-resume";

// Mostra "Voltar a minha recarga" so se ESTE navegador guardou o link de uma recarga ativa deste mesmo ponto.
// Quem apenas escaneia o QR (outro aparelho, sem o link) ve a tela normal e nunca o andamento de outra pessoa.
export function ResumeBanner({ code }: { code: string }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const saved = readActiveSession(code);
    if (!saved) return;
    let alive = true;
    eletropostoStatus(saved).then((status) => {
      if (!alive) return;
      if (status && status.pointCode === code && ACTIVE_STATUSES.includes(status.status)) setToken(saved);
      else clearActiveSession(code);
    }).catch(() => { /* sem internet: nao apaga, tenta no proximo acesso */ });
    return () => { alive = false; };
  }, [code]);
  if (!token) return null;
  return <section className="ep-card ep-resume" role="status">
    <p className="eyebrow">RECARGA EM ANDAMENTO</p>
    <p className="ep-sub">Você tem uma recarga neste aparelho.</p>
    <Link className="ep-primary" href={`/carregar/pagamento/${token}`}><BatteryCharging size={18} aria-hidden="true"/> Voltar à minha recarga</Link>
  </section>;
}
