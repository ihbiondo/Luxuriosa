-- Distributed fixed-window rate limiter for public Edge Function endpoints.
-- Only a SHA-256 identifier is stored; raw client IPs/session identifiers are never persisted.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.edge_rate_limits (
  bucket_key text PRIMARY KEY,
  request_count integer NOT NULL CHECK (request_count > 0),
  expires_at timestamptz NOT NULL
);

REVOKE ALL ON TABLE private.edge_rate_limits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window bigint;
  v_bucket_key text;
  v_allowed boolean := false;
BEGIN
  IF p_scope IS NULL
     OR p_scope NOT IN ('cart_ip', 'cart_session', 'checkout_ip', 'checkout_user', 'payment_status_user')
     OR p_key_hash IS NULL
     OR p_key_hash !~ '^[0-9a-f]{64}$'
     OR p_window_seconds IS NULL
     OR p_window_seconds < 1
     OR p_window_seconds > 86400
     OR p_limit IS NULL
     OR p_limit < 1
     OR p_limit > 10000 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  v_window := floor(extract(epoch FROM v_now) / p_window_seconds)::bigint;
  v_bucket_key := p_scope || ':' || p_window_seconds::text || ':' || v_window::text || ':' || p_key_hash;

  INSERT INTO private.edge_rate_limits (bucket_key, request_count, expires_at)
  VALUES (v_bucket_key, 1, v_now + make_interval(secs => p_window_seconds * 2))
  ON CONFLICT (bucket_key) DO UPDATE
    SET request_count = private.edge_rate_limits.request_count + 1
    WHERE private.edge_rate_limits.request_count < p_limit
  RETURNING true INTO v_allowed;

  -- Opportunistic cleanup keeps the table bounded without requiring pg_cron.
  IF random() < 0.01 THEN
    DELETE FROM private.edge_rate_limits WHERE expires_at < v_now;
  END IF;

  RETURN COALESCE(v_allowed, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.consume_edge_rate_limit(text, text, integer, integer)
IS 'Atomic distributed fixed-window rate limiter. Accepts only SHA-256 identifiers and is executable only by service_role.';
