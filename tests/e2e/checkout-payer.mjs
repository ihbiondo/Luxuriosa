import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SERVICE_ROLE_KEY;
const PASSWORD = "E2E-Only-2026!";

assert.ok(SUPABASE_URL, "E2E_SUPABASE_URL ausente.");
assert.ok(SERVICE_ROLE_KEY, "E2E_SERVICE_ROLE_KEY ausente.");

async function createTestUser() {
  const email = `checkout-payer-${Date.now()}@example.com`;
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
        display_name: "Conta E2E Checkout",
        account_setup_completed: true
      }
    })
  });
  const payload = await response.json();
  assert.ok(response.ok, `Não foi possível criar a conta E2E local: ${JSON.stringify(payload)}`);
  assert.ok(payload.id, "A API local não retornou o ID da conta E2E.");
  return { id: payload.id, email };
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

async function login(page, email) {
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#loginForm").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#loginEmail").fill(email);
  await page.locator("#loginPassword").fill(PASSWORD);
  await page.locator('#loginForm button[type="submit"]').click();
  await page.locator("#signedInArea").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(
    expectedEmail => document.querySelector("#accountEmail")?.textContent?.trim() === expectedEmail,
    email,
    { timeout: 30000 }
  );
}

const user = await createTestUser();
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

let paymentRequestCount = 0;
let paymentRequestResolve;
const paymentRequestCaptured = new Promise(resolve => {
  paymentRequestResolve = resolve;
});
const checkoutProviderRequests = [];

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  // Nenhum dado de checkout chega à função real: o teste captura a requisição
  // e responde localmente com erro controlado antes de qualquer gravação/cobrança.
  await page.route("**/functions/v1/create-payment-order", async route => {
    const request = route.request();
    const corsHeaders = {
      "access-control-allow-origin": new URL(BASE_URL).origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type",
      "access-control-max-age": "600"
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    paymentRequestCount += 1;
    let body = {};
    try {
      body = request.postDataJSON();
    } catch (_) {}
    paymentRequestResolve({ url: request.url(), body });

    await route.fulfill({
      status: 409,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Bloqueado pelo teste E2E. Nenhum pedido ou pagamento foi criado."
      })
    });
  });

  // Analytics não faz parte do teste do checkout. Bloqueia qualquer chamada
  // incidental a essa função para manter a execução isolada.
  await page.route("**/functions/v1/cart-orders", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, skipped: true })
  }));

  page.on("request", request => {
    if (/infinitepay\.(io|com\.br)/i.test(request.url())) {
      checkoutProviderRequests.push(request.url());
    }
  });

  await login(page, user.email);

  await page.goto(`${BASE_URL}/loja.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#gateYes").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#gateYes").click();
  await page.locator("#gate").waitFor({ state: "hidden", timeout: 10000 });

  // Produto real do catálogo estático, sem variação de kit nem ação especial.
  const product = page.locator("#grid article.product")
    .filter({ hasText: "Ducha Higiênica — Preta" })
    .first();
  await product.waitFor({ state: "visible", timeout: 20000 });
  await product.locator("button.product-cart-button").click();

  await page.locator('#cart[aria-hidden="false"]').waitFor({ state: "visible", timeout: 10000 });
  const checkoutButton = page.locator("#cartCheckout");
  await checkoutButton.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const button = document.querySelector("#cartCheckout");
      return button && !button.disabled;
    },
    null,
    { timeout: 15000 }
  );
  await checkoutButton.click();

  await page.locator("#customerOverlay").waitFor({ state: "visible", timeout: 20000 });
  await page.locator("#customerName").waitFor({ state: "visible" });

  // Retirada agendada evita CEP/endereço e mantém o teste focado no pagador.
  await page.locator("#customerFulfillmentMode").selectOption("pickup");
  await page.locator("#customerPickupDate").fill("2099-12-31");
  await page.locator("#customerPickupTime").fill("17:00");

  await page.locator("#customerName").fill("Destinatário E2E");
  await page.locator("#customerPhone").fill("(14) 97777-6666");
  await page.locator("#customerEmail").fill(user.email);

  await page.locator("#customerPayerType").selectOption("third_party");
  await page.locator("#customerPayerName").fill("Pagador Terceiro E2E");
  await page.locator("#customerPayerPhone").fill("(14) 98888-7777");

  await page.locator("#customerReviewButton").click();
  await page.locator("#customerReview").waitFor({ state: "visible", timeout: 10000 });
  const reviewText = await page.locator("#customerMessagePreview").innerText();
  assert.match(reviewText, /Pagador indicado: Pagador Terceiro E2E/i);
  assert.match(reviewText, /Destinatário E2E/);
  assert.match(reviewText, /Retirada agendada/i);

  await page.locator("#customerPaymentButton").click();

  const captured = await Promise.race([
    paymentRequestCaptured,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("O checkout não enviou a requisição esperada para create-payment-order.")),
      20000
    ))
  ]);

  assert.equal(paymentRequestCount, 1, "O checkout deve emitir exatamente uma requisição.");
  const requestUrl = new URL(captured.url);
  assert.equal(
    requestUrl.origin,
    new URL(SUPABASE_URL).origin,
    "A requisição E2E deve apontar somente para o Supabase local."
  );
  assert.ok(
    !captured.url.includes("byiykxfugvxuowueuxca.supabase.co"),
    "A requisição não pode apontar para o projeto Supabase de produção."
  );

  const payload = captured.body;
  assert.ok(payload.session_key, "O identificador de sessão do carrinho deve ser enviado.");
  assert.ok(Array.isArray(payload.items) && payload.items.length === 1,
    "O checkout deve enviar o item selecionado.");
  assert.equal(payload.customer.name, "Destinatário E2E");
  assert.equal(payload.customer.email, user.email);
  assert.equal(payload.customer.paymentPayerType, "third_party");
  assert.equal(payload.customer.paymentPayerName, "Pagador Terceiro E2E");
  assert.equal(
    String(payload.customer.paymentPayerPhone).replace(/\D/g, ""),
    "14988887777",
    "O telefone do pagador terceiro deve chegar íntegro no payload."
  );
  assert.equal(
    String(payload.customer.phone).replace(/\D/g, ""),
    "14977776666",
    "O telefone do destinatário deve continuar separado do telefone do pagador."
  );
  assert.equal(payload.customer.fulfillmentType, "pickup");
  assert.ok(payload.customer.pickupRequestedAt, "O agendamento de retirada deve seguir no payload.");

  assert.deepEqual(
    checkoutProviderRequests,
    [],
    "A InfinitePay não pode ser acessada durante a validação."
  );

  // Segundo cenário: kit + produto avulso em Bauru deve receber frete gratuito.
  // O teste revisa o cálculo, sem criar pedido nem chamar o provedor de pagamento.
  await page.evaluate(() => window.LuxuriosaCarrinho.limpar());
  await page.goto(`${BASE_URL}/loja.html`, { waitUntil: "domcontentloaded" });

  const regularProduct = page.locator("#grid article.product")
    .filter({ hasText: "Ducha Higiênica — Preta" })
    .first();
  await regularProduct.waitFor({ state: "visible", timeout: 20000 });
  await regularProduct.locator("button.product-cart-button").click();
  await page.locator('#cart[aria-hidden="false"]').waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#cartClose").click();
  await page.waitForFunction(
    () => document.querySelector("#cart")?.getAttribute("aria-hidden") === "true"
  );

  const kitProduct = page.locator("#grid article.product")
    .filter({ hasText: "Kit Descoberta" })
    .first();
  await kitProduct.waitFor({ state: "visible", timeout: 20000 });
  page.once("dialog", dialog => dialog.accept("1"));
  await kitProduct.locator("button.product-cart-button").click();

  await page.locator('#cart[aria-hidden="false"]').waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#cartCheckout").click();
  await page.locator("#customerOverlay").waitFor({ state: "visible", timeout: 20000 });
  await page.locator("#customerFulfillmentMode").selectOption("delivery");
  await page.locator("#customerName").fill("Destinatário E2E Kit");
  await page.locator("#customerPhone").fill("(14) 97777-6666");
  await page.locator("#customerEmail").fill(user.email);
  await page.locator("#customerStreet").fill("Rua Madre Clélia");
  await page.locator("#customerNumber").fill("5-44");
  await page.locator("#customerDistrict").fill("Jardim Cruzeiro do Sul");
  await page.locator("#customerCity").fill("Bauru");
  await page.locator("#customerState").fill("SP");

  const freightNotice = await page.locator("#customerFreightInfo").innerText();
  assert.match(freightNotice, /frete gratuito para pedidos com kit em Bauru\/SP/i);

  await page.locator("#customerReviewButton").click();
  await page.locator("#customerReview").waitFor({ state: "visible", timeout: 10000 });
  const kitReviewText = await page.locator("#customerMessagePreview").innerText();
  assert.match(kitReviewText, /Ducha Higiênica — Preta/i);
  assert.match(kitReviewText, /Kit Descoberta/i);
  assert.match(kitReviewText, /Frete: gratuito.*pedido com kit em Bauru\/SP/i);

  console.log(JSON.stringify({
    test: "checkout autenticado com pagador terceiro",
    result: "PASS",
    authenticatedAccount: true,
    reviewIncludesDeclaredPayer: true,
    payloadIncludesDistinctRecipientAndPayer: true,
    requestSentToLocalSupabaseOnly: true,
    paymentProviderRequests: checkoutProviderRequests.length,
    interceptedPaymentRequests: paymentRequestCount,
    kitWithRegularProductGetsFreeBauruFreight: true,
    orderOrChargeCreated: false
  }, null, 2));

  await context.close();
} finally {
  await browser.close();
  await deleteTestUser(user.id);
}
