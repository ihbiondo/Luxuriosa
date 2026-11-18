begin;
alter table public.orders
  add column if not exists payment_payer_type text not null default 'unknown',
  add column if not exists payment_payer_name text,
  add column if not exists payment_payer_phone text,
  add column if not exists payment_payer_source text not null default 'unknown',
  add column if not exists payment_payer_declared_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_payment_payer_type_check') then
    alter table public.orders add constraint orders_payment_payer_type_check
      check (payment_payer_type in ('unknown','account_holder','third_party'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_payment_payer_source_check') then
    alter table public.orders add constraint orders_payment_payer_source_check
      check (payment_payer_source in ('unknown','website_checkout','whatsapp_checkout','admin'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_third_party_payer_data_check') then
    alter table public.orders add constraint orders_third_party_payer_data_check
      check (payment_payer_type <> 'third_party' or (
        nullif(btrim(payment_payer_name),'') is not null
        and payment_payer_phone ~ '^\+55[1-9][0-9]{9,10}$'
      ));
  end if;
end;
$$;

comment on column public.orders.payment_payer_type is
  'Pessoa indicada como responsável pelo pagamento; unknown para registros sem declaração.';
comment on column public.orders.payment_payer_name is
  'Nome declarado do pagador terceiro, separado do cliente e do destinatário.';
comment on column public.orders.payment_payer_phone is
  'Telefone brasileiro E.164 declarado para o pagador terceiro.';
comment on column public.orders.payment_payer_source is
  'Origem da declaração do pagador; não representa verificação pelo provedor.';
comment on column public.orders.payment_payer_declared_at is
  'Data/hora em que a declaração do pagador foi informada no pedido.';
commit;
