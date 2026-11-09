const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("supabase/functions/cart-orders/index.ts", "utf8");
const previousOrderStart = source.indexOf("if (previousOrder) {");
assert.notEqual(previousOrderStart, -1, "O fluxo de idempotência precisa localizar o pedido anterior.");

const previousOrderBlock = source.slice(previousOrderStart, previousOrderStart + 5000);
assert.ok(
  previousOrderBlock.includes('admin.from("order_items")'),
  "A idempotência precisa comparar os itens do pedido anterior."
);
assert.ok(
  previousOrderBlock.includes('.select("product_id, product_name, sku, quantity, unit_price")'),
  "A consulta precisa carregar todos os campos usados na comparação."
);
assert.ok(
  previousOrderBlock.includes('product_name: item.product_name || ""'),
  "O nome do produto precisa ser normalizado."
);
assert.ok(
  previousOrderBlock.includes("sku: item.sku || null"),
  "O SKU precisa ser normalizado."
);
assert.ok(
  previousOrderBlock.includes("JSON.stringify(normalizeItems(previousItems || []))") &&
  previousOrderBlock.includes("JSON.stringify(normalizeItems(items))"),
  "A comparação precisa considerar todos os itens normalizados."
);

console.log("Idempotência do pedido: consulta, normalização e comparação verificadas.");
