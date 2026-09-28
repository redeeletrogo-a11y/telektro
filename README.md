# Telektro

Plataforma de operação de infraestrutura de recarga. Este repositório contém a fundação do dashboard e do gateway OCPP 1.6J, com Supabase/PostgreSQL planejado para identidade e dados multiempresa.

## Estrutura

```text
apps/
  web/              Next.js, TypeScript, Tailwind CSS e interface Telektro
  ocpp-gateway/     Gateway WebSocket persistente (processo independente)
supabase/
  migrations/       Schema inicial e políticas RLS
```

## Requisitos

- Node.js 20.9 ou superior
- pnpm
- Projeto Supabase criado pelo proprietário

## Desenvolvimento local

1. Copie `.env.example` para `apps/web/.env.local` e configure as chaves públicas do Supabase para a interface.
2. Configure as variáveis privadas do gateway no ambiente do processo. Nunca disponibilize `SUPABASE_SERVICE_ROLE_KEY` no frontend.
3. Instale dependências com `pnpm install`.
4. Inicie o dashboard com `pnpm dev`; inicie o gateway, separadamente, com `pnpm dev:gateway`.
5. Aplique migrations usando Supabase CLI ou o editor SQL do projeto.

Sem Supabase configurado, o dashboard abre em modo de demonstração. Todos os dados exibidos nessa tela são ilustrativos e nenhuma ação de controle remoto é enviada.

## Gateway OCPP

O processo separado atende `GET /health` e conexões WebSocket em `/ocpp/{chargePointId}` com subprotocolo `ocpp1.6`. Nesta fundação, somente `BootNotification`, `Heartbeat` e `StatusNotification` são reconhecidos. Ainda não há persistência, autenticação individual de carregadores nem execução de comandos; não conecte equipamentos reais a este esqueleto.

Para desenvolvimento, `OCPP_DEV_TOKEN` habilita a autenticação temporária pelo cabeçalho `x-telektro-dev-token`. Esta opção só funciona fora de `NODE_ENV=production`. A autenticação de produção deve validar credenciais individuais do carregador antes da implantação pública.

## Supabase e multiempresa

A migration inicial cria organizações, memberships, locais, carregadores, conectores, sessões, medições, comandos e metadados de auditoria. As tabelas têm RLS habilitado e as consultas de usuário dependem de uma membership. A aplicação ainda não oferece cadastro de organização/convites; crie a primeira organização e membership por um fluxo administrativo confiável antes de liberar acesso a operadores.

`SUPABASE_SERVICE_ROLE_KEY` é reservada a processos server-side de confiança, como o gateway depois da implementação de uma camada de persistência. Ela ignora RLS e jamais deve ser usada em componentes cliente.

## Comandos

- `pnpm dev` — dashboard
- `pnpm dev:gateway` — gateway WebSocket
- `pnpm lint` — ESLint dos aplicativos
- `pnpm typecheck` — TypeScript dos aplicativos
- `pnpm test` — testes do protocolo no gateway
- `pnpm build` — build de produção do dashboard
