const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("login.html", "utf8");
const script = [...html.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)]
  .map(match => match[1])
  .find(source => source.length > 1000);

assert.ok(script, "Script principal da conta deve existir.");
assert.match(html, /id="clubSavingsSummary"/);
assert.match(script, /const discountedOrders = \\(orders \\|\\| \\[\\]\\)\\.filter/);
assert.match(script, /club_discount_amount_cents/);
assert.match(script, /savingsCents \\/ 100/);
assert.match(script, /Economia registrada nos últimos /);
assert.match(script, /Sua economia com o Clube aparecerá aqui depois da primeira compra elegível/);

console.log("Histórico do Clube: economia acumulada calculada em centavos e apresentada com escopo dos últimos pedidos exibidos.");
