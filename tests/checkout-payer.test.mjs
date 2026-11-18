import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("loja.html", "utf8");
const client = readFileSync("js/clientes.js", "utf8");
const backend = readFileSync("supabase/functions/create-payment-order/index.ts", "utf8");

test("checkout apresenta a escolha do responsável pelo pagamento", () => {
  assert.match(html, /id="customerPayerType"[\s\S]*?value="account_holder"/);
  assert.match(html, /value="third_party"/);
  assert.match(html, /id="customerPayerName"/);
  assert.match(html, /id="customerPayerPhone"/);
});

test("frontend valida, preserva e envia os dados do pagador dentro de customer", () => {
  assert.match(client, /paymentPayerType:\s*texto\("customerPayerType"\)/);
  assert.match(client, /paymentPayerName:\s*texto\("customerPayerName"\)/);
  assert.match(client, /paymentPayerPhone:\s*texto\("customerPayerPhone"\)/);
  assert.match(client, /customer:\s*dadosAtuais/);
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
