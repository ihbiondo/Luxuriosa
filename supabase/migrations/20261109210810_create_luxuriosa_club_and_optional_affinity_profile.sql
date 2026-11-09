-- Clube Luxuriosa: membership, discount audit fields, compact preferences and explicit sensitive-data consent.

alter table public.profiles
  add column if not exists club_joined_at timestamptz;

update public.profiles
set club_joined_at = coalesce(club_joined_at, created_at, now())
where club_joined_at is null;

alter table public.profiles
  alter column club_joined_at set default now(),
  alter column club_joined_at set not null;

alter table public.orders
  add column if not exists club_discount_amount_cents integer not null default 0,
  add column if not exists club_discount_percent smallint not null default 0,
  add column if not exists club_discount_rule_version text;

alter table public.orders
  drop constraint if exists orders_club_discount_check;

alter table public.orders
  add constraint orders_club_discount_check
  check (
    club_discount_amount_cents >= 0
    and club_discount_percent in (0, 10)
    and (
      (club_discount_amount_cents = 0 and club_discount_percent = 0
        and club_discount_rule_version is null)
      or
      (club_discount_amount_cents > 0 and club_discount_percent = 10
        and club_discount_rule_version = 'clube-10-v1-2026-11')
    )
  );

create table if not exists public.club_profile_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  style_codes text[] not null default '{}',
  communication_code smallint not null default 2,
  updated_at timestamptz not null default now(),
  constraint club_profile_style_codes_count
    check (cardinality(style_codes) <= 4),
  constraint club_profile_style_codes_allowed
    check (style_codes <@ array[
      'classico','elegante','minimalista','romantico','moderno','ousado','discreto'
    ]::text[]),
  constraint club_profile_communication_code_allowed
    check (communication_code in (1, 2, 3))
);

create table if not exists public.club_intimate_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  experience_level smallint,
  novelty_code smallint,
  context_code smallint,
  intensity_code smallint,
  recommendation_tone_code smallint not null default 1,
  desired_codes text[] not null default '{}',
  category_codes text[] not null default '{}',
  sensation_codes text[] not null default '{}',
  avoid_codes text[] not null default '{}',
  consent_version text not null,
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_intimate_experience_level_allowed
    check (experience_level is null or experience_level in (1, 2, 3, 4)),
  constraint club_intimate_novelty_code_allowed
    check (novelty_code is null or novelty_code in (1, 2, 3)),
  constraint club_intimate_context_code_allowed
    check (context_code is null or context_code in (1, 2, 3, 4)),
  constraint club_intimate_intensity_code_allowed
    check (intensity_code is null or intensity_code in (1, 2, 3, 4)),
  constraint club_intimate_recommendation_tone_allowed
    check (recommendation_tone_code in (1, 2, 3)),
  constraint club_intimate_consent_version_allowed
    check (consent_version = 'luxuriosa-intimate-profile-v1-2026-11'),
  constraint club_intimate_desired_codes_count
    check (cardinality(desired_codes) <= 6),
  constraint club_intimate_desired_codes_allowed
    check (desired_codes <@ array[
      'autoconhecimento','momentos_compartilhados','novas_sensacoes',
      'romance_conexao','brincadeira_jogos','massagem',
      'surpresa_presente','bem_estar'
    ]::text[]),
  constraint club_intimate_category_codes_count
    check (cardinality(category_codes) <= 8),
  constraint club_intimate_category_codes_allowed
    check (category_codes <@ array[
      'gels','vibradores','jogos','masturbadores','aneis',
      'plugs','proteses','kits','perfumes','higiene'
    ]::text[]),
  constraint club_intimate_sensation_codes_count
    check (cardinality(sensation_codes) <= 5),
  constraint club_intimate_sensation_codes_allowed
    check (sensation_codes <@ array[
      'vibracao','texturas','aquecimento','refrescancia','aroma','massagem'
    ]::text[]),
  constraint club_intimate_avoid_codes_count
    check (cardinality(avoid_codes) <= 10),
  constraint club_intimate_avoid_codes_allowed
    check (avoid_codes <@ array[
      'gels','vibradores','jogos','masturbadores','aneis',
      'plugs','proteses','kits','perfumes','higiene'
    ]::text[])
);

create table if not exists public.club_intimate_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted boolean not null,
  consent_version text not null,
  source text not null default 'account_settings',
  event_key uuid not null unique,
  created_at timestamptz not null default now(),
  constraint club_intimate_consent_version_allowed
    check (consent_version = 'luxuriosa-intimate-profile-v1-2026-11'),
  constraint club_intimate_consent_source_allowed
    check (source = 'account_settings')
);

create index if not exists club_intimate_consent_events_user_created_idx
  on public.club_intimate_consent_events(user_id, created_at desc);

alter table public.club_profile_preferences enable row level security;
alter table public.club_intimate_preferences enable row level security;
alter table public.club_intimate_consent_events enable row level security;

drop policy if exists club_profile_preferences_select_own on public.club_profile_preferences;
create policy club_profile_preferences_select_own
  on public.club_profile_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists club_profile_preferences_insert_own on public.club_profile_preferences;
create policy club_profile_preferences_insert_own
  on public.club_profile_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists club_profile_preferences_update_own on public.club_profile_preferences;
create policy club_profile_preferences_update_own
  on public.club_profile_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists club_intimate_preferences_select_own on public.club_intimate_preferences;
create policy club_intimate_preferences_select_own
  on public.club_intimate_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists club_intimate_preferences_insert_own on public.club_intimate_preferences;
create policy club_intimate_preferences_insert_own
  on public.club_intimate_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists club_intimate_preferences_update_own on public.club_intimate_preferences;
create policy club_intimate_preferences_update_own
  on public.club_intimate_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists club_intimate_preferences_delete_own on public.club_intimate_preferences;
create policy club_intimate_preferences_delete_own
  on public.club_intimate_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists club_intimate_consent_events_select_own on public.club_intimate_consent_events;
create policy club_intimate_consent_events_select_own
  on public.club_intimate_consent_events for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists club_intimate_consent_events_insert_own on public.club_intimate_consent_events;
create policy club_intimate_consent_events_insert_own
  on public.club_intimate_consent_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.club_profile_preferences to authenticated;
grant select, insert, update, delete on public.club_intimate_preferences to authenticated;
grant select, insert on public.club_intimate_consent_events to authenticated;
