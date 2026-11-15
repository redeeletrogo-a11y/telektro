-- Eletroposto: taxa da plataforma passa a 5% no Pix e no cartao como padrao para novos pontos.
-- Decisao do proprietario (15/11/2026): 8% + taxa do Mercado Pago no cartao chegava a ~13%, alto demais.
-- A taxa do Mercado Pago (Pix ~1%, cartao ~4%) continua por conta do dono do ponto, por cima destes 5%.
-- NAO altera pontos existentes: quem ja tem taxa gravada continua com o valor atual ate ajuste manual.
-- Idempotente: pode rodar mais de uma vez.

begin;

alter table public.eletroposto_points alter column platform_fee_pix_pct set default 5;
alter table public.eletroposto_points alter column platform_fee_card_pct set default 5;

commit;
