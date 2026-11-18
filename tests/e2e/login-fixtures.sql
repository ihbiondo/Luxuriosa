-- Somente para o ambiente E2E descartável do CI.
-- Estas tabelas permitem que a tela de login percorra seu fluxo normal sem
-- trazer o schema comercial nem qualquer dado do Supabase hospedado.
-- O workflow copia este arquivo para a pasta de migrations do scratch project;
-- ele nunca é aplicado em produção.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  display_name text,
  phone text,
  birth_date date,
  oauth_setup_completed_at timestamptz
);

create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorite_colors text[] not null default '{}',
  favorite_categories text[] not null default '{}',
  preferred_price_range text,
  preferred_offer_type text
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  postal_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  is_default boolean not null default false
);

create table public.account_data_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  granted boolean not null,
  consent_text_version text not null,
  created_at timestamptz not null default now()
);

create table public.contact_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  purpose text not null,
  granted boolean not null,
  consent_text_version text not null,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_number text,
  status text,
  subtotal numeric(12,2),
  shipping_amount numeric(12,2),
  total_amount numeric(12,2),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  quantity integer not null default 1
);

create table public.user_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null
);

alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.addresses enable row level security;
alter table public.account_data_consents enable row level security;
alter table public.contact_consents enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.user_permissions enable row level security;

grant select on public.profiles, public.preferences, public.addresses,
  public.account_data_consents, public.contact_consents, public.orders,
  public.order_items, public.user_permissions to authenticated;

create policy e2e_profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy e2e_preferences_select_own on public.preferences
  for select to authenticated using ((select auth.uid()) = user_id);

create policy e2e_addresses_select_own on public.addresses
  for select to authenticated using ((select auth.uid()) = user_id);

create policy e2e_consents_select_own on public.account_data_consents
  for select to authenticated using ((select auth.uid()) = user_id);

create policy e2e_contact_consents_select_own on public.contact_consents
  for select to authenticated using ((select auth.uid()) = user_id);

create policy e2e_orders_select_own on public.orders
  for select to authenticated using ((select auth.uid()) = customer_id);

create policy e2e_order_items_select_own on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders as account_order
      where account_order.id = order_id
        and account_order.customer_id = (select auth.uid())
    )
  );

create policy e2e_permissions_select_own on public.user_permissions
  for select to authenticated using ((select auth.uid()) = user_id);
