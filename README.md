# Telektro

SaaS de gestão de recarga de veículos elétricos, com painel web, cobrança e gateway OCPP 1.6J próprio.

[Conheça o produto em telektro.com.br](https://telektro.com.br)

O Telektro reúne em um só lugar o controle dos carregadores, o histórico de sessões e a cobrança de recargas. Atende cenários residenciais, condomínios e eletropostos, com uma interface que também pode ser instalada no celular como PWA.

Desenvolvido por **Maycon Terto**, o projeto está publicado em produção. Integra software web, comunicação com equipamentos e pagamentos. A validação com carregadores físicos é feita por modelo e configuração: suporte ao protocolo não significa compatibilidade já comprovada com todo equipamento do mercado.

## O que o produto faz

- **Gestão de carregadores:** cadastro, estado de conexão, locais e configuração de credenciais individuais.
- **Controle de recarga:** início e parada remotos pelo gateway OCPP 1.6J, com confirmação do carregador.
- **Sessões e consumo:** histórico de recargas, medições de energia em kWh e valores por sessão.
- **Condomínios:** acesso para responsáveis e moradores, convites e acompanhamento do consumo individual.
- **Cobrança:** integração com Mercado Pago para Pix e cartão, com fluxos próprios para assinatura e recarga pré-paga de eletroposto.
- **Uso no celular:** interface responsiva e instalação como PWA, sem depender de uma loja de aplicativos.

## Telas do produto

Captura do painel de morador em uma **conta de demonstração**, com carregador simulado e histórico de teste. Não são dados de clientes reais. O e-mail da conta foi ocultado na imagem; os demais elementos são da interface publicada.

![Painel de demonstração: consumo mensal, carregador e histórico de sessões](https://github.com/user-attachments/assets/a2ab16bb-c349-48d4-8ab8-99fc15b7de19)

O exemplo mostra o consumo em kWh, o valor calculado e uma sessão concluída. O carregador de demonstração está offline nesta captura.

## Stack e arquitetura

| Camada | Tecnologias e responsabilidade |
| --- | --- |
| Web | Next.js, React, TypeScript e Tailwind CSS: painel, autenticação e interface responsiva |
| Dados | Supabase Auth e PostgreSQL: organizações, carregadores, sessões e políticas RLS |
| Equipamentos | Node.js e WebSocket: gateway OCPP 1.6J em processo persistente separado |
| Pagamentos | Mercado Pago: Pix, cartão e webhooks de atualização de pagamentos |
| Deploy | Vercel para a aplicação web e Fly.io para o gateway persistente |

```text
Celular / navegador -> Painel Next.js -> Supabase (Auth + PostgreSQL + RLS)
                           |                         ^
                           +-> Mercado Pago          |
                                                     |
Carregador OCPP 1.6J <-- WebSocket --> Gateway Node.js-+
```

### Decisões técnicas

- **Gateway separado do deploy web:** conexões WebSocket dos carregadores precisam de um processo persistente, independente do ciclo de requisições do painel.
- **Isolamento por organização:** memberships e políticas RLS delimitam o acesso aos dados no banco.
- **Credenciais por carregador:** autenticação individual com hash armazenado no banco e renovação pelo painel.
- **Pagamentos no servidor:** tokens e chaves privadas ficam fora do frontend; webhooks permitem acompanhar mudanças de estado.

## Desenvolvimento e setup

As instruções abaixo são para desenvolvedores. Use um projeto Supabase separado para testes; não aplique migrations nem faça testes financeiros em produção sem revisar o efeito de cada operação.

### Estrutura

```text
apps/
  web/              Next.js, TypeScript, Tailwind CSS e interface Telektro
  ocpp-gateway/     Gateway WebSocket persistente (processo independente)
supabase/
  migrations/       Schema inicial e políticas RLS
```

### Requisitos

- Node.js compatível com Next.js 16 (20.9 ou superior) e com a versão de pnpm indicada no `package.json`
- pnpm
- Projeto Supabase criado pelo proprietário

### Desenvolvimento local

1. Copie `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` e `NEXT_PUBLIC_OCPP_GATEWAY_BASE_URL` para `apps/web/.env.local`.
2. Copie `.env.example` para `.env` na raiz e configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `OCPP_DEV_TOKEN` para o gateway. O arquivo `.env` é ignorado pelo Git. Nunca disponibilize `SUPABASE_SERVICE_ROLE_KEY` no frontend.
3. Instale dependências com `pnpm install`.
4. Inicie o dashboard com `pnpm dev`; inicie o gateway, separadamente, com `pnpm dev:gateway`.
5. Aplique migrations em ordem usando Supabase CLI ou o editor SQL do projeto.

Sem Supabase configurado, o dashboard informa as variáveis de configuração necessárias. Os números apresentados vêm dos registros atuais do banco; nenhum carregador ou dado fictício é apresentado como real.

### Gateway OCPP

O processo separado atende `GET /health` e conexões WebSocket em `/ocpp/{chargePointId}` com subprotocolo `ocpp1.6`. Ele persiste estados, sessões e medições e processa autorização temporária, início/parada remotos e confirmações do carregador. Carregadores provisionados autenticam com HTTP Basic: usuário igual ao charge point ID e senha individual. A credencial individual pode ser gerada ou renovada pelo painel; o banco guarda apenas o hash.

Para desenvolvimento local, `OCPP_DEV_TOKEN` habilita a autenticação temporária pelo cabeçalho `x-telektro-dev-token`. Esta opção só funciona fora de `NODE_ENV=production`. O gateway consulta `chargers` com service role para verificar credenciais individuais; configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente do gateway.

### App para celular

O dashboard pode ser instalado como PWA pela opção **Instalar Telektro**. No Android, aceite a instalação do navegador; no iPhone, abra o site no Safari e use **Compartilhar → Adicionar à Tela de Início**. A instalação usa o site HTTPS publicado e não gera um pacote para App Store/Google Play nem habilita uso offline.

Na Vercel, configure a raiz do projeto como `apps/web` e defina `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_OCPP_GATEWAY_BASE_URL` (URL `wss://` da aplicação Fly). O gateway OCPP permanece um serviço separado: publique-o em um host persistente com TLS e configure a URL exibida ao provisionar o carregador; o deploy web sozinho não torna a porta local 9000 acessível pela internet.

O `fly.toml` e `apps/ocpp-gateway/Dockerfile` publicam o gateway persistente na região de São Paulo. Configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` como secrets do app Fly e publique com `fly deploy`. A máquina permanece ativa para manter sessões WebSocket dos carregadores; o custo depende do tamanho e da região da máquina.

### Supabase e multiempresa

A migration inicial cria organizações, memberships, locais, carregadores, conectores, sessões, medições, comandos e metadados de auditoria. As tabelas têm RLS habilitado e as consultas de usuário dependem de uma membership. O painel permite criar a organização e gerenciar o acesso de moradores por convite no fluxo de condomínio.

`SUPABASE_SERVICE_ROLE_KEY` é reservada a processos server-side de confiança. Ela ignora RLS e jamais deve ser usada em componentes cliente.

### Comandos

- `pnpm dev` - dashboard
- `pnpm dev:gateway` - gateway WebSocket
- `pnpm lint` - ESLint dos aplicativos
- `pnpm typecheck` - TypeScript dos aplicativos
- `pnpm test` - testes do protocolo no gateway
- `pnpm build` - build de produção do dashboard

