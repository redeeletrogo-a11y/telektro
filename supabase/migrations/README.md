# Migrations do Supabase

Estes arquivos SQL ficam no projeto local e são versionados no GitHub. O painel do Supabase não sincroniza esta pasta automaticamente.

## Arquivos e estado atual

| Arquivo | Conteúdo | Estado no projeto `telektro` |
| --- | --- | --- |
| `202609280001_initial_multitenancy.sql` | Organizações, memberships e políticas de acesso | Aplicada |
| `202609280002_product_entities.sql` | Entidades e tabelas do produto | Aplicada |
| `202609280003_organization_onboarding.sql` | Função para criar organização e tornar o usuário proprietário | Aplicada em 2026-09-28 |
| `202609280004_charger_credentials.sql` | Índice OCPP e hash das credenciais dos carregadores | Aplicada |
| `202609280005_command_recovery.sql` | Recuperação/correlação de comandos OCPP após reinício | Aplicada |
| `202609280006_charger_profiles.sql` | Metadados de modelos, conectores e perfil técnico | Aplicada |
| `202609300007_remote_authorization_diagnostics.sql` | Autorizações RFID por hash, capabilities, diagnóstico e concorrência por conector | Aplicada pelo proprietário em 2026-09-30 |
| `202609300009_charger_archive_and_restore.sql` | Arquivamento seguro de carregadores e restauração por 30 dias | Aplicada pelo proprietário |
| `202609300010_rotate_charger_credentials.sql` | Rotação de credencial OCPP com auditoria do responsável | Pendente de aplicação pelo proprietário |
| `202610030020_eletroposto_prepago.sql` | Eletroposto pré-pago por QR (pontos, pagamentos, triggers de parada e liquidação) | Pendente de aplicação pelo proprietário |

## Aplicar uma migration manualmente

1. Abra o arquivo `.sql` novo que foi criado em `supabase/migrations`.
2. Copie todo o conteúdo e cole em uma consulta nova no SQL Editor do projeto Supabase correto.
3. Execute uma vez e confirme a mensagem de sucesso.

Não execute novamente arquivos marcados como aplicados. Migrations podem conter operações que falham ou alteram dados se repetidas.

Neste projeto, as migrations foram executadas pelo SQL Editor e a tabela de histórico do Supabase CLI ainda não existe. A migration 007 foi aplicada pelo proprietário no SQL Editor em 2026-09-30. Antes de passar a usar `supabase db push`, será necessário sincronizar o histórico para o CLI não tentar reaplicar os arquivos antigos.

- `202610030022_eletroposto_cartao.sql`: taxa por meio (Pix 5%, cartão 9%), colunas do cartão no pagamento e `eletroposto_create_payment(..., p_method)`. Rodar em 3 partes (colunas, função, permissões) antes do deploy do PR do cartão.
