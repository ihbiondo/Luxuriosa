-- Luxuriosa Central: estrutura inicial de contas e perfis.
-- Senhas, e-mails de autenticação e sessões permanecem no Supabase Auth.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  full_name text,
  phone text,
  birth_date date,
  created_at timestamptz not null default now(),
  constraint profiles_username_format
    check (username = lower(username) and username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_display_name_length
    check (char_length(trim(display_name)) between 1 and 80),
  constraint profiles_full_name_length
    check (full_name is null or char_length(full_name) <= 160),
  constraint profiles_phone_length
    check (phone is null or char_length(phone) <= 30)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  recipient_name text,
  postal_code text not null,
  street text not null,
  number text not null,
  complement text,
  neighborhood text,
  city text not null,
  state char(2) not null,
  country text not null default 'Brasil',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint addresses_state_format check (state ~ '^[A-Z]{2}$'),
  constraint addresses_postal_code_length check (char_length(postal_code) between 5 and 12)
);

create index addresses_user_id_idx on public.addresses(user_id);
create unique index addresses_one_default_per_user
  on public.addresses(user_id) where is_default = true;

create table public.preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  favorite_colors text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint preferences_max_three_colors check (cardinality(favorite_colors) <= 3)
);

create table public.user_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  constraint user_permissions_role_check check (role in ('customer', 'admin'))
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(trim(new.raw_user_meta_data ->> 'username')),
    trim(new.raw_user_meta_data ->> 'display_name')
  );

  insert into public.preferences (user_id) values (new.id);
  insert into public.user_permissions (user_id, role) values (new.id, 'customer');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.preferences enable row level security;
alter table public.user_permissions enable row level security;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "addresses_select_own"
  on public.addresses for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "addresses_insert_own"
  on public.addresses for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "addresses_update_own"
  on public.addresses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "addresses_delete_own"
  on public.addresses for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "preferences_select_own"
  on public.preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "preferences_update_own"
  on public.preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_permissions_select_own"
  on public.user_permissions for select to authenticated
  using ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, update on public.preferences to authenticated;
grant select on public.user_permissions to authenticated;
