# Telektro

Plataforma de operação de infraestrutura de recarga. Este repositório contém o dashboard conectado ao Supabase, dados multiempresa com RLS e a base de autenticação/protocolo do gateway OCPP 1.6J.

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

1. Copie apenas `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL` para `apps/web/.env.local`.
2. Copie `.env.example` para `.env` na raiz e configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `OCPP_DEV_TOKEN` para o gateway. O arquivo `.env` é ignorado pelo Git. Nunca disponibilize `SUPABASE_SERVICE_ROLE_KEY` no frontend.
3. Instale dependências com `pnpm install`.
4. Inicie o dashboard com `pnpm dev`; inicie o gateway, separadamente, com `pnpm dev:gateway`.
5. Aplique migrations em ordem usando Supabase CLI ou o editor SQL do projeto.

Sem Supabase configurado, o dashboard informa as variáveis de configuração necessárias. Os números apresentados vêm dos registros atuais do banco; nenhum carregador ou dado fictício é apresentado como real.

## Gateway OCPP

O processo separado atende `GET /health` e conexões WebSocket em `/ocpp/{chargePointId}` com subprotocolo `ocpp1.6`. Nesta etapa, `BootNotification`, `Heartbeat` e `StatusNotification` são reconhecidos. Carregadores provisionados autenticam com HTTP Basic: usuário igual ao charge point ID e senha individual. A senha aparece uma vez durante o cadastro; o banco guarda apenas o hash.

Para desenvolvimento local, `OCPP_DEV_TOKEN` habilita a autenticação temporária pelo cabeçalho `x-telektro-dev-token`. Esta opção só funciona fora de `NODE_ENV=production`. O gateway consulta `chargers` com service role para verificar credenciais individuais; configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente do gateway.

## Supabase e multiempresa

A migration inicial cria organizações, memberships, locais, carregadores, conectores, sessões, medições, comandos e metadados de auditoria. As tabelas têm RLS habilitado e as consultas de usuário dependem de uma membership. O primeiro usuário pode criar uma organização pelo dashboard; convites e administração de memberships ainda aguardam uma etapa própria.

`SUPABASE_SERVICE_ROLE_KEY` é reservada a processos server-side de confiança. Ela ignora RLS e jamais deve ser usada em componentes cliente.

## Comandos

- `pnpm dev` — dashboard
- `pnpm dev:gateway` — gateway WebSocket
- `pnpm lint` — ESLint dos aplicativos
- `pnpm typecheck` — TypeScript dos aplicativos
- `pnpm test` — testes do protocolo no gateway
- `pnpm build` — build de produção do dashboard
