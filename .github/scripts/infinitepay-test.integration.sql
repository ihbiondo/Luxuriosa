\set ON_ERROR_STOP on
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users(id uuid primary key);
INSERT INTO auth.users(id) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT SELECT ON auth.users TO service_role;
\ir ../../supabase/migrations/20261110153000_isolated_infinitepay_test_payments.sql

DO $$
BEGIN
 IF has_table_privilege('anon','public.infinitepay_test_payments','SELECT') THEN
  RAISE EXCEPTION 'anon can read test payment table';
 END IF;
 IF has_table_privilege('authenticated','public.infinitepay_test_payments','SELECT') THEN
  RAISE EXCEPTION 'authenticated can read test payment table';
 END IF;
 IF NOT has_table_privilege('service_role','public.infinitepay_test_payments','INSERT') THEN
  RAISE EXCEPTION 'service_role cannot create test payment';
 END IF;
END $$;

SET ROLE service_role;
INSERT INTO public.infinitepay_test_payments(created_by,order_nsu,amount_cents)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',100);
DO $$
BEGIN
 BEGIN
  INSERT INTO public.infinitepay_test_payments(created_by,order_nsu,amount_cents)
  VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',200);
  RAISE EXCEPTION 'A test payment with amount other than R$1 was accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
UPDATE public.infinitepay_test_payments
SET status='paid',provider_verified=true,transaction_nsu='test-txn-1',paid_amount_cents=100,paid_at=now()
WHERE order_nsu='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
RESET ROLE;

DO $$
BEGIN
 IF (SELECT count(*) FROM public.infinitepay_test_payments WHERE status='paid' AND provider_verified) <> 1 THEN
  RAISE EXCEPTION 'Isolated test payment confirmation was not persisted';
 END IF;
 IF to_regclass('public.orders') IS NOT NULL THEN
  RAISE EXCEPTION 'This isolated CI fixture unexpectedly includes commercial orders';
 END IF;
END $$;
\echo 'Isolated R$1 test table: amount lock, admin-only data access and no commercial orders passed.'
