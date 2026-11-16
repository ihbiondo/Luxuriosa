begin;

select plan(8);

select is(
  (select delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'bauru'),
  2000::bigint,
  'Tarifa-base de Bauru é R$ 20'
);
select is(
  (select delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'agudos'),
  3000::bigint,
  'Tarifa-base regional é R$ 30'
);
select is(
  (select express_fee_up_to_12km_cents from public.fulfillment_sla_rules where city_normalized = 'bauru'),
  2000,
  'Sem Clube em Bauru é R$ 20'
);
select is(
  (select express_fee_up_to_35km_cents from public.fulfillment_sla_rules where city_normalized = 'bauru'),
  3000,
  'Sem Clube até 30 km é R$ 30'
);
select is(
  (select express_fee_up_to_55km_cents from public.fulfillment_sla_rules where city_normalized = 'bauru'),
  4500,
  'Sem Clube até 55 km é R$ 45'
);
select is(
  (select club_express_fee_up_to_12km_cents from public.fulfillment_sla_rules where city_normalized = 'bauru'),
  1000,
  'Clube gratuito em Bauru é R$ 10'
);
select is(
  (select club_express_fee_up_to_35km_cents from public.fulfillment_sla_rules where city_normalized = 'bauru'),
  2000,
  'Clube gratuito até 30 km é R$ 20'
);
select is(
  (select club_express_fee_up_to_55km_cents from public.fulfillment_sla_rules where city_normalized = 'bauru'),
  3000,
  'Clube gratuito até 55 km é R$ 30'
);


select * from finish();
rollback;
