import assert from "node:assert/strict";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.E2E_ANON_KEY;
const FUNCTION_URL = process.env.E2E_PAYMENT_FUNCTION_URL ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/create-payment-order` : "");
const ORIGIN = "http://127.0.0.1:4173";
const PASSWORD = "E2E-Only-2026!";

assert.ok(SUPABASE_URL, "E2E_SUPABASE_URL ausente.");
assert.ok(SERVICE_ROLE_KEY, "E2E_SERVICE_ROLE_KEY ausente.");
assert.ok(ANON_KEY, "E2E_ANON_KEY ausente.");
assert.ok(FUNCTION_URL, "E2E_PAYMENT_FUNCTION_URL ausente.");

const localHost = new URL(SUPABASE_URL).hostname;
assert.ok(
  ["127.0.0.1", "localhost"].includes(localHost),
  "O teste de persistência só pode apontar para o Supabase local."
);
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(FUNCTION_URL).hostname),
  "A Edge Function de teste só pode ser chamada em loopback local."
);
assert.equal(
  new URL(FUNCTION_URL).pathname,
  "/functions/v1/create-payment-order",
  "O teste deve chamar somente create-payment-order."
);
assert.ok(
  !FUNCTION_URL.includes("byiykxfugvxuowueuxca.supabase.co"),
  "A Edge Function não pode apontar para o projeto hospedado."
);

async function createTestUser() {
  const email = `checkout-payer-persistence-${Date.now()}@example.com`;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: "Conta E2E Persistência",
        account_setup_completed: true
      }
    })
  });
  const payload = await response.json();
  assert.ok(response.ok, `Não foi possível criar usuário local: ${JSON.stringify(payload)}`);
  assert.ok(payload.id, "A API local não retornou o ID do usuário.");
  return { id: payload.id, email };
}

async function signIn(email) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password: PASSWORD })
    }
  );
  const payload = await response.json();
  assert.ok(response.ok, `Login local falhou: ${JSON.stringify(payload)}`);
  assert.ok(payload.access_token, "O login não retornou access_token.");
  return payload.access_token;
}

async function adminRequest(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...(init.headers || {})
    }
  });
}

async function deleteTestUser(userId) {
  if (!userId) return;
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`
    }
  }).catch(() => {});
}

let user;
try {
  user = await createTestUser();
  const accessToken = await signIn(user.email);
  const sessionKey = crypto.randomUUID();
  const body = {
    session_key: sessionKey,
    customer: {
      name: "Destinatário E2E Persistência",
      phone: "(14) 97777-6666",
      email: user.email,
      paymentPayerType: "third_party",
      paymentPayerName: "Pagador Terceiro Persistência",
      paymentPayerPhone: "(14) 98888-7777",
      address: {
        zip: "17010-000",
        street: "Rua de Teste E2E",
        number: "123",
        complement: "",
        district: "Centro",
        city: "Bauru",
        state: "SP",
        reference: ""
      }
    },
    items: [{ id: "6", quantidade: 1 }],
    fulfillment_type: "express"
  };

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Origin: ORIGIN
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  assert.equal(
    response.status,
    200,
    `create-payment-order falhou (${response.status}): ${JSON.stringify(result)}`
  );
  assert.equal(result.ok, true, "A Edge Function não confirmou a criação do pedido.");
  assert.match(
    result.checkout_url || "",
    /^https:\/\/checkout\.infinitepay\.io\/e2e-mock$/,
    "A resposta deve conter exclusivamente o link sintético do provedor simulado."
  );
  assert.ok(result.order_number, "A resposta não retornou o número do pedido.");

  const ordersResponse = await adminRequest(
    `orders?select=id,order_number,customer_id,customer_name,customer_phone,payment_payer_type,payment_payer_name,payment_payer_phone,payment_payer_source,payment_payer_declared_at,payment_status,payment_provider,payment_checkout_url,payment_order_nsu,fulfillment_type&order_number=eq.${encodeURIComponent(result.order_number)}`
  );
  const orders = await ordersResponse.json();
  assert.ok(ordersResponse.ok, `Não foi possível ler o pedido persistido: ${JSON.stringify(orders)}`);
  assert.equal(orders.length, 1, "Deve existir exatamente um pedido persistido.");
  const order = orders[0];

  assert.equal(order.customer_id, user.id, "O pedido deve pertencer à conta autenticada.");
  assert.equal(order.customer_name, "Destinatário E2E Persistência");
  assert.equal(order.customer_phone, "(14) 97777-6666");
  assert.equal(order.payment_payer_type, "third_party");
  assert.equal(order.payment_payer_name, "Pagador Terceiro Persistência");
  assert.equal(order.payment_payer_phone, "+551498887777");
  assert.equal(order.payment_payer_source, "website_checkout");
  assert.ok(order.payment_payer_declared_at, "A declaração do pagador deve ter data/hora.");
  assert.equal(order.payment_status, "pending");
  assert.equal(order.payment_provider, "infinitepay");
  assert.equal(order.payment_checkout_url, "https://checkout.infinitepay.io/e2e-mock");
  assert.equal(order.fulfillment_type, "express");

  const itemsResponse = await adminRequest(
    `order_items?select=product_id,product_name,quantity,unit_price&order_id=eq.${encodeURIComponent(order.id)}`
  );
  const items = await itemsResponse.json();
  assert.ok(itemsResponse.ok, `Não foi possível ler os itens persistidos: ${JSON.stringify(items)}`);
  assert.equal(items.length, 1, "O pedido deve ter exatamente um item.");
  assert.equal(String(items[0].product_id), "6");
  assert.equal(items[0].product_name, "Ducha Higiênica — Preta");
  assert.equal(Number(items[0].quantity), 1);
  assert.equal(Number(items[0].unit_price), 34.9);

  console.log(JSON.stringify({
    test: "persistência do pedido com pagador terceiro",
    result: "PASS",
    authenticatedAccountStored: order.customer_id === user.id,
    recipientStoredSeparately: order.customer_name === "Destinatário E2E Persistência",
    thirdPartyPayerStored: order.payment_payer_name === "Pagador Terceiro Persistência",
    payerPhoneNormalizedToE164: order.payment_payer_phone === "+551498887777",
    declarationSourceAndTimestampStored: Boolean(order.payment_payer_source && order.payment_payer_declared_at),
    orderAndItemPersisted: items.length === 1,
    paymentProviderMocked: true,
    realPaymentProviderRequests: 0
  }, null, 2));
} finally {
  if (user?.id) await deleteTestUser(user.id);
}
