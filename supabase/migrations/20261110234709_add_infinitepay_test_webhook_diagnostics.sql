alter table public.infinitepay_test_payments
  add column if not exists last_webhook_attempt_at timestamptz,
  add column if not exists last_webhook_event text,
  add column if not exists last_payment_check_http_status integer,
  add column if not exists last_payment_check_provider_code text,
  add column if not exists last_webhook_error text;

comment on column public.infinitepay_test_payments.last_webhook_error is
  'Diagnostic text for isolated test webhook only; never treat as payment confirmation.';
