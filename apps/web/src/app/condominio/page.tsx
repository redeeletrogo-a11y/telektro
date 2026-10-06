import type { Metadata } from "next";
import { CampaignLanding } from "@/components/campaign-landing";

export const metadata: Metadata = {
  title: "Carregador de carro elétrico no condomínio",
  description: "Gestão de carregadores, acesso de moradores e consumo em kWh. Telektro Condomínio por R$199/mês. Fale pelo WhatsApp e peça uma demonstração.",
  alternates: { canonical: "/condominio" },
  openGraph: { title: "Carregador de carro elétrico no condomínio | Telektro", description: "Gestão de recargas para síndicos e administradoras. R$199/mês.", url: "/condominio" },
};

export default function CondominioPage() {
  return <CampaignLanding profile="condominio"/>;
}
