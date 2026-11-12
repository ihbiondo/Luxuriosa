-- Adesão explícita ao Clube e autorizações opcionais independentes.
-- O registro de membro é separado do perfil da conta. Nenhum dado identificável
-- é compartilhado com parceiros por esta migração.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.club_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  terms_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_memberships_leave_state_check
    check ((active = true and left_at is null) or (active = false and left_at is not null))
);

alter table public.club_memberships enable row level security;
create policy club_memberships_select_own
  on public.club_memberships for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.club_memberships from public, anon, authenticated;
alter table public.profiles alter column club_joined_at drop default;

create or replace function private.get_club_membership_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_state jsonb;
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para consultar o Clube.' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'is_member', coalesce((
      select m.active from public.club_memberships m where m.user_id = v_user_id
    ), false),
    'joined_at', (
      select m.joined_at from public.club_memberships m
      where m.user_id = v_user_id and m.active = true
    ),
    'personalization', coalesce((
      select c.granted from public.account_data_consents c
      where c.user_id = v_user_id and c.purpose = 'experience_personalization'
      order by c.created_at desc, c.id desc limit 1
    ), false),
    'anonymous_statistics', coalesce((
      select c.granted from public.account_data_consents c
      where c.user_id = v_user_id and c.purpose = 'aggregated_insights_sharing'
      order by c.created_at desc, c.id desc limit 1
    ), false),
    'whatsapp_marketing', coalesce((
      select c.granted from public.contact_consents c
      where c.user_id = v_user_id and c.channel = 'whatsapp' and c.purpose = 'marketing'
      order by c.created_at desc, c.id desc limit 1
    ), false)
  ) into v_state;

  return v_state;
end;
$$;

create or replace function private.save_club_membership_preferences(
  p_accept_terms boolean,
  p_personalization boolean,
  p_anonymous_statistics boolean,
  p_whatsapp_marketing boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_active boolean := false;
  v_joined_at timestamptz;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para atualizar suas escolhas.' using errcode = '28000';
  end if;
  if p_accept_terms is null or p_personalization is null
     or p_anonymous_statistics is null or p_whatsapp_marketing is null then
    raise exception 'Revise todas as opções antes de continuar.' using errcode = '22023';
  end if;

  select m.active into v_existing_active
  from public.club_memberships m
  where m.user_id = v_user_id
  for update;

  if coalesce(v_existing_active, false) = false and p_accept_terms = true then
    insert into public.club_memberships (user_id, active, joined_at, terms_version)
    values (v_user_id, true, v_now, 'luxuriosa-club-terms-v1-2026-11')
    on conflict (user_id) do update
      set active = true,
          left_at = null,
          joined_at = case
            when public.club_memberships.active = false then excluded.joined_at
            else public.club_memberships.joined_at
          end,
          terms_version = excluded.terms_version,
          updated_at = v_now;
  end if;

  insert into public.account_data_consents
    (user_id, purpose, granted, source, consent_text_version, event_key)
  values
    (v_user_id, 'experience_personalization', p_personalization,
     'account_settings', 'luxuriosa-account-data-v2-2026-11', gen_random_uuid()),
    (v_user_id, 'aggregated_insights_sharing', p_anonymous_statistics,
     'account_settings', 'luxuriosa-account-data-v2-2026-11', gen_random_uuid());

  insert into public.contact_consents
    (user_id, channel, purpose, granted, source, consent_text_version, granted_at, revoked_at)
  values
    (v_user_id, 'whatsapp', 'marketing', p_whatsapp_marketing, 'account',
     'luxuriosa-club-marketing-v1-2026-11',
     case when p_whatsapp_marketing then v_now else null end,
     case when p_whatsapp_marketing then null else v_now end);

  select m.joined_at into v_joined_at
  from public.club_memberships m
  where m.user_id = v_user_id and m.active = true;

  return v_joined_at;
end;
$$;

create or replace function private.leave_luxuriosa_club()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para sair do Clube.' using errcode = '28000';
  end if;

  update public.club_memberships
  set active = false, left_at = now(), updated_at = now()
  where user_id = v_user_id and active = true;

  return found;
end;
$$;

revoke all on function private.get_club_membership_state() from public, anon, authenticated;
revoke all on function private.save_club_membership_preferences(boolean, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function private.leave_luxuriosa_club() from public, anon, authenticated;

grant execute on function private.get_club_membership_state() to authenticated;
grant execute on function private.save_club_membership_preferences(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function private.leave_luxuriosa_club() to authenticated;

create or replace function public.get_club_membership_state()
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.get_club_membership_state(); $$;

create or replace function public.save_club_membership_preferences(
  p_accept_terms boolean,
  p_personalization boolean,
  p_anonymous_statistics boolean,
  p_whatsapp_marketing boolean
)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  select private.save_club_membership_preferences(
    p_accept_terms, p_personalization, p_anonymous_statistics, p_whatsapp_marketing
  );
$$;

create or replace function public.leave_luxuriosa_club()
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.leave_luxuriosa_club(); $$;

revoke all on function public.get_club_membership_state() from public, anon;
revoke all on function public.save_club_membership_preferences(boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.leave_luxuriosa_club() from public, anon;

grant execute on function public.get_club_membership_state() to authenticated;
grant execute on function public.save_club_membership_preferences(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.leave_luxuriosa_club() to authenticated;
