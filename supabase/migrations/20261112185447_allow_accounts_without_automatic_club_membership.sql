-- New customer accounts must not become Club members by default.
-- Membership is recorded only after an explicit opt-in in public.club_memberships.
alter table public.profiles
  alter column club_joined_at drop not null,
  alter column club_joined_at drop default;
