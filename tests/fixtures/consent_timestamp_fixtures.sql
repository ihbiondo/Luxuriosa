-- Estruturas mínimas e isoladas para testar a integridade temporal dos
-- eventos de consentimento no banco descartável do CI. Nunca é aplicada em produção.

create table public.account_data_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  purpose text not null
    check (purpose in ('experience_personalization', 'aggregated_insights_sharing')),
  granted boolean not null,
  source text not null
    check (source in ('signup', 'account_settings')),
  consent_text_version text not null,
  event_key uuid not null unique,
  created_at timestamptz not null default now()
);

alter table public.account_data_consents enable row level security;
revoke all on public.account_data_consents from public, anon, authenticated;
grant select, insert on public.account_data_consents to authenticated;

create policy account_data_consents_select_own
  on public.account_data_consents
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy account_data_consents_insert_own
  on public.account_data_consents
  for insert to authenticated
  with check ((select auth.uid()) = user_id);


create table public.club_intimate_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  granted boolean not null,
  consent_version text not null
    check (consent_version = 'luxuriosa-intimate-profile-v1-2026-11'),
  source text not null default 'account_settings'
    check (source = 'account_settings'),
  event_key uuid not null unique,
  created_at timestamptz not null default now()
);

alter table public.club_intimate_consent_events enable row level security;
revoke all on public.club_intimate_consent_events from public, anon, authenticated;
grant select, insert on public.club_intimate_consent_events to authenticated;

create policy club_intimate_consent_events_select_own
  on public.club_intimate_consent_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy club_intimate_consent_events_insert_own
  on public.club_intimate_consent_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
