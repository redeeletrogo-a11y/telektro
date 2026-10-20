begin;
-- Registro (livro) de repasses ja feitos ao dono. NAO move dinheiro: so anota.
-- Append-only: o app so insere; nao ha update nem delete.
create table if not exists public.eletroposto_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month text not null check (month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  amount numeric(12,2) not null check (amount > 0 and amount < 1000000),
  paid_on date not null,
  note text check (note is null or char_length(note) <= 200),
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.eletroposto_payouts enable row level security;
revoke all on public.eletroposto_payouts from public, anon, authenticated, service_role;
create index if not exists eletroposto_payouts_org_month_idx on public.eletroposto_payouts (organization_id, month);
create or replace function public.eletroposto_payouts_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.memberships m join public.organizations o on o.id = m.organization_id
    where m.organization_id = new.organization_id and m.user_id = new.recorded_by and m.role = 'owner' and o.account_type = 'eletroposto') then
    raise exception 'PAYOUT_OWNER_REQUIRED';
  end if;
  return new;
end $$;
revoke all on function public.eletroposto_payouts_guard() from public, anon, authenticated;
drop trigger if exists eletroposto_payouts_guard on public.eletroposto_payouts;
create trigger eletroposto_payouts_guard before insert on public.eletroposto_payouts
for each row execute function public.eletroposto_payouts_guard();
grant select, insert on public.eletroposto_payouts to service_role;
commit;
