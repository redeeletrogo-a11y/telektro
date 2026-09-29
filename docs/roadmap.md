# Roadmap de produto Telektro

**Atualizado em:** 2026-09-28  
**Direção aprovada pelo fundador:** SaaS de gestão para carregadores residenciais e condomínios; cobrança por recarga pública fica para a etapa final.

## Objetivo inicial

Entregar um site/app SaaS que o proprietário de um carregador residencial possa abrir no celular para acompanhar e controlar a recarga. O mesmo produto deve permitir que um condomínio acompanhe vários carregadores, suas sessões e a demanda elétrica do local.

O início é gestão operacional. Não inclui cobrança do motorista por sessão, marketplace de recarga ou aplicativo nativo. O site é responsivo e já pode ser instalado como PWA no celular.

## Experiência que o MVP precisa provar

- Criar conta e organização para uma residência ou condomínio.
- Cadastrar local e um ou mais carregadores compatíveis com OCPP.
- Mostrar online/offline, estado, sessões ativas, tempo decorrido, potência e energia recebida, usando dados reais do carregador.
- Iniciar e encerrar uma recarga pelo celular quando o carregador suportar os comandos. “Pausar/retomar” depende dos recursos do equipamento e deve mostrar confirmação real do OCPP; nunca indicar sucesso apenas porque o comando foi enviado.
- Para condomínios, mostrar todos os carregadores e sessões do local juntos, com limite elétrico configurável e avisos de aproximação/excesso.
- Isolar organizações e dados com autenticação, papéis e RLS desde o primeiro piloto.

**Limite técnico:** somar a potência reportada pelos carregadores ajuda a estimar o consumo de recarga, mas não mede toda a rede do prédio. Detecção confiável da sobrecarga do local precisa de medidor geral integrado. Evitar ultrapassar o limite exige também balanceamento de carga testado e confirmação de que os comandos foram aplicados.

## Etapas

### 0. Fundação e segurança — em andamento

Autenticação, organizações, RLS, locais, cadastro de carregadores, gateway OCPP 1.6J e estrutura de migrations. A base do dashboard e o recebimento de `BootNotification`, `Heartbeat` e `StatusNotification` já existem.

**Evolução entregue nesta etapa:** o gateway persiste presença, estados, transações e `MeterValues`; o workspace mostra sessões ativas, duração e medições. Também há pedidos autenticados de início/parada, resposta OCPP confirmada, timeout e autorização temporária vinculada ao comando.

**Cadastro de equipamentos em evolução:** o formulário aceita especificações de fabricantes diversos e oferece o WEG WEMOB-P-023-W-R-1T2 como preenchimento sugerido. Potência de placa e limite elétrico da instalação são campos separados; o protocolo e as interfaces são registrados para orientar a configuração, sem alegar compatibilidade operacional que o gateway ainda não tenha implementado. A migration `202609280006_charger_profiles.sql` precisa ser aplicada antes de publicar a interface.

### 1. MVP residencial — em evolução

Fazer um proprietário operar um carregador de casa pelo navegador do celular: status, sessão, duração, potência/energia e comandos remotos compatíveis. O painel atualiza os dados automaticamente enquanto está aberto. A recuperação segura de comandos e sua migration `202609280005_command_recovery.sql` já estão publicadas no gateway e no Supabase. A validação com carregador real ou simulador OCPP fiel continua pendente.

**Saída:** o usuário acompanha uma sessão real e consegue iniciar/parar quando o carregador suporta, vendo o resultado confirmado e o histórico correto.

### 2. Gestão de condomínios — primeira visão de demanda entregue

Permitir vários carregadores por local, visão conjunta de disponibilidade/uso/sessões, consumo agregado dos carregadores, limite do local e alertas. O workspace já agrega as leituras recentes de potência das sessões ativas por local e avisa quando a soma se aproxima ou passa do limite configurado. A medição tem cobertura explícita e exclui leituras com mais de cinco minutos. Preparar papéis de síndico/operador e, depois, acesso de moradores.

**Saída:** o operador entende quais equipamentos estão em uso e quanto da capacidade de recarga está ocupada, sem confundir a soma dos carregadores com a medição elétrica total do prédio.

### 3. Segurança elétrica e balanceamento

Adicionar integração de medidor geral para acompanhar a demanda total do local. Depois, implementar limites e load balancing por carregador, com margem de segurança, confirmação OCPP, logs e comportamento seguro em falhas.

**Saída:** piloto demonstra que o sistema respeita um limite elétrico conhecido e explica as decisões do balanceamento.

### 4. Uso móvel e operação compartilhada — PWA entregue

Manter os fluxos principais responsivos desde o MVP; a PWA instalável está publicada e pode ser adicionada à tela inicial do celular. Ainda faltam convites e o fluxo de moradores/usuários do condomínio. Aplicativo nativo não é requisito inicial.

### 5. Pilotos e validação do produto

Rodar pilotos separados em uma residência e em um condomínio. Medir estabilidade OCPP, qualidade dos dados, facilidade de uso pelo celular, falhas de conectividade, comandos remotos e operação com vários carregadores.

### 6. Parceria com instaladores e planos SaaS

Depois de validar a operação, estruturar a parceria com a equipe de instalação para oferecer o Telektro junto com os carregadores. Definir planos mensais diferentes para residência e condomínio, considerando número de carregadores, recursos e suporte.

Cobrança da assinatura é uma etapa comercial posterior aos pilotos; não bloqueia o MVP de gestão.

### 7. Recarga pública e cobrança por sessão — última etapa comercial

Após a parceria e a distribuição do software, permitir cadastro de motoristas/clientes, descoberta de carregadores públicos, tarifas, pagamento por recarga e recibos. Separar cobrança do serviço SaaS da cobrança de energia/uso do carregador.

## Evoluções de longo prazo

Somente após validar a gestão residencial e de condomínios: OCPP 2.0.1, solar, bateria, otimização energética avançada e hardware intermediário para carregadores sem OCPP nativo.

## Estado do projeto hoje

Já existem autenticação, onboarding da organização, schema multiempresa, cadastro de locais/carregadores, provisionamento de credenciais OCPP, gateway público OCPP 1.6J hospedado no Fly.io, persistência de conexões/sessões/`MeterValues`, comandos remotos com confirmação/timeout, recuperação de comandos após reinício, PWA publicada e atualização periódica do workspace. A visão de demanda por local soma leituras recentes das sessões e compara com o limite configurado; ela não representa o consumo total do imóvel. Ainda faltam medidor geral, balanceamento de carga, convites/papéis para condomínios e validação com carregador ou simulador. Cobrança SaaS e por sessão ficam para etapas posteriores. O teste de hardware aguarda a disponibilidade do carregador físico.
