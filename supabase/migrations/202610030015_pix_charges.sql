-- Pix mensalidade (Residencial): uma cobranca Pix por ciclo, confirmada pelo webhook do Mercado Pago.
-- Rode no SQL Editor do Supabase. Idempotente: pode rodar mais de uma vez.

create table if not exists public.pix_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mp_payment_id text unique,
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pix_charges_org_created_idx on public.pix_charges (organization_id, created_at desc);

alter table public.pix_charges enable row level security;

-- Membros veem as cobrancas da propria conta. Ninguem escreve pelo cliente: so o servidor (service role).
drop policy if exists "Members read pix charges" on public.pix_charges;
create policy "Members read pix charges" on public.pix_charges
  for select to authenticated using (public.is_org_member(organization_id));

revoke insert, update, delete on public.pix_charges from anon, authenticated;

-- Nota: assinantes Pix ficam com subscription_status = 'past_due' e subscription_provider = 'mercadopago_pix';
-- o acesso vem de current_period_end (fim do periodo pago + 3 dias de carencia) via org_has_access().
