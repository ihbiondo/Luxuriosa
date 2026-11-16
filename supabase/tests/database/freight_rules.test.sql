begin;

select plan(13);

select is((select delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'bauru'), 1500::bigint, 'Bauru sem Clube custa R$ 15');
select is((select club_delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'bauru'), 1000, 'Bauru com Clube custa R$ 10');

select is((select delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'agudos'), 2500::bigint, 'Agudos sem Clube custa R$ 25');
select is((select club_delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'agudos'), 2000, 'Agudos com Clube custa R$ 20');

select is((select delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'pederneiras'), 2500::bigint, 'Pederneiras sem Clube custa R$ 25');
select is((select club_delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'pederneiras'), 2000, 'Pederneiras com Clube custa R$ 20');

select is((select delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'piratininga'), 2500::bigint, 'Piratininga sem Clube custa R$ 25');
select is((select club_delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'piratininga'), 2000, 'Piratininga com Clube custa R$ 20');

select is((select delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'lencois paulista'), 5000::bigint, 'Lençóis Paulista sem Clube custa R$ 50');
select is((select club_delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'lencois paulista'), 4000, 'Lençóis Paulista com Clube custa R$ 40');

select is((select delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'borebi'), 5000::bigint, 'Borebi sem Clube custa R$ 50');
select is((select club_delivery_fee_cents from public.fulfillment_sla_rules where city_normalized = 'borebi'), 4000, 'Borebi com Clube custa R$ 40');
select is((select automatic_payment_enabled from public.fulfillment_sla_rules where city_normalized = 'borebi'), false, 'Pagamento automático de Borebi permanece desativado até configurar os prazos');

select * from finish();
rollback;
