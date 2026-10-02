-- Cartao/tag RFID vinculado a um morador (condominio). O sindico cadastra uma vez e a tag vale em TODOS os
-- carregadores do condominio (inclusive os que forem cadastrados depois). A sessao fica no nome do morador,
-- entao a cobranca por kWh (migration 0017) vai pro morador certo. O gateway OCPP nao muda: continua
-- lendo charger_authorizations. Idempotente.

create table if not exists public.resident_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text check (label is null or char_length(label) <= 60),
  id_tag_hash text not null check (id_tag_hash ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id_tag_hash)
);
create index if not exists resident_tags_user_idx on public.resident_tags (organization_id, user_id);

alter table public.resident_tags enable row level security;
drop policy if exists "Admins read tags, residents read own" on public.resident_tags;
create policy "Admins read tags, residents read own" on public.resident_tags
  for select to authenticated using (public.is_org_admin(organization_id) or (user_id = (select auth.uid()) and public.is_org_member(organization_id)));
revoke insert, update, delete on public.resident_tags from anon, authenticated;

-- Cadastra a tag para um morador e libera em todos os carregadores da conta. So owner/admin.
create or replace function public.register_resident_tag(p_organization_id uuid, p_user_id uuid, p_id_tag_hash text, p_label text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_org_admin(p_organization_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id and account_type = 'condominio') then raise exception 'NOT_CONDOMINIO' using errcode = '22023'; end if;
  if not exists (select 1 from public.memberships where organization_id = p_organization_id and user_id = p_user_id and role::text = 'resident') then raise exception 'NOT_RESIDENT' using errcode = '22023'; end if;
  if p_id_tag_hash !~ '^[a-f0-9]{64}$' then raise exception 'BAD_TAG' using errcode = '22023'; end if;
  if (select count(*) from public.resident_tags where organization_id = p_organization_id and user_id = p_user_id and enabled) >= 5 then raise exception 'TAG_LIMIT' using errcode = '22023'; end if;
  -- A tag nao pode ja estar em uso (por outro morador ou cadastrada solta em algum carregador).
  if exists (select 1 from public.resident_tags where organization_id = p_organization_id and id_tag_hash = p_id_tag_hash and enabled)
     or exists (select 1 from public.charger_authorizations where organization_id = p_organization_id and id_tag_hash = p_id_tag_hash and enabled) then
    raise exception 'TAG_IN_USE' using errcode = '23505';
  end if;
  -- Reaproveita a linha antiga (revogada) da mesma tag, se existir.
  insert into public.resident_tags (organization_id, user_id, label, id_tag_hash, created_by)
  values (p_organization_id, p_user_id, nullif(btrim(p_label), ''), p_id_tag_hash, (select auth.uid()))
  on conflict (organization_id, id_tag_hash) do update set user_id = excluded.user_id, label = excluded.label, enabled = true, created_by = excluded.created_by
  returning id into v_id;
  insert into public.charger_authorizations (organization_id, charger_id, user_id, id_tag_hash, authorization_type, enabled, created_by)
  select c.organization_id, c.id, p_user_id, p_id_tag_hash, 'RFID', true, (select auth.uid())
  from public.chargers c where c.organization_id = p_organization_id
  on conflict (charger_id, id_tag_hash) do update set enabled = true, user_id = excluded.user_id;
  return v_id;
end $$;
revoke all on function public.register_resident_tag(uuid, uuid, text, text) from public, anon;
grant execute on function public.register_resident_tag(uuid, uuid, text, text) to authenticated;

create or replace function public.revoke_resident_tag(p_tag_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tag public.resident_tags%rowtype;
begin
  select * into v_tag from public.resident_tags where id = p_tag_id;
  if not found then return; end if;
  if not public.is_org_admin(v_tag.organization_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.resident_tags set enabled = false where id = v_tag.id;
  update public.charger_authorizations set enabled = false
  where organization_id = v_tag.organization_id and id_tag_hash = v_tag.id_tag_hash and user_id = v_tag.user_id;
end $$;
revoke all on function public.revoke_resident_tag(uuid) from public, anon;
grant execute on function public.revoke_resident_tag(uuid) to authenticated;

-- Carregador novo recebe as tags ativas dos moradores automaticamente.
create or replace function public.resident_tags_to_new_charger() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.charger_authorizations (organization_id, charger_id, user_id, id_tag_hash, authorization_type, enabled, created_by)
  select t.organization_id, new.id, t.user_id, t.id_tag_hash, 'RFID', true, t.created_by
  from public.resident_tags t where t.organization_id = new.organization_id and t.enabled
  on conflict (charger_id, id_tag_hash) do nothing;
  return new;
end $$;
drop trigger if exists chargers_resident_tags on public.chargers;
create trigger chargers_resident_tags after insert on public.chargers
  for each row execute function public.resident_tags_to_new_charger();

-- Morador removido: as tags dele deixam de valer em todos os carregadores.
create or replace function public.resident_tags_on_resident_removed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role::text <> 'resident' then return old; end if;
  update public.charger_authorizations a set enabled = false
  from public.resident_tags t
  where t.organization_id = old.organization_id and t.user_id = old.user_id and a.organization_id = t.organization_id and a.id_tag_hash = t.id_tag_hash and a.user_id = t.user_id;
  update public.resident_tags set enabled = false where organization_id = old.organization_id and user_id = old.user_id;
  return old;
end $$;
drop trigger if exists memberships_resident_tags on public.memberships;
create trigger memberships_resident_tags after delete on public.memberships
  for each row execute function public.resident_tags_on_resident_removed();
