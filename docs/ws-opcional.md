# ws:// opcional por carregador

wss (porta 443) continua o padrao e recomendado. Alguns modelos so falam ws (ex.: NeoCharge, segundo o fabricante).

- O dono liga "Permitir ws (sem criptografia)" por carregador (cadastro ou lista de carregadores). Padrao: desligado.
- Gateway: a mesma porta 9000 atende as duas. O Fly encaminha a porta 443 (X-Forwarded-Proto https) e a porta 80 (http). Se o pedido nao veio claramente por https na 443, e tratado como ws e so entra se allow_insecure_ws for true para aquele carregador. Senao, 403.
- A credencial (Basic auth, uma por carregador) continua obrigatoria nos dois. No ws ela trafega sem criptografia: gere uma credencial exclusiva e troque ao migrar para wss.
- Desligar a opcao derruba na hora (em ate 30 s) a conexao ws daquele carregador.
- URL ws: ws://telektro-ocpp-gateway.fly.dev/ocpp/<ID> (porta 80). URL wss: wss://telektro-ocpp-gateway.fly.dev/ocpp/<ID>.
- Logs: ocpp.connected_insecure_ws, ocpp.connection_rejected com reason insecure_ws_not_enabled_for_charger.
- Ordem de implantacao: 1) SQL docs/sql/03-ws-opcional.txt no Supabase, 2) deploy do site, 3) fly deploy do gateway (fly.toml abre a porta 80).
