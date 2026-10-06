// Guias públicos do Telektro. Para criar um novo guia, adicione um item em GUIAS.
export type GuiaSection = { h: string; p: string[]; list?: string[] };
export type Guia = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  updated: string;
  intro: string;
  sections: GuiaSection[];
  faq: { q: string; a: string }[];
  cta: { text: string; href: string; label: string };
};

export const GUIAS: Guia[] = [
  {
    slug: "carregador-carro-eletrico-condominio",
    title: "Carregador de carro elétrico em condomínio: guia do síndico",
    h1: "Carregador de carro elétrico em condomínio",
    description: "Como o condomínio pode instalar e gerir carregadores de carro elétrico: aprovação, projeto elétrico, medição do consumo e cobrança. Guia prático para síndicos e moradores.",
    updated: "outubro de 2026",
    intro: "Cada vez mais moradores chegam com carro elétrico e perguntam ao síndico como carregar na garagem. Este guia resume os pontos que o condomínio precisa resolver: autorização, parte elétrica, medição do consumo e cobrança.",
    sections: [
      {
        h: "1. Quem decide: assembleia e convenção",
        p: [
          "Instalar carregador envolve a garagem, a rede elétrica e, muitas vezes, áreas comuns. Por isso, o normal é levar o assunto à assembleia e conferir o que a convenção e o regimento interno dizem.",
          "O quórum e as regras variam conforme o condomínio e o tipo de obra. Alguns estados e cidades já têm lei própria sobre o tema, então vale conferir a regra local. Em caso de dúvida, consulte um advogado ou a administradora. Este guia não substitui orientação jurídica.",
        ],
      },
      {
        h: "2. Projeto elétrico feito por profissional",
        p: [
          "Um carregador consome bastante energia por várias horas. A instalação deve ser projetada por engenheiro eletricista, que avalia a capacidade da entrada de energia, o quadro e a distância até a vaga.",
          "A norma brasileira de referência para instalações de recarga de veículos elétricos é a ABNT NBR 17019. Em geral, cada carregador precisa de circuito e proteção próprios. Um laudo técnico ajuda a assembleia a decidir com segurança.",
        ],
      },
      {
        h: "3. Pontos individuais ou coletivos",
        p: ["Há dois formatos comuns, e cada condomínio escolhe o que cabe no seu caso:"],
        list: [
          "Ponto individual: o morador instala na própria vaga e arca com o custo e o consumo.",
          "Ponto coletivo: o condomínio instala um ou mais carregadores compartilhados e define quem usa e como paga.",
        ],
      },
      {
        h: "4. Como medir o consumo de cada morador",
        p: [
          "Quem usa o carregador deve pagar pela energia que consumiu. Há três caminhos: medidor individual, rateio estimado na taxa do condomínio ou medição por recarga (kWh) feita pelo próprio carregador.",
          "A medição por recarga dá um registro claro de cada sessão: quem carregou, quando e quantos kWh. É a base mais justa para o rateio e evita discussão em assembleia.",
        ],
      },
      {
        h: "5. Onde entra a gestão por software",
        p: [
          "Carregadores com OCPP, o protocolo padrão de comunicação, podem ser conectados a uma plataforma de gestão. No Telektro, o condomínio acompanha os carregadores em um painel, convida moradores por link ou QR Code e vê o consumo de cada um. O morador inicia e para a recarga pelo celular.",
          "O Telektro é o software de gestão. Ele não inclui o carregador nem a instalação elétrica. Usa OCPP 1.6J, então confirme a compatibilidade do modelo e do firmware do seu carregador e faça um teste de conexão antes de contratar. Os recursos dependem do equipamento.",
        ],
      },
      {
        h: "6. Checklist para o síndico",
        p: ["Antes de levar o tema à assembleia, reúna:"],
        list: [
          "Quantos moradores têm ou vão ter carro elétrico",
          "Laudo ou projeto de engenheiro eletricista com a capacidade da rede",
          "O que a convenção diz sobre obras e uso da garagem",
          "Modelo escolhido de carregador e se ele aceita OCPP",
          "Como o consumo será medido e cobrado de cada morador",
          "Quem cuida da manutenção e do suporte",
        ],
      },
    ],
    faq: [
      { q: "O condomínio é obrigado a instalar carregador?", a: "Em regra, não há obrigação geral no país. Algumas leis estaduais ou municipais tratam do tema, então confira a regra do seu estado e cidade e a convenção do condomínio." },
      { q: "Morador pode instalar carregador na própria vaga?", a: "Depende da convenção, da aprovação do condomínio e de um projeto elétrico seguro. O custo e o consumo costumam ser do morador. Consulte a administração antes de comprar o equipamento." },
      { q: "Como cobrar a energia de cada morador?", a: "Pode ser por medidor individual, rateio ou medição por recarga em kWh. A forma deve ser definida em assembleia. No Telektro, o consumo por sessão vem das leituras enviadas pelo carregador." },
      { q: "O Telektro funciona com qualquer carregador?", a: "Não. Ele usa OCPP 1.6J e o carregador precisa permitir configurar a conexão. Confirme o modelo e o firmware e faça um teste antes de contratar." },
    ],
    cta: { text: "Quer ver como o Telektro organiza carregadores e moradores no condomínio?", href: "/#condominio", label: "Ver plano Condomínio" },
  },
];

export const getGuia = (slug: string) => GUIAS.find((g) => g.slug === slug);
