# Laboratório de cadastro e adaptadores

Rota isolada: `/laboratorio/carregadores` (noindex; sem inclusão em menus/sitemap).

## Escopo
- Cadastro efêmero em memória da aba: marca/família de referência, sufixo ou texto de QR de **unidades fictícias**, seleção de serial completo no caso de colisão e prova de posse **simulada**.
- Sem banco, conta de fornecedor, câmera, LAN, gateway ou cobrança. Nenhum novo SQL. Bluetooth: seletor real opcional mediante clique e permissão, sem conectar GATT, ler características ou enviar comandos.
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

## Prioridade do assistente (12/11)
Cadastro/configuração primeiro: diagnóstico de conexão, configuração de OCPP no ponto e confirmação no Telektro. Hoje as verificações são simuladas/não executadas. Sem alteração de endpoint ou credencial em equipamento. Carga fictícia é seção secundária.

Roadmap: identificar família/firmware e interface autorizada; diagnóstico somente leitura no piloto autorizado; revisão das mudanças OCPP, aplicação autorizada e verificação no servidor; ampliar famílias homologadas; só depois avaliar liberação/parada de modelos sem OCPP. Não confere suporte universal.

## Descoberta Bluetooth opcional
Web Bluetooth `requestDevice({acceptAllDevices:true})` abre o seletor do navegador e retorna somente o dispositivo selecionado pelo usuário. Não é varredura contínua nem lista completa. Só o nome é guardado em memória, sem ID/endereço, sem serviços solicitados, sem GATT connect/leitura/escrita. Limite de cinco escolhas por aba; reload limpa. Apagar a lista não revoga permissões do browser. Nome pode não conter serial e pode ser falsificado: comparação de final nunca concede posse/cadastro/homologação.

Sem suporte: mensagem clara e demonstração separada com consentimento fictício. Nenhum fallback é apresentado como descoberta real. Testes de API em automação são mocks, não ensaio de rádio real. Não utilizar no carregador da farmácia. Não há driver pronto para configurar aparelho real. Rota escondida/noindex não equivale a autenticação ou controle de acesso.
