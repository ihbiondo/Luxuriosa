const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync(
  "supabase/functions/create-payment-order/index.ts",
  "utf8"
);

assert.match(source, /pendingDiscountCents\s*===\s*clubDiscountCents/);
assert.match(source, /pendingDiscountPercent\s*===\s*expectedDiscountPercent/);
assert.match(source, /pendingShippingCents\s*===\s*shippingCents/);
assert.match(
  source,
  /payment_amount_cents\)\s*===\s*totalCents\s*&&\s*samePaymentBreakdown[\s\S]{0,260}sameCheckoutContact/
);

console.log("Checkout InfinitePay: reutilização exige desconto e frete idênticos.");
