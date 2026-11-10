-- Isolated one-real-payment test. Never references orders, inventory or fulfillment.
create table if not exists public.infinitepay_test_payments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  order_nsu uuid not null unique,
  amount_cents integer not null default 100 check (amount_cents = 100),
  status text not null default 'pending' check (status in ('pending','paid','review_required','failed')),
  checkout_url text,
  invoice_slug text,
  transaction_nsu text,
  paid_amount_cents bigint,
  capture_method text,
  receipt_url text,
  provider_verified boolean not null default false,
  webhook_received_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists infinitepay_test_one_pending_per_admin_uidx
  on public.infinitepay_test_payments(created_by) where status = 'pending';

create unique index if not exists infinitepay_test_transaction_nsu_uidx
  on public.infinitepay_test_payments(transaction_nsu)
  where transaction_nsu is not null;

alter table public.infinitepay_test_payments enable row level security;
revoke all on public.infinitepay_test_payments from public, anon, authenticated;
grant select, insert, update on public.infinitepay_test_payments to service_role;
comment on table public.infinitepay_test_payments is
  'Isolated R$1 InfinitePay integration test. Does not create or update sales orders, stock or fulfillment.';
