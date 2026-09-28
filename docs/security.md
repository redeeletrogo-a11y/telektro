# Base de segurança

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são as únicas chaves previstas para uso no dashboard.
- `SUPABASE_SERVICE_ROLE_KEY` é exclusivamente server-side e ainda não é consumida pelo gateway.
- As tabelas da migration inicial têm RLS. Consultas autenticadas são limitadas por membership à organização correspondente.
- Apenas `owner`/`admin` administram locais; técnicos podem administrar carregadores; operadores/técnicos podem solicitar comandos conforme as policies iniciais.
- A migration permite consultar memberships da própria organização, mas não autoriza alterações de memberships pelo browser; convites e mudanças de papel aguardam um fluxo server-side validado.
- Sessões, medições, confirmações de comandos e mensagens OCPP são gravadas por um serviço confiável, não diretamente pelo browser.
- A migration armazena metadados de auditoria OCPP, não payloads completos, para evitar guardar credenciais ou dados sensíveis sem necessidade.
- O listener OCPP recusa conexões por padrão. `OCPP_DEV_TOKEN` é um mecanismo provisório de ambiente local e não habilita autenticação em produção.
- Para produção, o gateway precisa autenticar cada carregador, vincular credenciais a uma organização, usar WSS/TLS, limitar tráfego, auditar operações e validar chamadas remotas antes de aceitar conexões públicas.

Não publique um carregador real nem habilite controle remoto antes da implementação desses requisitos e da validação com hardware/simulador controlado.
