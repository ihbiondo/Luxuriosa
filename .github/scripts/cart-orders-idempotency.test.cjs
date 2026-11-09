const fs = require("node:fs");
const assert = require("node:assert/strict");
const source = fs.readFileSync("supabase/functions/cart-orders/index.ts", "utf8");

assert.match(
  source,
  /\.from\("order_items"\)[\s\S]{0,300}\.select\("product_id, product_name, sku, quantity, unit_price"\)/,
  "A comparação de idempotência precisa buscar todos os campos usados na normalização."
);
assert.match(source, /product_name:\s*item\.product_name\s*\|\|\s*""/);
assert.match(source, /sku:\s*item\.sku\s*\|\|\s*null/);
console.log("Idempotência do pedido: campos comparados e selecionados.");
