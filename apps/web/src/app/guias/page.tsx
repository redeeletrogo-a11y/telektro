import type { Metadata } from "next";
import Link from "next/link";
import { GuiaShell } from "@/components/guia-shell";
import { GUIAS } from "@/lib/guias";

export const metadata: Metadata = {
  title: "Guias sobre carregador de carro elétrico",
  description: "Guias práticos sobre carregador de carro elétrico em casa, condomínio e eletroposto: instalação, medição de consumo, cobrança e OCPP.",
  alternates: { canonical: "/guias" },
};

export default function GuiasPage() {
  return (
    <GuiaShell>
      <section className="lp-wrap gd">
        <span className="lp-eyebrow">Guias</span>
        <h1>Guias sobre recarga de carro elétrico</h1>
        <p className="lp-lead">Conteúdo prático para quem tem, administra ou quer instalar carregadores.</p>
      </section>
      <div className="lp-wrap gd-list">
        {GUIAS.map((g) => (
          <Link key={g.slug} href={`/guias/${g.slug}`} className="lp-card">
            <h2>{g.h1}</h2>
            <p>{g.description}</p>
            <p style={{ marginTop: 12, color: "var(--lp-acc)", fontWeight: 700 }}>Ler guia →</p>
          </Link>
        ))}
      </div>
    </GuiaShell>
  );
}
