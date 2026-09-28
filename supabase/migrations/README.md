# Migrations do Supabase

Estes arquivos SQL ficam no projeto local e são versionados no GitHub. O painel do Supabase não sincroniza esta pasta automaticamente.

## Arquivos e estado atual

| Arquivo | Conteúdo | Estado no projeto `telektro` |
| --- | --- | --- |
| `202609280001_initial_multitenancy.sql` | Organizações, memberships e políticas de acesso | Aplicada |
| `202609280002_product_entities.sql` | Entidades e tabelas do produto | Aplicada |
| `202609280003_organization_onboarding.sql` | Função para criar organização e tornar o usuário proprietário | Aplicada em 2026-09-28 |
| `202609280004_charger_credentials.sql` | Índice OCPP e hash das credenciais dos carregadores | Aplicada |

## Aplicar uma migration manualmente

1. Abra o arquivo `.sql` novo que foi criado em `supabase/migrations`.
2. Copie todo o conteúdo e cole em uma consulta nova no SQL Editor do projeto Supabase correto.
3. Execute uma vez e confirme a mensagem de sucesso.

Não execute novamente arquivos marcados como aplicados. Migrations podem conter operações que falham ou alteram dados se repetidas.

Neste projeto, as migrations foram executadas pelo SQL Editor e a tabela de histórico do Supabase CLI ainda não existe. Antes de passar a usar `supabase db push`, será necessário sincronizar o histórico para o CLI não tentar reaplicar os arquivos antigos.
