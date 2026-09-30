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
- Cadastro extensível para diferentes marcas/modelos: código de modelo, série, tipo/quantidade de conectores, versão OCPP, características técnicas opcionais e interfaces ficam no perfil do carregador. A potência máxima do modelo é separada do limite configurado para a instalação; o WEG WEMOB-P-023-W-R-1T2 é um perfil sugerido, não uma lista fechada de equipamentos.
- Compatibilidade por carro não é compatibilidade de estação: o gateway conecta à wallbox/eletroposto via OCPP 1.6J. O perfil de referência BYD Dolphin preenche somente conector Tipo 2 AC e mantém marca, potência e protocolo não confirmados; é preciso conferir o modelo real da estação. A BYD divulgou EW1005 Tipo 2 7 kW em algumas campanhas, mas isso não comprova OCPP. Modelos sem OCPP servem para inventário, não para conexão ao gateway.
- Servidor WebSocket com health check, autenticação Basic por credencial provisionada (e token apenas em ambiente local), validação, presença online/offline e persistência de `BootNotification`, `Heartbeat`, `StatusNotification`, `StartTransaction`, `StopTransaction` e `MeterValues` nas tabelas existentes.
- Tela de sessões ativas com tempo decorrido e valores de energia/potência reportados pelo carregador. A duração atualiza no navegador; os dados de medição são atualizados quando a página consulta novamente o Supabase.
- Ações protegidas por papel para solicitar início/parada. O gateway persiste o identificador OCPP antes de enviar `RemoteStartTransaction`/`RemoteStopTransaction`, aguarda resposta por até 20 segundos e grava aceitação, recusa, falha ou timeout; a sessão só aparece ou termina após `StartTransaction`/`StopTransaction` do carregador.
- O início remoto usa uma tag aleatória temporária vinculada ao carregador e ao pedido autenticado. O fluxo físico RFID aceita somente tags previamente cadastradas; o hash é armazenado e a tag deve corresponder em `Authorize` e/ou `StartTransaction`.
- Capabilities são registradas como observações OCPP, nunca por marca: `RemoteStartTransaction`/`RemoteStopTransaction` aceitos indicam suporte observado; `NotSupported` indica não suportado; recusas e timeouts não são tratados como prova de suporte. A leitura opcional de `AuthorizeRemoteTxRequests` usa `GetConfiguration` e não altera configuração do equipamento.
- Ações de início e parada têm proteção contra duplicação e concorrência no banco por carregador/conector ou transação. O status `accepted` significa apenas resposta positiva ao CALL; o comando vira `confirmed` após `StartTransaction`/`StopTransaction`. Sem evento após o prazo configurável, fica `operation_timeout`.
- Após reiniciar, pedidos que estavam enviados passam a `unknown`, sem reenvio automático. Uma resposta tardia só pode ser reconciliada pelo ID OCPP persistido e pelo carregador vinculado ao pedido. A autorização temporária de início pode ser recuperada do comando persistido por até dez minutos.

## Próximas partes da fase OCPP

Retentativa automática, atualização por Supabase Realtime e teste com hardware/simulador continuam pendentes. As migrations `202609280005_command_recovery.sql` e `202609300007_remote_authorization_diagnostics.sql` foram aplicadas no Supabase. Uma resposta `Accepted` confirma que o carregador aceitou o comando, mas não prova que a carga começou; isso só é confirmado por `StartTransaction`.

O protocolo fica dentro de `apps/ocpp-gateway`; uma implementação futura de OCPP 2.0.1 deve ser adicionada por uma camada específica, sem misturar mensagens e tipos das duas versões.
