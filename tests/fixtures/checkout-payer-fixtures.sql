-- Schema mínimo e descartável para testar create-payment-order com persistência real.
-- Só é copiado para o Supabase local do CI; nunca é aplicado ao projeto hospedado.

create table public.cart_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  items_snapshot jsonb not null default '[]'::jsonb,
  item_count integer not null default 0,
  subtotal numeric(12,2) not null default 0,
  customer_name text,
  customer_phone text,
  city text,
  state char(2),
  last_activity_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column cart_session_id uuid references public.cart_sessions(id) on delete set null,
  add column source text,
  add column customer_name text,
  add column customer_phone text,
  add column delivery_address jsonb,
  add column club_discount_amount_cents integer not null default 0,
  add column club_discount_percent integer not null default 0,
  add column club_discount_rule_version text,
  add column payment_status text,
  add column payment_provider text,
  add column payment_checkout_payload_version integer,
  add column payment_customer_phone_hash text,
  add column payment_customer_email_hash text,
  add column payment_order_nsu text,
  add column payment_amount_cents integer,
  add column payment_checkout_url text,
  add column payment_invoice_slug text,
  add column payment_expires_at timestamptz,
  add column dispatch_sla_minutes integer,
  add column delivery_sla_minutes integer,
  add column fulfillment_type text not null default 'express',
  add column pickup_requested_at timestamptz,
  add column picked_up_at timestamptz,
  add column scheduled_delivery_date date,
  add column scheduled_window_start time,
  add column scheduled_window_end time,
  add column delivery_origin_cep text,
  add column delivery_distance_km numeric(10,2),
  add column delivery_base_fee_cents integer,
  add column delivery_toll_amount_cents integer,
  add column scheduled_discount_amount numeric(12,2),
  add column updated_at timestamptz not null default now();

alter table public.orders
  alter column order_number set default
    ('E2E-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

alter table public.orders
  add constraint orders_fulfillment_type_check
    check (fulfillment_type in ('express', 'scheduled', 'pickup')),
  add constraint orders_scheduled_delivery_fields_check
    check (
      (fulfillment_type = 'express' and scheduled_delivery_date is null
        and scheduled_window_start is null and scheduled_window_end is null
        and pickup_requested_at is null)
      or
      (fulfillment_type = 'scheduled' and scheduled_delivery_date is not null
        and scheduled_window_start is not null and scheduled_window_end is not null
        and scheduled_window_end > scheduled_window_start and pickup_requested_at is null)
      or
      (fulfillment_type = 'pickup' and scheduled_delivery_date is null
        and scheduled_window_start is null and scheduled_window_end is null
        and pickup_requested_at is not null)
    ),
  add constraint orders_pickup_lifecycle_check
    check (picked_up_at is null or fulfillment_type = 'pickup');

alter table public.order_items
  add column product_id text,
  add column sku text,
  add column unit_price numeric(12,2),
  add column product_snapshot jsonb not null default '{}'::jsonb;

create table public.club_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  terms_version text not null default 'luxuriosa-club-terms-v1-2026-11',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.management_inventory (
  product_id text primary key,
  product_name text not null,
  quantity_on_hand integer not null default 0,
  stock_control_enabled boolean not null default false
);

alter table public.fulfillment_sla_rules
  add column scheduled_max_advance_hours integer not null default 720;

update public.fulfillment_sla_rules
set minimum_order_up_to_12km_cents = 0,
    minimum_order_up_to_55km_cents = 0,
    scheduled_max_advance_hours = 720
where city_normalized = 'bauru'
  and state = 'SP'
  and fulfillment_mode = 'delivery';
