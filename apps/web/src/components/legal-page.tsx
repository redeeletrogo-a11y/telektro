import { GuiaShell } from "./guia-shell";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <GuiaShell>
      <article className="lp-wrap gd">
        <h1>{title}</h1>
        <p className="gd-meta">Última atualização: {updated}</p>
        <div className="gd-body">{children}</div>
      </article>
    </GuiaShell>
  );
}
