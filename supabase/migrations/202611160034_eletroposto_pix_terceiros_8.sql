-- Eletroposto: Pix passa a cair sempre na conta da plataforma (repasse semanal ao dono), com taxa de 8%
-- (inclui a tarifa do Mercado Pago, ~0,99%). Cartao segue automatico (split) a 5%.
-- Decisao do proprietario (16/11/2026, opcao C). Idempotente.
-- NAO toca a org real "condominio barreta" (fedbd087-...) nem o ponto Unifarma/demo: filtro explicito por organizacao.

begin;

alter table public.eletroposto_points alter column platform_fee_pix_pct set default 8;

update public.eletroposto_points p
set platform_fee_pix_pct = 8
where p.organization_id <> 'fedbd087-8456-4861-b2b8-56d198441938'
  and p.platform_fee_pix_pct is distinct from 8
  and exists (select 1 from public.eletroposto_mp_connections c where c.organization_id = p.organization_id);

commit;
