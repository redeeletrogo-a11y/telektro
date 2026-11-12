# Laboratório de cadastro e adaptadores

Rota isolada: `/laboratorio/carregadores` (noindex; sem inclusão em menus/sitemap).

## Escopo
- Cadastro efêmero em memória da aba: marca/família de referência, sufixo ou texto de QR de **unidades fictícias**, seleção de serial completo no caso de colisão e prova de posse **simulada**.
- Nenhum banco, conta de fornecedor, câmera, Bluetooth, LAN, gateway, cobrança ou carregador é acessado. Nenhum novo SQL.
- QR demonstrativo é texto colado, não leitura de câmera. A marca selecionada não declara homologação. Não aceitar códigos de posse reais neste laboratório.
- `registered`: cadastro fictício confirmado, não conectado; `simulated`: simulador em uso. `validated` está no contrato para evolução, sem ação no formulário que conceda homologação real.
- Transporte OCPP/LAN/BLE reservado no contrato, **sem drivers conectados**. Selecionar esses transportes não tenta rede. Apenas simulado executa.
- Estado desconhecido e energia nula ao perder conexão. Reconexão recupera estado do simulador, sem assumir parada. Fixture de 420 Wh em leitura de recarga, sem geração por relógio e sem faturamento.
- Uso básico gratuito neste protótipo. Não altera planos, preços ou direitos de clientes existentes.

## Antes de produção
Definir autenticação e autorização por organização, prova de posse resistente a tentativa/reuso, provisionamento de identidade completa, persistência segura e tratamento de transferência de dono. Sufixo não é senha, identidade única ou credencial de protocolo. Homologação depende de modelo/firmware e ensaio autorizado; QR pode ajudar identificação mas não prova posse sozinho.

Validar protocolo e acesso autorizado de cada família: GWM G/K usa Zeeda, não presumir Tuya. BYD tem famílias distintas, não prometer compatibilidade de marca. Não usar o LIVOLTEK real. OCPP já existente permanece intocado. LAN/BLE futuros necessitam política de credenciais, confirmação real de comandos, reconciliação e medição adequada antes de qualquer cobrança.

## Teste isolado
`node scripts/test-charger-lab.mjs` (após instalar dependências do workspace).

A simulação não comprova funcionamento num equipamento. Merge/deploy exige nova aprovação do proprietário.
