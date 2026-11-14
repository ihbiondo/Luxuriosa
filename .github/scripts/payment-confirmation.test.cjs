const fs = require("node:fs");
const assert = require("node:assert/strict");

const shared = fs.readFileSync("supabase/functions/_shared/infinitepay-payment.ts", "utf8");
const webhook = fs.readFileSync("supabase/functions/infinitepay-webhook/index.ts", "utf8");
const status = fs.readFileSync("supabase/functions/payment-status/index.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261110120000_atomic_infinitepay_payment_confirmation.sql", "utf8");
const page = fs.readFileSync("pagamento-retorno.html", "utf8");
const createOrder = fs.readFileSync("supabase/functions/create-payment-order/index.ts", "utf8");
const testCheckout = fs.readFileSync("supabase/functions/infinitepay-test-checkout/index.ts", "utf8");
const config = fs.readFileSync("supabase/config.toml", "utf8");
const rateLimitMigration = fs.readFileSync("supabase/migrations/20261114110000_distributed_edge_rate_limit.sql", "utf8");
const rateLimitExtension = fs.readFileSync("supabase/migrations/20261114113000_extend_distributed_rate_limit_scopes.sql", "utf8");
assert.match(rateLimitMigration, /create table if not exists private\.edge_rate_limits/i);
assert.match(rateLimitMigration, /security definer/i);
assert.match(rateLimitMigration, /grant execute on function[\s\S]*to service_role/i);
assert.match(rateLimitExtension, /payment_status_user/);
assert.match(rateLimitExtension, /test_webhook_order/);


assert.match(shared, /api\.checkout\.infinitepay\.io\/payment_check/);
assert.match(shared, /X-Api-Key/);
assert.match(shared, /confirm_infinitepay_payment/);
assert.match(shared, /AbortController/);
assert.match(webhook, /verifyAndSettlePayment/);
// Payment status is deliberately a read-only, owner-scoped endpoint.
// Payment confirmation and operational synchronization happen only in trusted backend flows.
assert.match(status, /admin\.auth\.getUser\(token\)/);
assert.match(status, /\.eq\("customer_id", authData\.user\.id\)/);
assert.match(status, /consume_edge_rate_limit/);
assert.doesNotMatch(status, /\.rpc\(/);
assert.match(status, /management_sales_sync_status/);
assert.match(page, /getAccessToken\(\)/);
assert.match(page, /"authorization":"Bearer "\+accessToken/);
assert.match(page, /body:JSON\.stringify\(\{order_nsu:orderNsu\}\)/);
assert.doesNotMatch(page, /payment_status\s*:\s*["']paid["']/);
assert.match(migration, /for update/i);
assert.match(migration, /request\.jwt\.claim\.role/);
assert.match(migration, /payment_expires_at is not null/i);
assert.match(migration, /v_order\.status <> 'awaiting_confirmation'/);
assert.match(migration, /update public\.cart_sessions/i);
assert.match(migration, /update public\.payment_provider_events/i);
assert.match(migration, /revoke all on function/i);
assert.match(migration, /grant execute on function[\s\S]*to service_role/i);
assert.match(testCheckout, /access-control-allow-headers[^\n]*x-client-info/i);
assert.match(testCheckout, /req\.method\s*===\s*"OPTIONS"/);
assert.match(testCheckout, /access-control-allow-origin/);
assert.match(createOrder, /checkout\.infinitepay\.io\/links/);
assert.match(createOrder, /webhook:\s*\{\s*url:\s*WEBHOOK_URL/);
assert.match(createOrder, /events:\s*\["created",\s*"paid",\s*"settled",\s*"refunded",\s*"canceled",\s*"payment_failed"\]/);
assert.match(webhook, /eventName === "created"/);
assert.match(webhook, /eventType === "created"/);
assert.match(config, /\[functions\.infinitepay-webhook\]\s*verify_jwt\s*=\s*false/);
assert.doesNotMatch(createOrder, /webhook_url\s*:/);
assert.match(createOrder, /PAYMENT_CHECKOUT_PAYLOAD_VERSION\s*=\s*5/);
console.log("Checkout InfinitePay: retorno, payment_check, webhook no formato oficial, RPC atômica e proteção de estado verificados.");
