-- Complementa as fixtures de login no banco descartável do CI com o
-- schema mínimo dos eventos de consentimento. Nunca é aplicada em produção.

alter table public.account_data_consents
  add column source text not null
    check (source in ('signup', 'account_settings')),
  add column event_key uuid not null;

alter table public.account_data_consents
  add constraint account_data_consents_event_key_key unique (event_key);

revoke all on public.account_data_consents from public, anon, authenticated;
grant select, insert on public.account_data_consents to authenticated;

create policy account_data_consents_insert_own
  on public.account_data_consents
  for insert to authenticated
  with check ((select auth.uid()) = user_id);


create table public.club_intimate_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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
