create table public.fulfillment_sla_rules (
  id uuid primary key default gen_random_uuid(),
  city_normalized text not null,
  state char(2) not null,
  fulfillment_mode text not null default 'delivery',
  dispatch_minutes integer not null default 0,
  delivery_minutes integer not null default 0,
  automatic_payment_enabled boolean not null default false,
  active boolean not null default true,
  delivery_fee_cents bigint not null default 0,
  free_delivery_if_contains_kit boolean not null default false,
  freight_origin_cep text,
  scheduled_delivery_enabled boolean not null default false,
  express_fee_up_to_12km_cents integer not null default 0,
  express_fee_up_to_35km_cents integer not null default 0,
  express_fee_up_to_55km_cents integer not null default 0,
  scheduled_fee_up_to_12km_cents integer not null default 0,
  scheduled_fee_up_to_35km_cents integer not null default 0,
  scheduled_fee_up_to_55km_cents integer not null default 0,
  minimum_order_up_to_12km_cents integer,
  minimum_order_up_to_35km_cents integer,
  minimum_order_up_to_55km_cents integer,
  updated_at timestamptz not null default now()
);

insert into public.fulfillment_sla_rules (city_normalized, state, fulfillment_mode, dispatch_minutes, delivery_minutes, automatic_payment_enabled, active, delivery_fee_cents)
values
  ('bauru', 'SP', 'delivery', 10, 20, true, true, 1500),
  ('agudos', 'SP', 'delivery', 30, 90, true, true, 1500),
  ('pederneiras', 'SP', 'delivery', 30, 90, true, true, 1500),
  ('piratininga', 'SP', 'delivery', 30, 90, true, true, 1500),
  ('lencois paulista', 'SP', 'delivery', 30, 90, true, true, 1500);
