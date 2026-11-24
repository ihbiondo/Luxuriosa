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

create table public.account_privacy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_version text not null,
  source text not null,
  event_key uuid not null unique,
  accepted_at timestamptz not null default now()
);

create table public.account_data_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  granted boolean not null,
  consent_text_version text not null,
  created_at timestamptz not null default now()
);

create schema if not exists private;

create table public.contact_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  cart_session_id uuid,
  channel text not null,
  purpose text not null,
  granted boolean not null,
  source text not null,
  consent_text_version text,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Reproduz as permissões da tabela hospedada: leitura somente para autenticados,
-- sem inserção ou atualização direta; gravações passam pela função controlada.
revoke all on public.contact_consents from anon, authenticated;

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
grant update on public.profiles, public.preferences to authenticated;

create policy e2e_profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy e2e_profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy e2e_preferences_select_own on public.preferences
  for select to authenticated using ((select auth.uid()) = user_id);

create policy e2e_preferences_update_own on public.preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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

-- Reproduz o trigger de criação de usuário do projeto hospedado.
-- A função fica no schema private e só é invocada pelo trigger do Auth local.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text;
  v_full_name text;
  v_display_name text;
begin
  v_username := lower(nullif(btrim(v_metadata ->> 'username'), ''));
  if v_username is null or v_username !~ '^[a-z0-9][a-z0-9._]{2,29}$' then
    v_username := 'cliente_' || left(replace(new.id::text, '-', ''), 12);
  end if;

  v_full_name := nullif(btrim(coalesce(v_metadata ->> 'full_name', v_metadata ->> 'name')), '');
  v_display_name := left(coalesce(
    nullif(btrim(v_metadata ->> 'display_name'), ''),
    nullif(split_part(coalesce(v_full_name, ''), ' ', 1), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Cliente'
  ), 80);

  insert into public.profiles (id, username, display_name, full_name)
  values (new.id, v_username, v_display_name, v_full_name);

  insert into public.preferences (user_id) values (new.id);
  insert into public.user_permissions (user_id, role) values (new.id, 'customer');

  return new;
end;
$function$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
