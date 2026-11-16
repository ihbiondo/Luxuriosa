begin;

alter table public.fulfillment_sla_rules
  add column if not exists club_express_fee_up_to_12km_cents integer not null default 1000 check (club_express_fee_up_to_12km_cents >= 0),
  add column if not exists club_express_fee_up_to_35km_cents integer not null default 2000 check (club_express_fee_up_to_35km_cents >= 0),
  add column if not exists club_express_fee_up_to_55km_cents integer not null default 3000 check (club_express_fee_up_to_55km_cents >= 0),
  add column if not exists club_scheduled_fee_up_to_12km_cents integer not null default 1000 check (club_scheduled_fee_up_to_12km_cents >= 0),
  add column if not exists club_scheduled_fee_up_to_35km_cents integer not null default 2000 check (club_scheduled_fee_up_to_35km_cents >= 0),
  add column if not exists club_scheduled_fee_up_to_55km_cents integer not null default 3000 check (club_scheduled_fee_up_to_55km_cents >= 0),
  add column if not exists motorcycle_fuel_price_cents_per_liter integer not null default 619 check (motorcycle_fuel_price_cents_per_liter >= 0),
  add column if not exists motorcycle_km_per_liter numeric(6,2) not null default 20 check (motorcycle_km_per_liter > 0),
  add column if not exists motorcycle_operational_cost_cents_per_km integer not null default 55 check (motorcycle_operational_cost_cents_per_km >= 0),
  add column if not exists minimum_delivery_cost_cents integer not null default 800 check (minimum_delivery_cost_cents >= 0),
  add column if not exists supporter_share_percent smallint not null default 50 check (supporter_share_percent between 0 and 100);

update public.fulfillment_sla_rules
set delivery_fee_cents = case when city_normalized = 'bauru' then 2000 else 3000 end,
    express_fee_up_to_12km_cents = 2000,
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
    motorcycle_fuel_price_cents_per_liter = 619,
    motorcycle_km_per_liter = 20,
    motorcycle_operational_cost_cents_per_km = 55,
    minimum_delivery_cost_cents = 800,
    supporter_share_percent = 50,
    updated_at = now()
where active = true and fulfillment_mode = 'delivery';

comment on column public.fulfillment_sla_rules.minimum_delivery_cost_cents is
  'Custo operacional mínimo de uma entrega completa de ida e volta, antes da divisão do subsídio Apoiador.';
comment on column public.fulfillment_sla_rules.supporter_share_percent is
  'Percentual do custo operacional calculado pela rota cobrado do membro Apoiador.';

commit;
