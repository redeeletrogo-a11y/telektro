# Base de segurança

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` são as únicas chaves previstas para uso no dashboard.
- `SUPABASE_SERVICE_ROLE_KEY` é exclusivamente server-side; o gateway a usa para consultar carregadores, consumir a fila de comandos e gravar estado, sessões, medições e confirmações.
- As tabelas da migration inicial têm RLS. Consultas autenticadas são limitadas por membership à organização correspondente.
- Apenas `owner`/`admin` administram locais; técnicos podem administrar carregadores; operadores/técnicos podem solicitar comandos conforme as policies iniciais.
- A migration permite consultar memberships da própria organização, mas não autoriza alterações de memberships pelo browser; convites e mudanças de papel aguardam um fluxo server-side validado.
- Perfis pessoais expõem apenas nome e avatar editáveis pelo próprio usuário; memberships e autenticação permanecem separados.
- Tarifas são administradas por owner/admin; cobranças ficam restritas aos perfis financeiros. Alertas só permitem atualização dos campos de resolução por papéis operacionais.
- Sessões, medições, confirmações de comandos e mensagens OCPP são gravadas por um serviço confiável, não diretamente pelo browser.
- A migration armazena metadados de auditoria OCPP, não payloads completos, para evitar guardar credenciais ou dados sensíveis sem necessidade.
- Cada carregador provisionado recebe uma senha aleatória de 160 bits em hexadecimal minúsculo (40 caracteres), para compatibilidade com os requisitos documentados para WEMOB PARKING; somente o hash SHA-256 é persistido e a senha é revelada uma vez ao usuário que a cadastrou.
- O gateway autentica carregadores provisionados com HTTP Basic (usuário igual ao `charge_point_id`) e comparação de hash em tempo constante. A consulta ao registro usa service role só no gateway.
- `OCPP_DEV_TOKEN` é um mecanismo provisório de ambiente local. Ele é recusado em produção; nessa configuração só credenciais de carregadores provisionados autenticam.
- Os pedidos remotos disponíveis são restritos aos papéis operacionais e exigem carregador online/conector disponível. Tags temporárias de início ficam vinculadas ao pedido, ao carregador e ao usuário; tags RFID precisam estar em allowlist por carregador. O valor RFID é comparado via SHA-256 e não é escrito em banco nem nos logs OCPP.
- O cadastro/revogação de tags RFID e a consulta de configuração OCPP são restritos a owner/admin/technician. `GetConfiguration` é somente leitura; nenhuma configuração do carregador é alterada automaticamente.
- O gateway está publicado com WSS/TLS no Fly.io e health check. A migração `202609280005_command_recovery.sql` foi aplicada e adiciona a correlação persistente das respostas e o estado `unknown`.
- Comandos interrompidos nunca são reenviados automaticamente, pois `RemoteStartTransaction` e `RemoteStopTransaction` podem ter sido executados mesmo sem uma confirmação persistida. O resultado fica explicitamente desconhecido e pode ser corrigido por uma resposta tardia correlacionada ao carregador.
- Limites operacionais de conexão/payload, monitoramento mais completo e validação com hardware/simulador ainda precisam ser avaliados antes de um piloto amplo.

O fluxo de comando está implementado, mas ainda não foi validado com hardware. O gateway público está disponível para testes controlados; valide o comportamento com um carregador/simulador antes de depender dos comandos em operação.
