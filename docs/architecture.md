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
- Ações protegidas por papel para solicitar início/parada. O gateway envia `RemoteStartTransaction`/`RemoteStopTransaction`, aguarda resposta OCPP por até 20 segundos e grava aceitação, recusa, falha ou timeout; a sessão só aparece ou termina após `StartTransaction`/`StopTransaction` do carregador.
- O início remoto usa uma tag aleatória temporária vinculada ao carregador e ao pedido autenticado. `Authorize` e `StartTransaction` recusam tags sem esse pedido; o fluxo de cartões RFID e moradores ainda não existe.

## Próximas partes da fase OCPP

Retentativa automática, atualização por Supabase Realtime, reconciliação de comandos após reinício do gateway e teste com hardware/simulador continuam pendentes. Uma resposta `Accepted` confirma que o carregador aceitou o comando, mas não prova que a carga começou; isso só é confirmado por `StartTransaction`. Cartões RFID e autorização de moradores continuam fora desta etapa.

O protocolo fica dentro de `apps/ocpp-gateway`; uma implementação futura de OCPP 2.0.1 deve ser adicionada por uma camada específica, sem misturar mensagens e tipos das duas versões.
