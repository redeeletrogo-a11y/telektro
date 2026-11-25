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
          "Como referência de mercado, publicações do setor em 2026 indicam wallbox AC de 7 a 22 kW entre R$ 3.000 e R$ 12.000, instalação entre R$ 1.500 e R$ 5.000 e carregadores DC de 30 a 120 kW de cerca de R$ 31.000 a mais de R$ 280.000, conforme potência e marca. São faixas de anúncios públicos, não orçamento: peça propostas para o mesmo escopo. O guia sobre quanto custa abrir um eletroposto detalha cada componente.",
          "Segundo a ANEEL, a atividade de recarga pode ser explorada comercialmente com preços livremente negociados. Isso não dispensa projeto seguro nem a verificação das exigências locais com a prefeitura, distribuidora e profissionais responsáveis."
        ],
        "list": [
          "Investimento inicial: equipamento, projeto, obras e sinalização",
          "Adequação elétrica: entrada de energia e, em projetos DC, eventual transformador",
          "Custos recorrentes: energia, conectividade, manutenção e gestão",
          "Receita estimada: energia vendida e preço ao cliente",
          "Prazo de retorno: depende da procura e de todos os custos, não só do carregador"
        ]
      },
      {
        "h": "5. Formalize a operação",
        "p": [
          "Cobrar pela recarga é uma atividade econômica. Em geral, o operador abre um CNPJ, verifica alvará e enquadramento fiscal e contrata a energia adequada ao uso comercial. Confirme com um contador e com a prefeitura como emitir nota e recolher tributos no seu caso.",
          "As exigências variam por município e pelo formato da operação. Este guia não substitui orientação jurídica, contábil ou técnica."
        ]
      },
      {
        "h": "6. Organize pagamento e acompanhamento",
        "p": [
          "No Telektro, o eletroposto pode disponibilizar um QR para o motorista acessar a recarga pré-paga. A liberação depende da confirmação do pagamento e da resposta do carregador. O consumo medido serve de base para a cobrança.",
          "O dono acompanha vendas e consumo no painel. O Telektro é software: não inclui equipamento, instalação nem garantia de demanda. Confirme condições comerciais, pagamento e repasse antes de contratar."
        ]
      },
      {
        "h": "7. Abra com um piloto validado",
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
        "a": "Não há um valor único. Publicações do setor em 2026 indicam um ponto AC comercial a partir de alguns milhares de reais e projetos com carregador DC a partir de dezenas de milhares. O guia sobre quanto custa abrir um eletroposto traz as faixas por componente."
      },
      {
        "q": "Preciso de CNPJ para cobrar pela recarga?",
        "a": "Em geral, sim: a exploração comercial costuma exigir pessoa jurídica, com obrigações fiscais e locais. Confirme o enquadramento com um contador e com a prefeitura antes de investir."
      },
      {
        "q": "Quanto fatura um eletroposto?",
        "a": "Não existe faturamento típico garantido. O resultado depende de localização, preço por kWh, utilização e custos. Monte cenários com os dados do seu ponto e desconfie de promessa de renda fixa."
      },
      {
        "q": "Quanto tempo leva para abrir um eletroposto?",
        "a": "Depende do projeto, da obra e da análise da distribuidora. Um ponto AC simples pode levar semanas; projetos com adequação de rede ou transformador levam mais. Inclua esse prazo no planejamento."
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
    "updated": "novembro de 2026"
  },
  {
    "slug": "ocpp-1-6j-compatibilidade-carregador",
    "title": "OCPP 1.6J: como saber se seu carregador é compatível",
    "h1": "OCPP 1.6J e compatibilidade de carregadores",
    "description": "Entenda o que é OCPP 1.6J e o que confirmar no modelo e firmware para conectar um carregador ao Telektro.",
    "intro": "OCPP é o protocolo de comunicação entre o carregador e a plataforma de gestão. A sigla na ficha técnica é um ponto de partida, não uma garantia de que qualquer equipamento terá todos os recursos. Veja o que perguntar ao fornecedor e como validar a conexão.",
    "sections": [
      {
        "h": "1. O que o OCPP conecta",
        "p": [
          "A Open Charge Alliance descreve o OCPP como um protocolo de comunicação entre estações de recarga e sistemas de gestão, também chamados de CSMS. Ele não é o conector físico do carro e não define a potência da recarga.",
          "O carregador envia informações e recebe comandos da plataforma. No Telektro, essa comunicação permite acompanhar o estado do equipamento, receber leituras e solicitar início ou parada, conforme os recursos e a configuração do modelo."
        ]
      },
      {
        "h": "2. Por que a versão 1.6J importa",
        "p": [
          "O OCPP 1.6 tem versões SOAP e JSON. O Telektro usa a versão JSON por WebSocket, conhecida como OCPP 1.6J. Pergunte pelo formato completo, não apenas se o carregador tem OCPP.",
          "A Open Charge Alliance informa que OCPP 1.6 e OCPP 2.0.1 não são compatíveis entre si. Um equipamento que anuncia apenas 2.0.1 não fica automaticamente compatível com o Telektro; confirme se também oferece 1.6J e se essa opção pode ser configurada."
        ]
      },
      {
        "h": "3. Pergunte se o servidor pode ser alterado",
        "p": [
          "Alguns equipamentos vêm configurados para uma plataforma do fabricante. Antes da compra, confirme se o proprietário consegue informar o endereço do servidor externo e se isso depende de licença, suporte ou atualização.",
          "Peça o manual de configuração do modelo e a versão de firmware. Não publique credenciais nem o endereço de conexão com dados de autenticação em fóruns ou grupos."
        ],
        "list": [
          "O modelo suporta OCPP 1.6 JSON por WebSocket?",
          "Posso configurar meu próprio CSMS?",
          "Existe custo ou restrição para liberar essa função?",
          "Qual firmware será entregue e quem configura a conexão?",
          "Que leituras e comandos foram testados nessa versão?"
        ]
      },
      {
        "h": "4. Recursos precisam ser testados",
        "p": [
          "Ter OCPP não significa que todos os recursos previstos no protocolo estejam ativos no equipamento ou implementados pela plataforma. Valide início remoto, parada, estado dos conectores e leitura de energia.",
          "A energia usada no painel depende das leituras que o carregador envia. Não deduza kWh apenas multiplicando potência nominal pelo tempo. A porcentagem da bateria também depende do que o equipamento e o veículo informam; não conte com ela sem teste."
        ]
      },
      {
        "h": "5. Faça um teste com o equipamento real",
        "p": [
          "Combine uma conexão de teste com o fornecedor e a equipe de suporte. Confira se o carregador aparece conectado, se o comando é aceito e se a sessão realmente começa e termina.",
          "Compare as leituras de início, fim e consumo com os registros do equipamento. Teste também desconexão e retorno da rede, sem presumir que uma função offline existe. Um teste em simulador ajuda no software, mas não valida o firmware do carregador."
        ]
      },
      {
        "h": "6. Checklist antes de contratar",
        "p": [
          "Guarde modelo, firmware, manual e resultado dos testes. Isso evita comprar com base apenas em uma promessa genérica de compatibilidade."
        ],
        "list": [
          "Versão OCPP e formato confirmados por escrito",
          "Servidor externo configurável e custos esclarecidos",
          "Rede de dados disponível no local",
          "Início, parada e medição validados em recarga real",
          "Suporte e responsabilidades combinados"
        ]
      }
    ],
    "faq": [
      {
        "q": "OCPP 1.6 é o mesmo que OCPP 1.6J?",
        "a": "Não necessariamente. OCPP 1.6 tem versões SOAP e JSON; o Telektro usa JSON por WebSocket, chamada de 1.6J."
      },
      {
        "q": "OCPP 2.0.1 funciona automaticamente no Telektro?",
        "a": "Não. OCPP 1.6 e 2.0.1 não são compatíveis entre si. Confirme se o equipamento também suporta 1.6J."
      },
      {
        "q": "Qualquer carregador com OCPP funciona?",
        "a": "Não há garantia só pela sigla. É necessário confirmar modelo, firmware, configuração de servidor e testar os recursos usados."
      },
      {
        "q": "O OCPP garante mostrar a bateria do carro?",
        "a": "Não. A informação precisa ser fornecida pelo equipamento e pelo veículo. Confirme em teste e não trate esse dado como disponível em todos os modelos."
      }
    ],
    "cta": {
      "text": "Conheça os usos do Telektro e confirme seu equipamento antes de contratar.",
      "href": "/",
      "label": "Conhecer o Telektro"
    },
    "updated": "outubro de 2026"
  },
  {
    "slug": "carregador-carro-eletrico-casa-celular",
    "title": "Carregador em casa: controle pelo celular e medição em kWh",
    "h1": "Carregador em casa: controle e consumo pelo celular",
    "description": "Veja como planejar a recarga em casa, confirmar a compatibilidade do carregador e acompanhar o consumo em kWh pelo celular.",
    "intro": "Quem carrega o carro em casa precisa de uma instalação segura e de uma forma clara de acompanhar o consumo. Com um carregador compatível, um sistema de gestão pode reunir estado, sessões e comandos no celular. A escolha começa pela rede elétrica e pelo equipamento, não pelo aplicativo.",
    "sections": [
      {
        "h": "1. Verifique a instalação da casa",
        "p": [
          "Peça a um profissional habilitado que avalie a rede, a entrada de energia, a distância até a vaga e as proteções necessárias. Siga o projeto, as normas aplicáveis e o manual do carregador escolhido.",
          "O guia de instalação WEMOB WALL da WEG, por exemplo, exige pessoal qualificado e proteções próprias para aquele equipamento. Os requisitos de um modelo não devem ser copiados para outro. Não improvise extensões ou adaptações para uma instalação permanente."
        ]
      },
      {
        "h": "2. Potência não é a mesma coisa que consumo",
        "p": [
          "Potência, em kW, descreve a taxa de uso de energia. Consumo, em kWh, é a energia acumulada durante a recarga. Para saber quanto foi usado, consulte a medição da sessão.",
          "O tempo de recarga depende do carro, do carregador, da instalação e das condições da sessão. Não use a potência anunciada para prometer um tempo fixo nem uma porcentagem de bateria."
        ]
      },
      {
        "h": "3. Confirme a conexão com o software",
        "p": [
          "O Telektro usa OCPP 1.6J. Seu carregador precisa permitir a configuração da conexão e ter modelo e firmware validados. Um equipamento com Wi-Fi, sozinho, não comprova compatibilidade.",
          "Antes de comprar ou contratar, peça ao fornecedor o manual e confirme início remoto, parada e envio das leituras de energia. Faça uma recarga de teste com o aparelho real."
        ]
      },
      {
        "h": "4. O que acompanhar pelo celular",
        "p": [
          "No uso residencial, o Telektro permite acompanhar o carregador e solicitar início e parada de recargas pelo celular. A execução depende do equipamento conectado e da resposta aos comandos.",
          "Os kWh apresentados vêm das leituras enviadas pelo carregador. Confira se a sessão termina com registros coerentes de início, fim e consumo. O software não substitui a medição da distribuidora nem mede, sozinho, a instalação inteira da casa."
        ]
      },
      {
        "h": "5. Estime o custo sem confundir com a conta total",
        "p": [
          "Para uma estimativa simples da energia de uma sessão, multiplique os kWh medidos pelo custo por kWh adotado. Esse cálculo é uma estimativa: a conta da distribuidora pode incluir tributos, bandeiras e outros componentes.",
          "O consumo registrado pelo carregador não é uma medida direta da energia que ficou na bateria. Evite apresentar essa leitura como autonomia garantida. Para comparar meses, use a mesma base de cálculo e guarde os registros."
        ]
      },
      {
        "h": "6. Prepare a rotina de uso",
        "p": [
          "Combine com quem mora na casa como usar o equipamento e proteger o acesso ao painel. Em caso de falha elétrica, não tente corrigir pelo aplicativo: interrompa o uso e procure o responsável técnico."
        ],
        "list": [
          "Instalação aprovada pelo profissional responsável",
          "Modelo, firmware e OCPP 1.6J confirmados",
          "Conexão de dados disponível na garagem",
          "Início, parada e consumo conferidos em teste",
          "Conta protegida e contato de suporte disponível"
        ]
      }
    ],
    "faq": [
      {
        "q": "Posso controlar qualquer carregador pelo celular?",
        "a": "Não pelo Telektro. O equipamento precisa usar OCPP 1.6J, permitir configurar a conexão e ter os recursos validados."
      },
      {
        "q": "Ter Wi-Fi basta para funcionar?",
        "a": "Não. Wi-Fi é uma conexão de rede. A comunicação com o Telektro exige OCPP 1.6J e configuração compatível."
      },
      {
        "q": "O painel mostra a conta inteira da casa?",
        "a": "Não. O consumo da recarga vem das leituras do carregador. Ele não representa toda a energia usada na residência."
      },
      {
        "q": "O Telektro instala o carregador?",
        "a": "Não. É software de gestão. Projeto elétrico, instalação e equipamento são serviços e itens separados."
      }
    ],
    "cta": {
      "text": "Quer acompanhar seu carregador residencial pelo celular?",
      "href": "/#residencial",
      "label": "Ver plano Residencial"
    },
    "updated": "outubro de 2026"
  },
  {
    "slug": "ratear-energia-carro-eletrico-moradores",
    "title": "Como ratear a energia de recarga entre moradores",
    "h1": "Como ratear a energia de recarga entre moradores",
    "description": "Organize o rateio da recarga no condomínio com identificação do morador, medição em kWh, regra de cobrança e conferência mensal.",
    "intro": "Quando vários moradores usam um carregador compartilhado, a conta precisa ligar cada recarga a quem usou. Um rateio claro começa com regras aprovadas, identificação do morador e registros de consumo que a administração consegue conferir.",
    "sections": [
      {
        "h": "1. Defina a regra antes do uso",
        "p": [
          "O condomínio deve combinar quem pode carregar, como será calculado o valor, quando ele entra na cobrança e quem responde por manutenção e suporte. Confira convenção, regimento e aprovação necessária com a administração.",
          "Não trate uma sugestão deste guia como regra jurídica. Quórum e exigências podem variar conforme a obra e o local. Em caso de dúvida, consulte a administradora ou um advogado."
        ]
      },
      {
        "h": "2. Registre quem fez cada recarga",
        "p": [
          "Uma sessão sem identificação dificulta atribuir o consumo. Cadastre os moradores autorizados e mantenha os acessos atualizados quando alguém sair ou mudar de unidade.",
          "No Telektro, o condomínio convida moradores por link ou QR e acompanha o consumo por sessão. O morador pode solicitar início e parada pelo celular. O uso de RFID depende do equipamento e do cadastro configurado. Não compartilhe um acesso entre moradores se a cobrança precisa ser individual."
        ]
      },
      {
        "h": "3. Use energia medida, não só tempo",
        "p": [
          "Registre os kWh enviados pelo carregador em cada sessão. Tempo de conexão e potência nominal, isoladamente, não demonstram o consumo real: o carro pode reduzir a potência ou ficar conectado sem carregar.",
          "Antes de usar os registros para cobrança, valide as leituras com o equipamento real. Sessões sem leitura final, valores incoerentes ou falhas precisam de conferência, não de um valor inventado para fechar o mês."
        ]
      },
      {
        "h": "4. Separe consumo e outros custos",
        "p": [
          "Uma regra possível é cobrar os kWh medidos multiplicados pelo valor por kWh definido pelo condomínio. A administração deve explicar a composição desse valor e como trata manutenção, software e outros custos.",
          "Exemplo fictício: uma sessão de 12 kWh com valor definido de R$ 1,00/kWh resulta em R$ 12,00 de energia nessa regra. Isso não é preço do Telektro nem recomendação de tarifa. Custos adicionais só devem entrar conforme a regra aprovada e informada aos moradores."
        ]
      },
      {
        "h": "5. Confira o fechamento mensal",
        "p": [
          "O painel do condomínio no Telektro reúne consumo e informações para a administração acompanhar a cobrança. Antes de lançar os valores, confira período, morador, sessões e critério de preço.",
          "Não confunda relatório com pagamento realizado. A cobrança condominial e o fluxo de repasse de um eletroposto público são operações diferentes. Confirme o que sua conta oferece e quem efetivamente cobra e recebe."
        ],
        "list": [
          "Reconciliar sessões concluídas com o consumo registrado",
          "Separar registros com falha para conferência",
          "Aplicar o preço e o período previstos na regra",
          "Entregar ao morador o detalhamento da sua cobrança",
          "Guardar um histórico para contestação e ajustes"
        ]
      },
      {
        "h": "6. Proteja os dados dos moradores",
        "p": [
          "Disponibilize a cada morador o que ele precisa para conferir a própria cobrança. Evite divulgar dados de todos em grupos ou planilhas abertas. Mantenha os acessos administrativos restritos.",
          "Se houver divergência, compare o registro da sessão, a medição e a regra de cálculo antes de corrigir a cobrança. Registre o ajuste para que a conferência do próximo mês não dependa da memória de alguém."
        ]
      }
    ],
    "faq": [
      {
        "q": "É melhor dividir a conta igualmente entre todos?",
        "a": "Isso pode cobrar de quem não usou. Para atribuir o consumo, use identificação por morador e medição por sessão, dentro da regra aprovada pelo condomínio."
      },
      {
        "q": "Posso cobrar só pelo tempo conectado?",
        "a": "Tempo não mede energia por si só. Para uma cobrança baseada no consumo, use kWh medidos e valide as leituras do equipamento."
      },
      {
        "q": "O valor de R$ 1,00/kWh é o preço do Telektro?",
        "a": "Não. É apenas um exemplo fictício de cálculo. O condomínio define e informa seu critério; as condições do software são separadas."
      },
      {
        "q": "O relatório confirma que o morador pagou?",
        "a": "Não por si só. Relatório de consumo, lançamento da cobrança e confirmação de pagamento são etapas distintas e precisam ser conferidas."
      }
    ],
    "cta": {
      "text": "Quer organizar moradores, sessões e consumo em um só painel?",
      "href": "/#condominio",
      "label": "Ver plano Condomínio"
    },
    "updated": "outubro de 2026"
  },
  {
    "slug": "quanto-custa-abrir-eletroposto",
    "title": "Quanto custa abrir um eletroposto: equipamento, obra e operação",
    "h1": "Quanto custa abrir um eletroposto",
    "description": "Veja os componentes do custo de um eletroposto: carregador AC ou DC, projeto e obra elétrica, adequação da rede, software de gestão e custos mensais de operação.",
    "intro": "O preço de um eletroposto não é o preço do carregador. Equipamento, projeto elétrico, obra, adequação da rede, software e operação mensal entram na conta. Este guia separa cada componente, com faixas de referência publicadas no mercado brasileiro em 2026, para você montar um orçamento realista antes de investir.",
    "sections": [
      {
        "h": "1. Não existe preço único",
        "p": [
          "Dois eletropostos com o mesmo carregador podem custar valores muito diferentes. A potência do equipamento, a distância até o quadro de energia, a capacidade da entrada e o padrão da obra mudam o orçamento.",
          "Use as faixas deste guia como ponto de partida e peça propostas para o mesmo escopo. Desconfie de orçamento fechado sem visita técnica."
        ]
      },
      {
        "h": "2. Equipamento: AC ou DC",
        "p": [
          "Carregadores AC atendem quem fica horas no local, como comércios, condomínios e estacionamentos. Publicações do setor em 2026 indicam wallbox de 7 kW entre R$ 3.000 e R$ 7.000 e modelos de 22 kW entre R$ 5.000 e R$ 12.000, sem instalação.",
          "Carregadores DC carregam em minutos e atendem rodovias e pontos de alto giro. Levantamento de anúncios públicos de setembro de 2026 encontrou modelos de 30 kW entre cerca de R$ 31.000 e R$ 130.000 e de 120 kW entre cerca de R$ 102.000 e R$ 280.000, conforme marca e configuração. Potências acima de 150 kW costumam ficar sob consulta.",
          "Se pretende gerir o ponto pelo Telektro, confirme antes da compra se o modelo usa OCPP 1.6J, permite configurar um servidor externo e teve a conexão validada em teste."
        ],
        "list": [
          "AC: menor custo, recarga em horas, ideal para permanência longa",
          "DC: maior custo, recarga em minutos, ideal para alto giro",
          "A escolha errada de potência é um dos erros mais caros do projeto"
        ]
      },
      {
        "h": "3. Projeto e obra elétrica",
        "p": [
          "A instalação exige circuito dedicado, proteções e aterramento, projetados por profissional habilitado conforme a ABNT NBR 17019. Publicações do setor em 2026 indicam instalação de wallbox AC entre R$ 1.500 e R$ 5.000, conforme potência e distância ao quadro.",
          "Em projetos DC, a conta pode incluir aumento de carga junto à distribuidora, transformador próprio e obras civis. É o componente mais subestimado do orçamento: peça o estudo elétrico antes de comprar o equipamento."
        ]
      },
      {
        "h": "4. Custos recorrentes da operação",
        "p": [
          "Depois de abrir, o eletroposto tem custos mensais que precisam caber na margem entre a energia comprada e a vendida. A margem por kWh, sozinha, não diz se o ponto é viável: o que decide é a utilização."
        ],
        "list": [
          "Energia consumida e demanda contratada junto à distribuidora",
          "Conectividade de dados do carregador",
          "Software de gestão e taxas de pagamento",
          "Manutenção preventiva e corretiva",
          "Sinalização, seguro e atendimento ao motorista"
        ]
      },
      {
        "h": "5. Um cenário fictício para enxergar a conta",
        "p": [
          "Exemplo fictício, sem valor de orçamento: um comércio instala um carregador AC de 22 kW por R$ 8.000, com R$ 4.000 de instalação. No mês, vende 600 kWh a R$ 2,00/kWh (R$ 1.200) e paga a energia a R$ 0,90/kWh (R$ 540). Antes de software, taxas e manutenção, sobram R$ 660 no mês. Nesse ritmo, o retorno dos R$ 12.000 levaria mais de 18 meses, e só se a utilização se mantiver.",
          "Os valores acima são inventados para mostrar a estrutura da conta, não uma promessa de resultado. Refaça o cálculo com os números do seu local: tarifa real da distribuidora, proposta formal de equipamento e uma estimativa conservadora de uso."
        ]
      },
      {
        "h": "6. Como reduzir o risco antes de investir",
        "p": [
          "Comece pelo equipamento que o seu público realmente precisa. Para a maioria dos comércios, um ponto AC bem localizado testa a demanda com uma fração do custo de um DC. Amplie quando os dados de uso justificarem.",
          "No Telektro, o dono do ponto cobra por Pix ou cartão com QR Code, acompanha consumo e vendas no painel e valida a operação antes de escalar. O Telektro é o software de gestão: equipamento, instalação e demanda são avaliados à parte, com a compatibilidade OCPP 1.6J confirmada em teste."
        ],
        "list": [
          "Estudo elétrico concluído antes da compra",
          "Propostas comparadas com o mesmo escopo",
          "Cenário pessimista de utilização no papel",
          "Piloto com um ponto antes de ampliar",
          "Leituras e cobrança validadas com o equipamento real"
        ]
      }
    ],
    "faq": [
      {
        "q": "Qual o investimento mínimo para abrir um eletroposto?",
        "a": "Com um carregador AC comercial, publicações de 2026 indicam equipamento e instalação a partir de alguns milhares de reais. Projetos com DC passam de dezenas de milhares. O mínimo real depende da rede elétrica e do público do local."
      },
      {
        "q": "Carregador AC ou DC: qual escolher?",
        "a": "AC para permanência longa e menor custo; DC para recarga rápida e alto giro. Comece pelo tempo que o cliente fica no local, não pela potência máxima disponível."
      },
      {
        "q": "Qual o custo mensal de um eletroposto?",
        "a": "Energia e demanda contratada, conectividade, software, taxas de pagamento e manutenção. Monte a conta com a tarifa da sua distribuidora e as condições reais de cada fornecedor."
      },
      {
        "q": "As faixas de preço deste guia são um orçamento?",
        "a": "Não. São referências coletadas de anúncios e publicações do setor em 2026. Peça propostas formais para o mesmo escopo antes de decidir."
      },
      {
        "q": "O Telektro vende o carregador ou faz a instalação?",
        "a": "Não. O Telektro é o software de gestão e cobrança das recargas. Equipamento, projeto e obra são contratados separadamente."
      }
    ],
    "cta": {
      "text": "Quer ver como cobrar e acompanhar as recargas do seu ponto?",
      "href": "/#eletroposto",
      "label": "Ver plano Eletroposto"
    },
    "updated": "novembro de 2026"
  },
];

export const getGuia = (slug: string) => GUIAS.find((g) => g.slug === slug);
