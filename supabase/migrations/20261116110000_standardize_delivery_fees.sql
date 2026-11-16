begin;

alter table public.fulfillment_sla_rules
  add column if not exists club_express_fee_up_to_12km_cents integer not null default 1000 check (club_express_fee_up_to_12km_cents >= 0),
  add column if not exists club_express_fee_up_to_35km_cents integer not null default 2000 check (club_express_fee_up_to_35km_cents >= 0),
  add column if not exists club_express_fee_up_to_55km_cents integer not null default 3000 check (club_express_fee_up_to_55km_cents >= 0),
  add column if not exists club_scheduled_fee_up_to_12km_cents integer not null default 1000 check (club_scheduled_fee_up_to_12km_cents >= 0),
  add column if not exists club_scheduled_fee_up_to_35km_cents integer not null default 2000 check (club_scheduled_fee_up_to_35km_cents >= 0),
  add column if not exists club_scheduled_fee_up_to_55km_cents integer not null default 3000 check (club_scheduled_fee_up_to_55km_cents >= 0);

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
    updated_at = now()
where active = true and fulfillment_mode = 'delivery';


commit;
