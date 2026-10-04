-- Condominio: mensalidade. Parte C - moradores extras sao cobrados (em vez de bloqueados).
-- Conta o PICO de moradores cadastrados desde a ultima fatura paga, para nao burlar removendo moradores antes de pagar.
alter table public.organizations add column if not exists resident_peak integer not null default 0;
update public.organizations o set resident_peak = (select count(*) from public.memberships m where m.organization_id = o.id and m.role::text = 'resident') where o.account_type = 'condominio';

create or replace function public.track_resident_peak() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role::text = 'resident' then
    update public.organizations o set resident_peak = greatest(o.resident_peak, (select count(*)::int from public.memberships m where m.organization_id = new.organization_id and m.role::text = 'resident'))
    where o.id = new.organization_id;
  end if;
  return new;
end $$;
drop trigger if exists memberships_resident_peak on public.memberships;
create trigger memberships_resident_peak after insert on public.memberships for each row execute function public.track_resident_peak();

-- Aceitar convite: sem limite de 5 (extras entram na proxima fatura). Teto de seguranca: 100 moradores.
create or replace function public.accept_resident_invite(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.organization_invites%rowtype;
  v_org public.organizations%rowtype;
  v_count integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_invite from public.organization_invites where code = lower(btrim(p_code)) for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'INVITE_INVALID' using errcode = '22023';
  end if;
  select * into v_org from public.organizations where id = v_invite.organization_id for update;
  if exists (select 1 from public.memberships where organization_id = v_org.id and user_id = v_user) then
    return v_org.id;
  end if;
  select count(*) into v_count from public.memberships where organization_id = v_org.id and role = 'resident';
  if v_count >= 100 then raise exception 'RESIDENT_LIMIT_REACHED' using errcode = '22023'; end if;
  insert into public.memberships (organization_id, user_id, role) values (v_org.id, v_user, 'resident');
  update public.organization_invites set accepted_count = accepted_count + 1 where id = v_invite.id;
  return v_org.id;
end; $$;

