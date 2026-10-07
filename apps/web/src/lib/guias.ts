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
  {
    "slug": "como-montar-eletroposto",
    "title": "Como montar um eletroposto: planejamento, instalação e gestão",
    "h1": "Como montar um eletroposto",
    "description": "Planeje um eletroposto em comércio ou terreno: demanda, instalação elétrica, escolha do carregador, custos e gestão das recargas.",
    "intro": "Um comércio, estacionamento ou terreno pode receber um ponto de recarga. Mas comprar o carregador é só uma parte do projeto. Antes de investir, avalie quem vai usar, por quanto tempo, quanto custa operar e como acompanhar cada recarga.",
    "sections": [
      {
        "h": "1. Comece pelo público e pelo local",
        "p": [
          "Pense na rotina de quem passa pelo endereço: clientes que ficam algumas horas, moradores da região ou motoristas em viagem. O tempo de permanência ajuda a escolher o serviço e o equipamento.",
          "Verifique acesso, horário de funcionamento, espaço para manobra, sinalização e quem atende se houver uma falha. Um terreno disponível, sozinho, não prova que haverá demanda."
        ]
      },
      {
        "h": "2. Avalie a rede elétrica antes de comprar",
        "p": [
          "Peça a um profissional habilitado um estudo da capacidade da instalação e das adaptações necessárias. Confirme com a distribuidora se a ligação atende ao projeto e quais mudanças serão exigidas.",
          "Inclua no orçamento projeto, obras, proteções, aterramento e eventual adequação da entrada de energia. Siga o manual do modelo e as normas aplicáveis. Não escolha cabos ou disjuntores por uma receita genérica da internet."
        ]
      },
      {
        "h": "3. Escolha o carregador para o uso previsto",
        "p": [
          "Compare potência, conectores, assistência, garantia, conexão de dados e o que o veículo consegue receber. A potência anunciada não garante a mesma velocidade para todos os carros.",
          "Se pretende gerir o ponto pelo Telektro, confirme OCPP 1.6J, liberdade para configurar um servidor externo e compatibilidade do firmware. O protocolo informado na ficha técnica não substitui um teste de conexão e recarga."
        ]
      },
      {
        "h": "4. Faça a conta da operação",
        "p": [
          "Não confunda faturamento com lucro. Estime custos fixos, energia, manutenção, taxas de pagamento e software. Compare cenários de utilização baixa, média e alta, sem tratar a melhor hipótese como receita garantida.",
          "Segundo a ANEEL, a atividade de recarga pode ser explorada comercialmente com preços livremente negociados. Isso não dispensa projeto seguro nem a verificação das exigências locais com a prefeitura, distribuidora e profissionais responsáveis."
        ],
        "list": [
          "Investimento inicial: equipamento, projeto, obras e sinalização",
          "Custos recorrentes: energia, conectividade, manutenção e gestão",
          "Receita estimada: energia vendida e preço ao cliente",
          "Prazo de retorno: depende da procura e de todos os custos, não só do carregador"
        ]
      },
      {
        "h": "5. Organize pagamento e acompanhamento",
        "p": [
          "No Telektro, o eletroposto pode disponibilizar um QR para o motorista acessar a recarga pré-paga. A liberação depende da confirmação do pagamento e da resposta do carregador. O consumo medido serve de base para a cobrança.",
          "O dono acompanha vendas e consumo no painel. O Telektro é software: não inclui equipamento, instalação nem garantia de demanda. Confirme condições comerciais, pagamento e repasse antes de contratar."
        ]
      },
      {
        "h": "6. Abra com um piloto validado",
        "p": [
          "Teste o caminho inteiro antes de divulgar: conexão, início e parada, medição, pagamento, sobra não consumida e falha de início. Combine quem presta suporte e como o cliente pede ajuda."
        ],
        "list": [
          "Valide o modelo e o firmware com a plataforma",
          "Conclua o projeto e a instalação com o responsável técnico",
          "Defina preço, regras de uso e atendimento",
          "Confira a recarga e a cobrança com o equipamento real",
          "Acompanhe utilização e custos antes de ampliar"
        ]
      }
    ],
    "faq": [
      {
        "q": "Quanto custa montar um eletroposto?",
        "a": "Não há um valor único. Potência, equipamento, obra e capacidade elétrica mudam o orçamento. Peça propostas para o mesmo escopo e inclua os custos de operação."
      },
      {
        "q": "Posso cobrar pela recarga?",
        "a": "A ANEEL permite exploração comercial da recarga com preços livremente negociados. Verifique também as exigências locais e as obrigações da sua operação com profissionais responsáveis."
      },
      {
        "q": "Um eletroposto dá lucro garantido?",
        "a": "Não. O resultado depende de demanda, preço, utilização e custos. Faça cenários e valide o ponto antes de ampliar."
      },
      {
        "q": "O Telektro inclui o carregador?",
        "a": "Não. É o software de gestão. Equipamento, instalação e compatibilidade devem ser avaliados separadamente."
      }
    ],
    "cta": {
      "text": "Quer conhecer a gestão das recargas para seu eletroposto?",
      "href": "/#eletroposto",
      "label": "Ver plano Eletroposto"
    },
    "updated": "outubro de 2026"
  },
];

export const getGuia = (slug: string) => GUIAS.find((g) => g.slug === slug);
