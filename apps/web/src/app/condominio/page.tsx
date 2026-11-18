import type { Metadata } from "next";
import { CondoLanding } from "@/components/condo-landing";

export const metadata: Metadata = {
  title: "Carregador de carro elétrico no condomínio",
  description: "Gestão de carregadores, acesso de moradores, consumo em kWh e controle de demanda para não estourar a energia do prédio. Telektro Condomínio por R$199/mês.",
  alternates: { canonical: "/condominio" },
  openGraph: { title: "Carregador de carro elétrico no condomínio | Telektro", description: "Gestão de recargas e controle de demanda para síndicos e administradoras. R$199/mês.", url: "/condominio" },
};

export default function CondominioPage() {
  return <CondoLanding/>;
}
