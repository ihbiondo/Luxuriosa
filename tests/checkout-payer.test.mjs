import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkoutPages = ["index.html", "loja.html"].map((path) => ({ path, html: readFileSync(path, "utf8") }));
const client = readFileSync("js/clientes.js", "utf8");
const backend = readFileSync("supabase/functions/create-payment-order/index.ts", "utf8");

test("checkout apresenta a escolha do responsável pelo pagamento", () => {
  for (const { path, html } of checkoutPages) {
    assert.match(html, /id="customerPayerType"[\s\S]*?value="account_holder"/, path);
    assert.match(html, /value="third_party"/, path);
    assert.match(html, /id="customerPayerName"/, path);
    assert.match(html, /id="customerPayerPhone"/, path);
    assert.match(html, /id="customerMarketingWhatsAppOptIn"/, path);
  }
  const customerIds = (html) => [...html.matchAll(/\bid="(customer[^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(customerIds(checkoutPages[0].html), customerIds(checkoutPages[1].html), "A home e a loja devem manter os mesmos controles de checkout.");
});

test("frontend valida, preserva e envia os dados do pagador dentro de customer", () => {
  assert.match(client, /paymentPayerType:\s*texto\("customerPayerType"\)/);
  assert.match(client, /paymentPayerName:\s*texto\("customerPayerName"\)/);
  assert.match(client, /paymentPayerPhone:\s*texto\("customerPayerPhone"\)/);
  assert.match(client, /customer:\s*dadosAtuais/);
  assert.match(client, /supabase\.auth\.getSession\(\)/);
  assert.match(client, /headers\.authorization = "Bearer " \+ accessToken/);
  assert.doesNotMatch(client, /sb-byiykxfugvxuowueuxca-auth-token/);
  assert.match(client, /data\.paymentPayerType === "third_party"/);
  assert.match(client, /validarTelefone\(data\.paymentPayerPhone\)/);
});

test("backend exige nome e telefone válidos para pagador terceiro", () => {
  assert.match(backend, /customer\.paymentPayerType === "third_party"/);
  assert.match(backend, /textValue\(customer\.paymentPayerName, 160\)/);
  assert.match(backend, /brazilPhone\(textValue\(customer\.paymentPayerPhone, 30\)\)/);
  assert.match(backend, /code:\s*"invalid_payer_data"/);
  assert.match(backend, /!\/\^\\\+55\[1-9\]\\d\{9,10\}\$\//);
});

test("backend grava o pagador declarado e compara os dados em pedidos pendentes", () => {
  assert.match(backend, /payment_payer_type:\s*paymentPayerType/);
  assert.match(backend, /payment_payer_name:\s*paymentPayerName/);
  assert.match(backend, /payment_payer_phone:\s*paymentPayerPhone/);
  assert.match(backend, /payment_payer_source:\s*"website_checkout"/);
  assert.match(backend, /pendingOrder\.payment_payer_type === paymentPayerType/);
  assert.match(backend, /pendingOrder\.payment_payer_name/);
  assert.match(backend, /pendingOrder\.payment_payer_phone/);
});

test("checkout limita a espera da preparação do pagamento e libera o botão em caso de timeout", () => {
  assert.match(client, /var etapaPagamento = "identificação da sessão"/);
  assert.match(client, /etapaPagamento = "comunicação com o servidor de pagamentos"/);
  assert.match(client, /controller = new AbortController\(\)/);
  assert.match(client, /controller\.abort\(\)/);
  assert.match(client, /\}, 30000\)/);
  assert.match(client, /signal: controller \? controller\.signal : undefined/);
  assert.match(client, /paymentResponseStatus = response\.status/);
  assert.match(client, /error && error\.name === "AbortError"/);
  assert.match(client, /demorou mais que o esperado/);
  assert.match(client, /finally \{\s*if \(paymentTimeout !== null\) window\.clearTimeout\(paymentTimeout\);\s*\}/);
  assert.match(client, /button\.disabled = false/);
});

test("frontend aplica pedido mínimo de Bauru também quando a cidade vem como Tibiriçá", () => {
  const helper = client.match(/function minimoEntregaPorEndereco\(address\)\s*\{[\s\S]*?\n  \}/)?.[0];
  assert.ok(helper, "A regra de pedido mínimo deve ficar centralizada no helper.");
  assert.match(helper, /estado === "SP"/);
  assert.match(helper, /cidade === "bauru" \|\| cidade === "tibirica"/);
  assert.match(helper, /\? 20 : 50/);
  assert.match(client, /pedido para essa localidade deve ter mínimo de R\$ 20,00/);
  assert.match(client, /minimoEntregaPorEndereco\(\{ city: cidade, state: estado \}\)/);
  assert.equal((client.match(/minimoEntregaPorEndereco\(dadosAtuais\.address\)/g) || []).length, 2);
  assert.match(backend, /const isTibiriçaDelivery = !isPickup/);
  assert.match(backend, /const minimum = isPickup \? 0 : Number\(isBauruDelivery/);
});

test("backend diferencia retirada de entrega e valida CEP no servidor", () => {
  assert.match(backend, /const fulfillmentType = suppliedFulfillmentType \|\| "express"/);
  assert.match(backend, /const isPickup = fulfillmentType === "pickup"/);
  assert.match(backend, /code: "invalid_pickup_schedule"/);
  assert.match(backend, /code: "invalid_delivery_cep"/);
  assert.match(backend, /if \(!isPickup && !\/\^\\d\{8\}\$\//);
  assert.match(backend, /if \(!isPickup\) \{/);
});

test("backend persiste a retirada e não envia endereço de entrega à InfinitePay", () => {
  assert.match(backend, /const PICKUP_PREPARATION_MINUTES = 30/);
  assert.match(backend, /pickup_requested_at: pickupRequestedAt\?\.toISOString\(\) \|\| null/);
  assert.match(backend, /pendingOrder\.pickup_requested_at/);
  assert.match(backend, /const baseFeeCents = isPickup \? 0/);
  assert.match(backend, /const shippingCents = baseFeeCents/);
  assert.match(backend, /\.\.\.\(isPickup \? \{\} : \{/);
});
