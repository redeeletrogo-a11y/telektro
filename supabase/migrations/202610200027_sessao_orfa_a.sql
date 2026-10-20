-- Parte A: colunas para registrar um StopTransaction que chega depois da sessao ja ter sido fechada por inatividade.
alter table public.sessions
  add column if not exists late_stop_meter_wh numeric(14, 3),
  add column if not exists late_stop_at timestamptz;
