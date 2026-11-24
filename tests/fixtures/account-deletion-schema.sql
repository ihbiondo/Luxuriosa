-- Esquema mínimo isolado para testar a limpeza da exclusão de conta.
-- Existe apenas no projeto Supabase descartável criado pelo workflow.
create schema if not exists private;

create table if not exists public.account_data_consents (user_id uuid);
create table if not exists public.account_privacy_acceptances (user_id uuid);
create table if not exists public.contact_consents (user_id uuid);
create table if not exists public.delivery_plan_memberships (user_id uuid);
create table if not exists public.experience_results (user_id uuid);
create table if not exists public.experience_terms_acceptances (user_id uuid);

create table if not exists public.cart_instances (
  id uuid primary key,
  user_id uuid
);
create table if not exists public.cart_sessions (
  id uuid primary key,
  user_id uuid
);
create table if not exists public.orders (
  id uuid primary key,
  customer_id uuid,
  cart_instance_id uuid references public.cart_instances(id) on delete set null,
  cart_session_id uuid references public.cart_sessions(id) on delete set null
);

-- O schema base usado pelo CI declara customer_id como NOT NULL, mas o
-- banco hospedado permite NULL e usa ON DELETE SET NULL para preservar pedidos.
-- Alinhar somente o banco descartável do teste ao comportamento de produção.
alter table public.orders
  alter column customer_id drop not null;

create table if not exists public.profiles (id uuid primary key);
create table if not exists public.addresses (
  user_id uuid references public.profiles(id) on delete cascade
);
create table if not exists public.club_intimate_consent_events (
  user_id uuid references public.profiles(id) on delete cascade
);
create table if not exists public.club_intimate_preferences (
  user_id uuid references public.profiles(id) on delete cascade
);
create table if not exists public.club_memberships (
  user_id uuid references public.profiles(id) on delete cascade
);
create table if not exists public.club_profile_preferences (
  user_id uuid references public.profiles(id) on delete cascade
);
create table if not exists public.preferences (
  user_id uuid references public.profiles(id) on delete cascade
);
create table if not exists public.user_permissions (
  user_id uuid references public.profiles(id) on delete cascade
);
