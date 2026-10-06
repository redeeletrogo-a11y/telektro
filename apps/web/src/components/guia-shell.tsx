import Link from "next/link";
import { Zap } from "lucide-react";
import { WhatsAppButton } from "./whatsapp-button";
import { COMPANY_NOTE } from "@/lib/site";
import "./landing.css";
import "./guias.css";

export function GuiaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap">
          <Link href="/" className="lp-logo" aria-label="Telektro">
            <svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" fill="#0f776c"/><path fill="#fff" d="M112 118h288v78H300v198h-88V196h-100z"/><path fill="#bcebd1" d="m278 224-79 112h55l-23 90 91-132h-59l34-70z"/></svg>
            TELEKTRO
          </Link>
          <Link href="/login" className="lp-btn ghost">Entrar</Link>
        </div>
      </header>
      <main>{children}</main>
      <WhatsAppButton/>
      <footer className="lp-wrap lp-foot"><span><Zap size={13} style={{verticalAlign:"-2px"}}/> Telektro, operação de recarga</span><Link href="/guias">Guias</Link><Link href="/login">Entrar</Link><small className="lp-company">{COMPANY_NOTE}</small></footer>
    </div>
  );
}
