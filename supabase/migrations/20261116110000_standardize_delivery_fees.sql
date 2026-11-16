begin;

alter table public.fulfillment_sla_rules
  add column if not exists club_express_fee_up_to_12km_cents integer not null default 1000 check (club_express_fee_up_to_12km_cents >= 0),
  add column if not exists club_express_fee_up_to_35km_cents integer not null default 2000 check (club_express_fee_up_to_35km_cents >= 0),
  add column if not exists club_express_fee_up_to_55km_cents integer not null default 3000 check (club_express_fee_up_to_55km_cents >= 0),
  add column if not exists club_scheduled_fee_up_to_12km_cents integer not null default 1000 check (club_scheduled_fee_up_to_12km_cents >= 0),
  add column if not exists club_scheduled_fee_up_to_35km_cents integer not null default 2000 check (club_scheduled_fee_up_to_35km_cents >= 0),
  add column if not exists club_scheduled_fee_up_to_55km_cents integer not null default 3000 check (club_scheduled_fee_up_to_55km_cents >= 0);

update public.fulfillment_sla_rules
set express_fee_up_to_12km_cents = 2000,
    express_fee_up_to_35km_cents = 3000,
    express_fee_up_to_55km_cents = 4500,
    scheduled_fee_up_to_12km_cents = 2000,
    scheduled_fee_up_to_35km_cents = 3000,
    scheduled_fee_up_to_55km_cents = 4500,
    club_express_fee_up_to_12km_cents = 1000,
    club_express_fee_up_to_35km_cents = 2000,
    club_express_fee_up_to_55km_cents = 3000,
    club_scheduled_fee_up_to_12km_cents = 1000,
    club_scheduled_fee_up_to_35km_cents = 2000,
    club_scheduled_fee_up_to_55km_cents = 3000,
    updated_at = now()
where active = true and fulfillment_mode = 'delivery';

create table if not exists public.delivery_pricing_settings (
  id boolean primary key default true check (id = true),
  fuel_price_cents_per_liter integer not null check (fuel_price_cents_per_liter >= 0),
  motorcycle_km_per_liter numeric(6,2) not null check (motorcycle_km_per_liter > 0),
  operational_cost_cents_per_km integer not null check (operational_cost_cents_per_km >= 0),
  minimum_delivery_cost_cents integer not null check (minimum_delivery_cost_cents >= 0),
  supporter_share_percent smallint not null check (supporter_share_percent between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table public.delivery_pricing_settings enable row level security;
revoke all on public.delivery_pricing_settings from anon, authenticated;
grant select on public.delivery_pricing_settings to service_role;

insert into public.delivery_pricing_settings (
  id, fuel_price_cents_per_liter, motorcycle_km_per_liter,
  operational_cost_cents_per_km, minimum_delivery_cost_cents, supporter_share_percent
) values (true, 619, 20, 55, 800, 50)
on conflict (id) do update set
  fuel_price_cents_per_liter = excluded.fuel_price_cents_per_liter,
  motorcycle_km_per_liter = excluded.motorcycle_km_per_liter,
  operational_cost_cents_per_km = excluded.operational_cost_cents_per_km,
  minimum_delivery_cost_cents = excluded.minimum_delivery_cost_cents,
  supporter_share_percent = excluded.supporter_share_percent,
  updated_at = now();

comment on table public.delivery_pricing_settings is
  'Parâmetros internos usados para calcular o custo operacional de entrega e o subsídio do Clube Apoiador.';
comment on column public.delivery_pricing_settings.minimum_delivery_cost_cents is
  'Custo operacional mínimo de uma entrega completa de ida e volta, antes da divisão do subsídio.';
comment on column public.delivery_pricing_settings.supporter_share_percent is
  'Percentual do custo operacional real cobrado do membro Apoiador.';

commit;
