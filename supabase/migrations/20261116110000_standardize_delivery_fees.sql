begin;

alter table public.fulfillment_sla_rules
  add column if not exists club_delivery_fee_cents integer not null default 0
    check (club_delivery_fee_cents >= 0 and club_delivery_fee_cents <= 1000000);

comment on column public.fulfillment_sla_rules.club_delivery_fee_cents is
  'Frete fixo em centavos para membros do Clube gratuito, conforme localidade.';

update public.fulfillment_sla_rules
set delivery_fee_cents = case city_normalized
      when 'bauru' then 1500
      when 'agudos' then 2500
      when 'pederneiras' then 2500
      when 'piratininga' then 2500
      when 'lencois paulista' then 5000
      else delivery_fee_cents
    end,
    club_delivery_fee_cents = case city_normalized
      when 'bauru' then 1000
      when 'agudos' then 2000
      when 'pederneiras' then 2000
      when 'piratininga' then 2000
      when 'lencois paulista' then 4000
      else club_delivery_fee_cents
    end,
    updated_at = now()
where active = true
  and fulfillment_mode = 'delivery'
  and city_normalized in ('bauru', 'agudos', 'pederneiras', 'piratininga', 'lencois paulista');

-- Borebi tem tarifa fixa oficial, mas o pagamento automático permanece desativado
-- até que os prazos operacionais desse destino sejam definidos.
insert into public.fulfillment_sla_rules (
  city_normalized, state, fulfillment_mode, dispatch_minutes, delivery_minutes,
  automatic_payment_enabled, active, delivery_fee_cents, club_delivery_fee_cents,
  freight_origin_cep, scheduled_delivery_enabled
)
select 'borebi', 'SP', 'delivery', 0, 0, false, true, 5000, 4000,
       '17030290', false
where not exists (
  select 1
  from public.fulfillment_sla_rules
  where city_normalized = 'borebi'
    and state = 'SP'
    and fulfillment_mode = 'delivery'
);

update public.fulfillment_sla_rules
set delivery_fee_cents = 5000,
    club_delivery_fee_cents = 4000,
    updated_at = now()
where city_normalized = 'borebi'
  and state = 'SP'
  and fulfillment_mode = 'delivery'
  and active = true;

commit;
