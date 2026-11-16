create table public.fulfillment_sla_rules (
  id uuid primary key default gen_random_uuid(),
  city_normalized text not null,
  state char(2) not null,
  fulfillment_mode text not null default 'delivery',
  active boolean not null default true,
  delivery_fee_cents bigint not null default 0,
  express_fee_up_to_12km_cents integer,
  express_fee_up_to_35km_cents integer,
  express_fee_up_to_55km_cents integer,
  scheduled_fee_up_to_12km_cents integer,
  scheduled_fee_up_to_35km_cents integer,
  scheduled_fee_up_to_55km_cents integer,
  minimum_order_up_to_12km_cents integer,
  minimum_order_up_to_35km_cents integer,
  minimum_order_up_to_55km_cents integer,
  updated_at timestamptz not null default now()
);

insert into public.fulfillment_sla_rules (city_normalized, state, fulfillment_mode, active)
values
  ('bauru', 'SP', 'delivery', true),
  ('agudos', 'SP', 'delivery', true),
  ('pederneiras', 'SP', 'delivery', true),
  ('piratininga', 'SP', 'delivery', true),
  ('lencois paulista', 'SP', 'delivery', true);
