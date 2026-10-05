-- Cadastro Pix para repasse MANUAL. Nao transfere dinheiro nem altera cobranca.
-- Somente servidor; nenhuma leitura direta por anon/authenticated.
begin;
create table if not exists public.eletroposto_payout_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  pix_kind text not null check (pix_kind in ('cpf','cnpj','email','telefone','aleatoria')),
  pix_key text not null check (char_length(pix_key) between 3 and 200),
  holder_name text not null check (char_length(holder_name) between 2 and 120),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create table if not exists public.eletroposto_payout_profile_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pix_kind text not null,
  pix_key text not null,
  holder_name text not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);
alter table public.eletroposto_payout_profiles enable row level security;
alter table public.eletroposto_payout_profile_history enable row level security;
revoke all on public.eletroposto_payout_profiles, public.eletroposto_payout_profile_history from public, anon, authenticated;
grant select, insert, update on public.eletroposto_payout_profiles to service_role;
grant select, insert on public.eletroposto_payout_profile_history to service_role;
grant usage, select on sequence public.eletroposto_payout_profile_history_id_seq to service_role;
create or replace function public.eletroposto_audit_payout_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.memberships m join public.organizations o on o.id = m.organization_id
    where m.organization_id = new.organization_id and m.user_id = new.updated_by and m.role = 'owner' and o.account_type = 'eletroposto') then
    raise exception 'PAYOUT_OWNER_REQUIRED';
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' or (new.pix_kind, new.pix_key, new.holder_name) is distinct from (old.pix_kind, old.pix_key, old.holder_name) then
    insert into public.eletroposto_payout_profile_history (organization_id,pix_kind,pix_key,holder_name,changed_by)
    values (new.organization_id,new.pix_kind,new.pix_key,new.holder_name,new.updated_by);
  end if;
  return new;
end $$;
revoke all on function public.eletroposto_audit_payout_profile() from public, anon, authenticated;
drop trigger if exists eletroposto_payout_profile_audit on public.eletroposto_payout_profiles;
create trigger eletroposto_payout_profile_audit before insert or update on public.eletroposto_payout_profiles
for each row execute function public.eletroposto_audit_payout_profile();
create index if not exists eletroposto_payments_payout_month_idx on public.eletroposto_payments (organization_id, settled_at, id) where status = 'settled';
commit;
