\set ON_ERROR_STOP on

-- Ephemeral PostgreSQL 17 schema used only by CI. No production data is loaded.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$$;

CREATE TABLE public.cart_sessions (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  converted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  cart_session_id uuid REFERENCES public.cart_sessions(id),
  payment_provider text,
  payment_status text NOT NULL CHECK (payment_status IN ('not_required','pending','paid','failed','cancelled','refunded','review_required')),
  status text NOT NULL CHECK (status IN ('awaiting_confirmation','confirmed','processing','out_for_delivery','delivered','cancelled')),
  payment_amount_cents bigint CHECK (payment_amount_cents IS NULL OR payment_amount_cents >= 0),
  payment_transaction_nsu text,
  payment_invoice_slug text,
  payment_receipt_url text,
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('pix','credit_card')),
  payment_paid_amount_cents bigint CHECK (payment_paid_amount_cents IS NULL OR payment_paid_amount_cents >= 0),
  payment_installments smallint CHECK (payment_installments IS NULL OR payment_installments BETWEEN 1 AND 12),
  payment_expires_at timestamptz,
  paid_at timestamptz,
  dispatch_sla_minutes integer,
  delivery_sla_minutes integer,
  dispatch_due_at timestamptz,
  delivery_due_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX orders_payment_transaction_nsu_uidx
  ON public.orders(payment_transaction_nsu)
  WHERE payment_transaction_nsu IS NOT NULL;

CREATE TABLE public.payment_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = 'infinitepay'),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL CHECK (event_type IN ('paid','refunded','canceled','payment_failed')),
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_nsu text NOT NULL,
  transaction_nsu text,
  invoice_slug text,
  amount_cents bigint CHECK (amount_cents IS NULL OR amount_cents >= 0),
  paid_amount_cents bigint CHECK (paid_amount_cents IS NULL OR paid_amount_cents >= 0),
  capture_method text CHECK (capture_method IS NULL OR capture_method IN ('pix','credit_card')),
  receipt_url text,
  verified boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_error text,
  email_notification_status text NOT NULL DEFAULT 'not_configured'
    CHECK (email_notification_status IN ('not_configured','pending','sent','failed')),
  email_notification_error text
);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.orders, public.cart_sessions, public.payment_provider_events TO service_role;

\ir ../../supabase/migrations/20261110120000_atomic_infinitepay_payment_confirmation.sql

INSERT INTO public.cart_sessions(id, status) VALUES
  ('10000000-0000-4000-8000-000000000001','checkout_reviewed'),
  ('10000000-0000-4000-8000-000000000002','checkout_reviewed'),
  ('10000000-0000-4000-8000-000000000003','checkout_reviewed'),
  ('10000000-0000-4000-8000-000000000004','checkout_reviewed'),
  ('10000000-0000-4000-8000-000000000005','checkout_reviewed');

INSERT INTO public.orders(
  id, cart_session_id, payment_provider, payment_status, status,
  payment_amount_cents, payment_expires_at, dispatch_sla_minutes, delivery_sla_minutes
) VALUES
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','infinitepay','pending','awaiting_confirmation',1000,now()+interval '1 hour',5,10),
  ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','infinitepay','pending','cancelled',1000,now()+interval '1 hour',5,10),
  ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','infinitepay','pending','awaiting_confirmation',1000,now()-interval '1 minute',5,10),
  ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','infinitepay','pending','awaiting_confirmation',1000,now()+interval '1 hour',5,10),
  ('00000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','infinitepay','pending','awaiting_confirmation',1000,now()+interval '1 hour',5,10);

-- All calls below run with the same role claim Supabase uses for the service_role API key.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',false);

DO $$
DECLARE
  r jsonb;
BEGIN
  -- Exact payment: one atomic state transition.
  r := public.confirm_infinitepay_payment(
    '00000000-0000-4000-8000-000000000001','tx-valid-1','slug-valid-1',
    1000,1000,'pix',null,1,now()+interval '5 minutes',now()+interval '15 minutes'
  );
  IF r->>'outcome' <> 'paid' OR r->>'newly_paid' <> 'true' THEN
    RAISE EXCEPTION 'Expected first payment outcome=paid, got %', r;
  END IF;

  -- Same provider transaction replayed: it must be idempotent.
  r := public.confirm_infinitepay_payment(
    '00000000-0000-4000-8000-000000000001','tx-valid-1','slug-valid-1',
    1000,1000,'pix',null,1,now()+interval '5 minutes',now()+interval '15 minutes'
  );
  IF r->>'outcome' <> 'duplicate' OR r->>'newly_paid' <> 'false' THEN
    RAISE EXCEPTION 'Expected duplicate outcome, got %', r;
  END IF;

  -- Already cancelled fulfillment must never be auto-released.
  r := public.confirm_infinitepay_payment(
    '00000000-0000-4000-8000-000000000002','tx-cancelled-2','slug-cancelled-2',
    1000,1000,'credit_card',null,1,now()+interval '5 minutes',now()+interval '15 minutes'
  );
  IF r->>'outcome' <> 'review_required' THEN
    RAISE EXCEPTION 'Expected cancelled order to require review, got %', r;
  END IF;

  -- Expired link must not automatically release fulfillment.
  r := public.confirm_infinitepay_payment(
    '00000000-0000-4000-8000-000000000003','tx-expired-3','slug-expired-3',
    1000,1000,'pix',null,1,now()+interval '5 minutes',now()+interval '15 minutes'
  );
  IF r->>'outcome' <> 'review_required' THEN
    RAISE EXCEPTION 'Expected expired order to require review, got %', r;
  END IF;

  -- Provider-confirmed amount mismatch must require manual review.
  r := public.confirm_infinitepay_payment(
    '00000000-0000-4000-8000-000000000004','tx-mismatch-4','slug-mismatch-4',
    900,900,'pix',null,1,now()+interval '5 minutes',now()+interval '15 minutes'
  );
  IF r->>'outcome' <> 'review_required' THEN
    RAISE EXCEPTION 'Expected mismatched amount to require review, got %', r;
  END IF;

  -- A transaction already attached to a different order must not pay twice.
  r := public.confirm_infinitepay_payment(
    '00000000-0000-4000-8000-000000000005','tx-valid-1','slug-duplicate-5',
    1000,1000,'pix',null,1,now()+interval '5 minutes',now()+interval '15 minutes'
  );
  IF r->>'outcome' <> 'review_required' THEN
    RAISE EXCEPTION 'Expected duplicate transaction across orders to require review, got %', r;
  END IF;
END
$$;

DO $$
DECLARE
  status_value text;
  event_verified boolean;
  converted_status text;
BEGIN
  SELECT payment_status INTO status_value FROM public.orders
  WHERE id = '00000000-0000-4000-8000-000000000001';
  IF status_value <> 'paid' THEN RAISE EXCEPTION 'Valid order was not marked paid: %', status_value; END IF;

  SELECT status INTO converted_status FROM public.cart_sessions
  WHERE id = '10000000-0000-4000-8000-000000000001';
  IF converted_status <> 'converted' THEN RAISE EXCEPTION 'Cart was not converted: %', converted_status; END IF;

  SELECT verified INTO event_verified FROM public.payment_provider_events
  WHERE event_key = 'paid:00000000-0000-4000-8000-000000000001:tx-valid-1';
  IF event_verified IS DISTINCT FROM true THEN RAISE EXCEPTION 'Payment event was not verified'; END IF;

  SELECT payment_status INTO status_value FROM public.orders
  WHERE id IN (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005'
  )
  ORDER BY id
  LIMIT 1;
  IF status_value <> 'review_required' THEN RAISE EXCEPTION 'A protected order did not enter review_required'; END IF;

  IF (SELECT count(*) FROM public.orders WHERE payment_status = 'review_required') <> 4 THEN
    RAISE EXCEPTION 'Expected exactly four orders in manual review';
  END IF;
END
$$;

RESET ROLE;

-- Confirm that public and authenticated clients cannot execute the settlement RPC.
DO $$
BEGIN
  IF has_function_privilege('anon',
    'public.confirm_infinitepay_payment(uuid,text,text,bigint,bigint,text,text,integer,timestamptz,timestamptz)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly has execute privilege';
  END IF;
  IF has_function_privilege('authenticated',
    'public.confirm_infinitepay_payment(uuid,text,text,bigint,bigint,text,text,integer,timestamptz,timestamptz)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has execute privilege';
  END IF;
END
$$;

-- Even the service_role grant is insufficient if the JWT role claim is wrong.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.confirm_infinitepay_payment(
      '00000000-0000-4000-8000-000000000001','tx-valid-1','slug-valid-1',
      1000,1000,'pix',null,1,now()+interval '5 minutes',now()+interval '15 minutes'
    );
    RAISE EXCEPTION 'Incorrect JWT role claim was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$$;
RESET ROLE;

\echo 'PostgreSQL 17: atomic settlement, idempotency, delayed/cancelled/mismatched/duplicate transaction protection, cart conversion and execution privileges passed.'
