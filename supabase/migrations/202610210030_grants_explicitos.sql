-- Grants explicitos e minimos (Supabase: a partir de 30/10/2026 tabelas NOVAS deixam de receber grants automaticos).
-- Idempotente e aditivo: em producao so repete o que ja existe (nada e revogado, nada novo e aberto alem do necessario).
-- Fronteiras mantidas: authenticated NAO le chargers inteira (ocpp_credential_hash e claim_token ficam ocultos, leitura por coluna),
-- NAO atualiza/apaga chargers, NAO toca em pagamentos/repasses; anon sem acesso; RLS continua ativo em todas as tabelas.
begin;

-- Painel (usuario logado, sob RLS)
grant select on public.pix_charges to authenticated;
grant select on public.resident_tags to authenticated;

-- Backend (rotas do servidor) e gateway OCPP: acessos diretos feitos pelo codigo com a service role
grant select, update on public.organizations to service_role;
grant select on public.memberships to service_role;
grant select, update on public.chargers to service_role;
grant select, insert, update on public.connectors to service_role;
grant select, insert, update on public.sessions to service_role;
grant select, insert on public.meter_values to service_role;
grant select, insert, update on public.commands to service_role;
grant insert on public.ocpp_messages to service_role;
grant select, update on public.charger_authorizations to service_role;
grant select on public.tariffs to service_role;
grant select, insert, update, delete on public.pix_charges to service_role;

commit;
