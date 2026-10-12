import type { Metadata } from "next";
import { CampaignLanding } from "@/components/campaign-landing";

export const metadata: Metadata = {
  title: "Software para eletroposto",
  description: "Recarga por QR Code, Pix ou cartão e relatórios de sessões e receita. Telektro Eletroposto sem mensalidade: 5% do faturamento bruto. Fale pelo WhatsApp e peça uma demonstração.",
  alternates: { canonical: "/eletroposto" },
  openGraph: { title: "Software para eletroposto | Telektro", description: "Gestão de recarga pública com QR Code e pagamentos. Sem mensalidade: 5% do faturamento bruto.", url: "/eletroposto" },
};

export default function EletropostoPage() {
  return <CampaignLanding profile="eletroposto"/>;
}
