import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuiaShell } from "@/components/guia-shell";
import { GUIAS, getGuia } from "@/lib/guias";
import { SITE_URL } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return GUIAS.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = getGuia((await params).slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guias/${g.slug}` },
    openGraph: { type: "article", locale: "pt_BR", url: `/guias/${g.slug}`, title: g.title, description: g.description },
  };
}

export default async function GuiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuia((await params).slug);
  if (!g) notFound();
  const url = `${SITE_URL}/guias/${g.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", "@id": `${url}#article`, headline: g.title, description: g.description, inLanguage: "pt-BR", mainEntityOfPage: url, publisher: { "@id": `${SITE_URL}/#org` } },
      { "@type": "FAQPage", "@id": `${url}#faq`, inLanguage: "pt-BR", mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  return (
    <GuiaShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}/>
      <article className="lp-wrap gd">
        <div className="gd-crumb"><Link href="/">Início</Link> / <Link href="/guias">Guias</Link></div>
        <h1>{g.h1}</h1>
        <p className="gd-meta">Atualizado em {g.updated}. Conteúdo informativo, não é aconselhamento jurídico ou técnico.</p>
        <div className="gd-body">
          <p className="lp-lead" style={{ maxWidth: "none" }}>{g.intro}</p>
          {g.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              {s.p.map((t) => <p key={t}>{t}</p>)}
              {s.list && <ul>{s.list.map((i) => <li key={i}>{i}</li>)}</ul>}
            </section>
          ))}
          <h2>Perguntas frequentes</h2>
        </div>
        <div className="lp-faq" style={{ maxWidth: "70ch" }}>{g.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        <div className="gd-cta"><p>{g.cta.text}</p><Link href={g.cta.href} className="lp-btn primary">{g.cta.label}</Link></div>
      </article>
    </GuiaShell>
  );
}
