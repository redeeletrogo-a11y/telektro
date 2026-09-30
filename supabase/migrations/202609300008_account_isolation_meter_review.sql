-- Give future auth accounts an isolated organization and profile at signup.
-- Existing organizations, memberships, and operational data are left untouched.
create or replace function public.initialize_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_slug text;
  v_organization_id uuid;
begin
  v_name := left(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'organization_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Minha organização'
  ), 120);
  v_slug := 'org-' || replace(new.id::text, '-', '');

  insert into public.organizations (name, slug)
  values (v_name, v_slug)
  returning id into v_organization_id;

  insert into public.memberships (organization_id, user_id, role)
  values (v_organization_id, new.id, 'owner');

  insert into public.users (id, display_name)
  values (new.id, nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.initialize_new_account() from public, anon, authenticated;
drop trigger if exists initialize_new_account_after_signup on auth.users;
create trigger initialize_new_account_after_signup
  after insert on auth.users
  for each row execute function public.initialize_new_account();

-- Keep row-level security enabled for every current application table.
do $$
declare
  v_table record;
begin
  for v_table in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', v_table.tablename);
  end loop;
end;
$$;

alter table public.meter_values
  add column requires_review boolean not null default false,
  add column review_reason text;

alter table public.meter_values
  add constraint meter_values_review_reason_check
  check (not requires_review or review_reason is not null);

create index meter_values_session_energy_history_idx
  on public.meter_values (session_id, measurand, sampled_at desc)
  where not requires_review;

comment on column public.meter_values.requires_review is 'Suspect OCPP readings are retained for diagnostics but excluded from delivered-energy calculations.';
comment on column public.meter_values.review_reason is 'Reason a meter reading was excluded from operational energy calculations.';
