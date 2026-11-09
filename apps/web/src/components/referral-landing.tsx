import Link from "next/link";
import { Banknote, Gift, MessageCircle, Share2, Users, Zap } from "lucide-react";
import { COMPANY_NOTE } from "@/lib/site";
import { formatBRL, formatDate, statusLabel, type MyReferral } from "@/lib/referral";
import { CopyButton } from "@/components/referral-copy";
import "./landing.css";

export type ReferralBanner = { kind: "preview" | "bound"; name: string | null };

export type ReferralPanelData = {
  code: string;
  link: string;
  referrals: MyReferral[];
  isAdmin: boolean;
  email: string;
};

const steps = [
  { icon: Gift, title: "Pegue seu código", text: "Crie sua conta e receba um código e um link só seus, prontos para compartilhar." },
  { icon: Share2, title: "Compartilhe", text: "Envie o link para donos de comércio, síndicos e administradores que poderiam ter um ponto de recarga." },
  { icon: Banknote, title: "Acompanhe e receba", text: "Quando o ponto do seu indicado entrar em operação, a comissão de R$ 250 é liberada e paga no seu Pix." },
];

const rules = [
  "Comissão única de R$ 250 por indicação válida, sem limite de indicações.",
  "A indicação vale para novos clientes: a pessoa precisa criar a conta Telektro pelo seu link ou código.",
  "A comissão é liberada quando o ponto do indicado entra em operação com a Telektro.",
  "O pagamento é feito pela equipe Telektro via Pix; você acompanha cada etapa aqui nesta página.",
  "Não vale autoindicação nem contas que já existiam antes do uso do código.",
  "O programa pode ser ajustado ou encerrado a qualquer momento, respeitando as indicações já ativadas.",
];

const faq = [
  { q: "Quando eu recebo?", a: "Quando o ponto do seu indicado entrar em operação com a Telektro. Você acompanha o status nesta página: ao mudar para \"Ponto ativado\", a comissão está liberada para pagamento." },
  { q: "Como eu recebo?", a: "Via Pix, pago pela equipe Telektro. Nada é cobrado de você em nenhuma etapa." },
  { q: "Quantas pessoas posso indicar?", a: "Quantas quiser. Cada indicação válida vale R$ 250, sem teto." },
  { q: "O que meu indicado precisa fazer?", a: "Criar a conta pelo seu link e conversar com a Telektro sobre o ponto de recarga. Nós cuidamos de todo o resto." },
];

function shareText(link: string) {
  return `Recarga de carro elétrico no seu comércio ou condomínio, com cobrança por QR Code e sem mensalidade. Conheça a Telektro pelo meu link: ${link}`;
}

function Banner({ banner }: { banner: ReferralBanner }) {
  const who = banner.name ?? "um parceiro Telektro";
  return (
    <div className="rf-banner" role="status">
      {banner.kind === "preview"
        ? <>Você foi indicado por <strong>{who}</strong>. Crie sua conta por aqui para a indicação valer.</>
        : <>Indicação registrada: sua conta foi vinculada a <strong>{who}</strong>.</>}
    </div>
  );
}

function ReferralPanel({ panel }: { panel: ReferralPanelData }) {
  const eligible = panel.referrals.filter((r) => r.commission_eligible);
  const due = eligible.filter((r) => r.status === "ativo").reduce((s, r) => s + Number(r.commission_amount), 0);
  const paid = eligible.filter((r) => r.status === "pago").reduce((s, r) => s + Number(r.commission_amount), 0);
  const waShare = `https://wa.me/?text=${encodeURIComponent(shareText(panel.link))}`;
  return (
    <section className="lp-wrap rf-hero" aria-labelledby="rf-title">
      <span className="lp-eyebrow">Programa de indicação</span>
      <h1 id="rf-title">Seu link de indicação</h1>
      <p className="lp-lead">Compartilhe com quem pode ter um ponto de recarga. Quando o ponto do indicado entrar em operação, você recebe {formatBRL(250)} no Pix.</p>

      <div className="rf-code-card">
        <div className="rf-code-row">
          <span className="rf-code" aria-label={`Seu código: ${panel.code}`}>{panel.code}</span>
          <CopyButton text={panel.link} label="Copiar link" className="lp-btn primary"/>
        </div>
        <p className="rf-link">{panel.link}</p>
        <div className="rf-share-row">
          <a className="lp-btn ghost" href={waShare} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true"/> Enviar pelo WhatsApp</a>
        </div>
      </div>

      <div className="lp-stats rf-stats">
        <div className="lp-stat"><b>{panel.referrals.length}</b><span>Indicações</span></div>
        <div className="lp-stat"><b>{formatBRL(due)}</b><span>A receber</span></div>
        <div className="lp-stat"><b>{formatBRL(paid)}</b><span>Recebido</span></div>
      </div>

      <h2 className="rf-list-title">Suas indicações</h2>
      {panel.referrals.length === 0
        ? <p className="rf-empty">Nenhuma indicação ainda. Envie seu link para começar.</p>
        : <ul className="rf-list">
            {panel.referrals.map((r) => (
              <li key={r.id} className="rf-item">
                <div>
                  <strong>{r.label}</strong>
                  <span className="rf-item-date">{formatDate(r.created_at)}</span>
                </div>
                <div className="rf-item-right">
                  {r.commission_eligible && (r.status === "ativo" || r.status === "pago") && <span className="rf-item-value">{formatBRL(Number(r.commission_amount))}</span>}
                  <span className={`rf-chip rf-chip-${r.status}`}>{statusLabel(r.status)}</span>
                </div>
              </li>
            ))}
          </ul>}

      {panel.isAdmin && <p className="rf-admin-link"><Link href="/indique/admin">Painel da equipe →</Link></p>}
    </section>
  );
}

export function ReferralLanding({ banner, panel }: { banner: ReferralBanner | null; panel: ReferralPanelData | null }) {
  return (
    <div className="lp campaign rf">
      <style>{`
        .rf .campaign-header {height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .rf .campaign-header nav {display:flex;gap:18px;font-size:14px;color:var(--lp-mut)}
        .rf .campaign-header nav a:hover {color:var(--lp-ink)}
        .rf-banner {background:#12332f;border-bottom:1px solid var(--lp-acc);color:var(--lp-acc2);text-align:center;padding:12px 20px;font-size:15px}
        .rf-banner strong {color:var(--lp-ink)}
        .rf-hero {padding:40px 0 8px}
        .rf-hero h1 {font-size:clamp(30px,7vw,52px);line-height:1.08;margin:18px 0 14px}
        .rf-code-card {border:1px solid var(--lp-acc);border-radius:18px;background:#0d211d;padding:22px;margin-top:26px;max-width:680px;display:grid;gap:12px}
        .rf-code-row {display:flex;gap:12px;align-items:center;flex-wrap:wrap}
        .rf-code {font-size:clamp(30px,8vw,44px);font-weight:700;letter-spacing:.14em;color:var(--lp-acc2)}
        .rf-link {margin:0;color:var(--lp-mut);font-size:14px;word-break:break-all}
        .rf-share-row {display:flex;gap:10px;flex-wrap:wrap}
        .rf-stats {padding-bottom:0;margin-top:26px;max-width:680px;grid-template-columns:repeat(3,1fr)}
        .rf-list-title {margin:34px 0 14px;font-size:clamp(20px,4vw,26px)}
        .rf-empty {color:var(--lp-mut)}
        .rf-list {list-style:none;padding:0;margin:0;display:grid;gap:10px;max-width:680px}
        .rf-item {display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid var(--lp-line);border-radius:14px;padding:14px 18px;background:var(--lp-card)}
        .rf-item strong {display:block;font-size:16px}
        .rf-item-date {color:var(--lp-mut);font-size:13px}
        .rf-item-right {display:flex;align-items:center;gap:10px;flex-shrink:0}
        .rf-item-value {color:var(--lp-acc2);font-weight:700;font-size:15px}
        .rf-chip {padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;border:1px solid var(--lp-line);color:var(--lp-mut)}
        .rf-chip-ativo {border-color:var(--lp-acc);color:var(--lp-acc2)}
        .rf-chip-pago {background:#12332f;border-color:var(--lp-acc);color:var(--lp-acc2)}
        .rf-admin-link {margin-top:22px}
        .rf-admin-link a {color:var(--lp-acc)}
        .rf-rules {list-style:none;padding:0;margin:0;display:grid;gap:10px}
        .rf-rules li {display:flex;gap:10px;align-items:flex-start;color:#cfdde1;font-size:15px}
        .rf-rules svg {flex-shrink:0;color:var(--lp-acc);margin-top:3px}
        .rf-faq {display:grid;gap:12px;max-width:680px}
        .rf-faq details {padding:16px 20px}
        .rf-faq summary {cursor:pointer;font-weight:700;font-size:16px}
        .rf-faq details p {margin:10px 0 0;color:var(--lp-mut);font-size:15px}
        .rf .campaign-footer {padding:28px 0 60px;color:var(--lp-mut);font-size:12px;border-top:1px solid var(--lp-line)}
        @media(min-width:900px){
          .rf-hero {padding-top:56px}
        }
      `}</style>
      <header className="lp-nav"><div className="lp-wrap campaign-header">
        <Link href="/" className="lp-logo"><Zap size={22} aria-hidden="true"/> TELEKTRO</Link>
        <nav>
          {panel
            ? <Link href="/">Meu painel</Link>
            : <><Link href="/login">Entrar</Link></>}
        </nav>
      </div></header>
      <main>
        {banner && <Banner banner={banner}/>}

        {panel ? <ReferralPanel panel={panel}/> : (
          <section className="lp-wrap lp-hero" aria-labelledby="rf-title" style={{ paddingBottom: 0 }}>
            <span className="lp-eyebrow">Programa de indicação Telektro</span>
            <h1 id="rf-title">Indique a Telektro e ganhe <em>R$ 250</em></h1>
            <p className="lp-lead">Conhece um comércio ou condomínio que poderia ter recarga de carro elétrico? Compartilhe seu link. Quando o ponto do seu indicado entrar em operação, você recebe R$ 250 no Pix.</p>
            <div className="lp-cta">
              <Link className="lp-btn primary" href="/register">Pegar meu código</Link>
              <Link className="lp-btn ghost" href="/login">Já tenho conta</Link>
            </div>
          </section>
        )}

        <section className="lp-sec" aria-labelledby="rf-como"><div className="lp-wrap">
          <h2 id="rf-como">Como funciona</h2>
          <div className="lp-grid c3" style={{ marginTop: 24 }}>
            {steps.map((s) => (
              <div key={s.title} className="lp-card">
                <div className="lp-ico"><s.icon size={22} aria-hidden="true"/></div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div></section>

        <section className="lp-sec" aria-labelledby="rf-regras"><div className="lp-wrap">
          <h2 id="rf-regras">Regras do programa</h2>
          <p className="lp-sub">Sem letra miúda: o que você vê aqui é o que vale.</p>
          <div className="lp-card" style={{ maxWidth: 680 }}>
            <div className="lp-ico"><Users size={22} aria-hidden="true"/></div>
            <ul className="rf-rules" style={{ marginTop: 14 }}>
              {rules.map((r) => <li key={r}><Banknote size={16} aria-hidden="true"/><span>{r}</span></li>)}
            </ul>
          </div>
        </div></section>

        <section className="lp-sec" aria-labelledby="rf-duvidas"><div className="lp-wrap">
          <h2 id="rf-duvidas">Perguntas frequentes</h2>
          <div className="rf-faq" style={{ marginTop: 24 }}>
            {faq.map((f) => <details key={f.q} className="lp-card"><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </div></section>

        <footer className="lp-wrap campaign-footer">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, width: "100%" }}>
            <span>{COMPANY_NOTE}</span>
            <span><Link href="/privacidade">Privacidade</Link> · <Link href="/termos">Termos</Link></span>
          </div>
        </footer>
      </main>
    </div>
  );
}
