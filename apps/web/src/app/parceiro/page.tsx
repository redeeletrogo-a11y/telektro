import type { Metadata } from "next";
import { PartnerLanding } from "@/components/partner-landing";

export const metadata: Metadata = {
  title: "Seja parceiro Telektro: eletroposto completo no seu comércio",
  description: "Sua vaga ociosa pode render dinheiro. Eletroposto completo com carregador, instalação, sinalização e sistema de cobrança Telektro a partir de R$ 7.499. Sem mensalidade: 8% do faturamento bruto das recargas. Fale pelo WhatsApp.",
  alternates: { canonical: "/parceiro" },
  openGraph: { title: "Seja parceiro Telektro | Eletroposto completo", description: "Carregador, instalação e sistema de gestão a partir de R$ 7.499. Sem mensalidade: 8% do faturamento bruto das recargas.", url: "/parceiro" },
};

export default function ParceiroPage() {
  return <PartnerLanding/>;
}
