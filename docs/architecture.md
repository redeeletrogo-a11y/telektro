# Arquitetura inicial

## Aplicações

- `apps/web`: Next.js App Router, TypeScript, Tailwind CSS v4 e interface web responsiva.
- `apps/ocpp-gateway`: serviço Node.js independente para WebSocket persistente e protocolo OCPP 1.6J.
- `supabase/migrations`: esquema PostgreSQL, isolamento por organização e políticas RLS.

O dashboard nunca se conecta diretamente ao carregador. O gateway e a interface são processos separados; o gateway não deve ser implantado em uma função serverless de curta duração.

## Estado implementado

- Dashboard autenticado com login por senha e botão OAuth Google; o provedor Google depende da configuração do projeto no Supabase e do público OAuth do Google Cloud.
- Sessão Supabase SSR com atualização de cookies no `proxy.ts`.
- Esquema base para organizações, membership, locais, carregadores, conectores, sessões, medições, comandos e auditoria OCPP.
- Entidades de aplicação para perfis, veículos, tarifas, cobranças, leituras de energia do local, alertas e auditoria administrativa.
- RLS habilitado em todas as tabelas da primeira migration.
- Provisionamento de carregadores em locais da organização e credencial OCPP individual, exibida uma única vez e armazenada como hash.
- Servidor WebSocket com health check, autenticação Basic por credencial provisionada (e token apenas em ambiente local), validação, presença online/offline e persistência de `BootNotification`, `Heartbeat`, `StatusNotification`, `StartTransaction`, `StopTransaction` e `MeterValues` nas tabelas existentes.
- Tela de sessões ativas com tempo decorrido e valores de energia/potência reportados pelo carregador. A duração atualiza no navegador; os dados de medição são atualizados quando a página consulta novamente o Supabase.

## Próximas partes da fase OCPP

`Authorize`, comandos remotos, timeout/retry e atualização por Supabase Realtime continuam pendentes. A aceitação de `StartTransaction` registra a transação recebida do carregador; uma lista própria de cartões RFID/usuários e autorização de motoristas ainda não faz parte desta etapa. Nenhuma ação remota é simulada como concluída.

O protocolo fica dentro de `apps/ocpp-gateway`; uma implementação futura de OCPP 2.0.1 deve ser adicionada por uma camada específica, sem misturar mensagens e tipos das duas versões.
