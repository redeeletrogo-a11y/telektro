import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Navigation, MessageCircle, Zap, Clock, Plug, CreditCard } from "lucide-react";
import { GuiaShell } from "@/components/guia-shell";
import { SITE_URL, whatsappUrl } from "@/lib/site";

const SLUG = "/eletropostos/unifarma-barreta";
const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=UniFarma+Barreta&query_place_id=ChIJD89MdpSNsgcRL-wR-Lb07uE";
const WHATSAPP_MSG = "Olá! Quero combinar uma recarga no eletroposto Unifarma Barreta.";

const FAQ = [
  { q: "Precisa de aplicativo para carregar?", a: "Não. A recarga é feita pelo celular apontando a câmera para o QR Code no carregador: abre a página de recarga, paga por Pix ou cartão e pronto. Não precisa baixar app nem criar conta." },
  { q: "Quanto custa carregar no eletroposto Unifarma Barreta?", a: "A tarifa atual é de R$ 2,00 por kWh. Você define o valor antes de começar e paga só pela energia usada na sessão." },
  { q: "Qual o horário de funcionamento?", a: "O ponto fica disponível 24 horas. Combine pelo WhatsApp antes de ir, inclusive à noite, para o responsável liberar o atendimento." },
  { q: "Que carros podem carregar?", a: "Qualquer carro elétrico ou híbrido plug-in com entrada Tipo 2 (padrão europeu, o mais comum no Brasil). O conector entrega até 7 kW em corrente alternada (AC)." },
  { q: "Onde fica o eletroposto?", a: "Na farmácia UniFarma, na Av. Beira Mar, Barreta, em Nísia Floresta/RN, litoral sul do Rio Grande do Norte, perto da praia de Barreta e do acesso à Pipa." },
];

export const metadata: Metadata = {
  title: "Eletroposto Unifarma Barreta: recarga de carro elétrico em Nísia Floresta/RN",
  description: "Eletroposto na UniFarma Barreta, Av. Beira Mar, Nísia Floresta/RN. Conector Tipo 2 até 7 kW, aberto 24 horas, R$ 2,00/kWh. Recarga sem app: pague por Pix ou cartão.",
  alternates: { canonical: SLUG },
  openGraph: {
    title: "Eletroposto Unifarma Barreta | Telektro",
    description: "Recarga de carro elétrico em Nísia Floresta/RN: Tipo 2 até 7 kW, 24 horas, R$ 2,00/kWh. Sem app, pague por Pix ou cartão.",
    url: SLUG,
  },
};

export default function EletropostoUnifarmaBarretaPage() {
  const url = `${SITE_URL}${SLUG}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${url}#posto`,
        name: "Eletroposto Unifarma Barreta",
        description: "Ponto de recarga para carros elétricos na farmácia UniFarma Barreta, em Nísia Floresta/RN. Conector Tipo 2 de até 7 kW, aberto 24 horas, tarifa de R$ 2,00/kWh. Recarga sem app, com pagamento por Pix ou cartão.",
        url,
        image: `${SITE_URL}/eletropostos-unifarma-barreta.webp`,
        address: { "@type": "PostalAddress", streetAddress: "Av. Beira Mar, Barreta", addressLocality: "Nísia Floresta", addressRegion: "RN", postalCode: "59164-000", addressCountry: "BR" },
        geo: { "@type": "GeoCoordinates", latitude: -6.1078385, longitude: -35.1028724 },
        openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "00:00", closes: "23:59" },
        priceRange: "R$ 2,00/kWh",
        currenciesAccepted: "BRL",
        paymentAccepted: "Pix, Credit Card",
        amenityFeature: [{ "@type": "LocationFeatureSpecification", name: "Recarga de veículo elétrico", value: true }, { "@type": "LocationFeatureSpecification", name: "Conector Tipo 2 até 7 kW", value: true }],
        parentOrganization: { "@id": `${SITE_URL}/#org` },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: "pt-BR",
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
  return (
    <GuiaShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}/>
      <article className="lp-wrap gd">
        <div className="gd-crumb"><Link href="/">Início</Link> / <Link href="/#onde-carregar">Onde carregar</Link></div>
        <h1>Eletroposto Unifarma Barreta: recarga de carro elétrico em Nísia Floresta/RN</h1>
        <p className="gd-meta">Ponto público de recarga operado pela Telektro, na farmácia UniFarma Barreta, litoral sul do RN.</p>
        <div className="gd-body">
          <p className="lp-lead" style={{ maxWidth: "none" }}>Carregue seu carro elétrico na Barreta, em Nísia Floresta/RN, sem baixar aplicativo: aponte a câmera para o QR Code no carregador, pague por Pix ou cartão e acompanhe a sessão na tela do celular.</p>
          <img className="lp-loc-photo" src="/eletropostos-unifarma-barreta.webp" alt="Carregador do eletroposto Unifarma Barreta com a placa Recarga sem app da Telektro" style={{ maxWidth: 520, width: "100%", borderRadius: 12 }}/>
          <section>
            <h2>Onde fica</h2>
            <p><MapPin size={15} style={{ verticalAlign: "-2px" }} aria-hidden="true"/> Av. Beira Mar, Barreta, Nísia Floresta/RN, CEP 59164-000, dentro da farmácia UniFarma. O posto atende quem está na Barreta, na região das praias de Búzios e Pirangi e no caminho da Pipa.</p>
            <p><a className="lp-btn primary" href={MAPS_URL} target="_blank" rel="noopener noreferrer"><Navigation size={16}/> Como chegar</a> <a className="lp-btn ghost" href={whatsappUrl(WHATSAPP_MSG)} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/> Combinar pelo WhatsApp</a></p>
          </section>
          <section>
            <h2>Como carregar, sem app</h2>
            <ul>
              <li>Estacione na vaga do carregador, na UniFarma Barreta.</li>
              <li>Aponte a câmera do celular para o QR Code no carregador.</li>
              <li>Escolha o valor, pague por Pix ou cartão e a recarga começa.</li>
            </ul>
          </section>
          <section>
            <h2>Conector, preço e horário</h2>
            <ul>
              <li><Plug size={15} style={{ verticalAlign: "-2px" }} aria-hidden="true"/> 1 conector Tipo 2 (AC), até 7 kW.</li>
              <li><CreditCard size={15} style={{ verticalAlign: "-2px" }} aria-hidden="true"/> Tarifa atual de R$ 2,00 por kWh, paga por Pix ou cartão.</li>
              <li><Clock size={15} style={{ verticalAlign: "-2px" }} aria-hidden="true"/> Disponível 24 horas. Combine pelo WhatsApp antes de ir, inclusive à noite.</li>
              <li><Zap size={15} style={{ verticalAlign: "-2px" }} aria-hidden="true"/> Operação e suporte pela Telektro.</li>
            </ul>
          </section>
          <h2>Perguntas frequentes</h2>
        </div>
        <div className="lp-faq" style={{ maxWidth: "70ch" }}>{FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        <div className="gd-cta"><p>Tem um comércio e quer um eletroposto como esse? A Telektro cuida da operação e da cobrança.</p><Link href="/eletroposto" className="lp-btn primary">Conhecer o software para eletroposto</Link></div>
      </article>
    </GuiaShell>
  );
}
