# Base de segurança

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` são as únicas chaves previstas para uso no dashboard.
- `SUPABASE_SERVICE_ROLE_KEY` é exclusivamente server-side; o gateway a usa apenas para consultar o hash da credencial OCPP pelo ID global do carregador.
- As tabelas da migration inicial têm RLS. Consultas autenticadas são limitadas por membership à organização correspondente.
- Apenas `owner`/`admin` administram locais; técnicos podem administrar carregadores; operadores/técnicos podem solicitar comandos conforme as policies iniciais.
- A migration permite consultar memberships da própria organização, mas não autoriza alterações de memberships pelo browser; convites e mudanças de papel aguardam um fluxo server-side validado.
- Perfis pessoais expõem apenas nome e avatar editáveis pelo próprio usuário; memberships e autenticação permanecem separados.
- Tarifas são administradas por owner/admin; cobranças ficam restritas aos perfis financeiros. Alertas só permitem atualização dos campos de resolução por papéis operacionais.
- Sessões, medições, confirmações de comandos e mensagens OCPP são gravadas por um serviço confiável, não diretamente pelo browser.
- A migration armazena metadados de auditoria OCPP, não payloads completos, para evitar guardar credenciais ou dados sensíveis sem necessidade.
- Cada carregador provisionado recebe uma senha aleatória de 256 bits; somente o hash SHA-256 é persistido e a senha é revelada uma vez ao usuário que a cadastrou.
- O gateway autentica carregadores provisionados com HTTP Basic (usuário igual ao `charge_point_id`) e comparação de hash em tempo constante. A consulta ao registro usa service role só no gateway.
- `OCPP_DEV_TOKEN` é um mecanismo provisório de ambiente local. Ele é recusado em produção; nessa configuração só credenciais de carregadores provisionados autenticam.
- Antes de aceitar tráfego público, ainda é necessário implantar com WSS/TLS, limites de conexão e payload, monitoramento, timeouts e auditoria de eventos OCPP.

Não publique um carregador real nem habilite controle remoto antes da implementação desses requisitos e da validação com hardware/simulador controlado.
