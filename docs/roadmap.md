# Roadmap de produto Telektro

**Atualizado em:** 2026-09-28  
**Direção aprovada pelo fundador:** SaaS de gestão para carregadores residenciais e condomínios; cobrança por recarga pública fica para a etapa final.

## Objetivo inicial

Entregar um site/app SaaS que o proprietário de um carregador residencial possa abrir no celular para acompanhar e controlar a recarga. O mesmo produto deve permitir que um condomínio acompanhe vários carregadores, suas sessões e a demanda elétrica do local.

O início é gestão operacional. Não inclui cobrança do motorista por sessão, marketplace de recarga ou aplicativo nativo. O site será responsivo para uso no celular; PWA instalável pode vir depois.

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

**Evolução entregue nesta etapa:** o gateway agora persiste presença, estados, transações e `MeterValues`; o workspace mostra sessões ativas, duração e as medições mais recentes armazenadas. O ciclo de comando remoto e confirmação OCPP ainda está pendente.

### 1. MVP residencial — prioridade imediata

Fazer um proprietário operar um carregador de casa pelo navegador do celular: status, sessão, duração, potência/energia e comandos remotos compatíveis. As telas já mostram sessões e medições que chegam pelo OCPP; falta concluir comandos remotos e atualizar os dados sem recarregar a página. Validar com carregador real ou simulador OCPP fiel.

**Saída:** o usuário acompanha uma sessão real e consegue iniciar/parar quando o carregador suporta, vendo o resultado confirmado e o histórico correto.

### 2. Gestão de condomínios

Permitir vários carregadores por local, visão conjunta de disponibilidade/uso/sessões, consumo agregado dos carregadores, limite do local e alertas. Preparar papéis de síndico/operador e, depois, acesso de moradores.

**Saída:** o operador entende quais equipamentos estão em uso e quanto da capacidade de recarga está ocupada, sem confundir a soma dos carregadores com a medição elétrica total do prédio.

### 3. Segurança elétrica e balanceamento

Adicionar integração de medidor geral para acompanhar a demanda total do local. Depois, implementar limites e load balancing por carregador, com margem de segurança, confirmação OCPP, logs e comportamento seguro em falhas.

**Saída:** piloto demonstra que o sistema respeita um limite elétrico conhecido e explica as decisões do balanceamento.

### 4. Uso móvel e operação compartilhada

Manter os fluxos principais responsivos desde o MVP. Em seguida, acrescentar PWA instalável, convites, papéis e fluxo de moradores/usuários do condomínio. Aplicativo nativo não é requisito inicial.

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

Já existem autenticação, onboarding da organização, schema multiempresa, cadastro de locais/carregadores, provisionamento de credenciais OCPP, persistência de conexões/sessões/`MeterValues` e tela de recargas ativas. Comandos remotos, atualização em tempo real, medidor do local, load balancing, PWA e billing ainda precisam ser construídos. As telas devem refletir somente estados e comandos confirmados pelo equipamento.
