import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SERVICE_ROLE_KEY;
const TEST_PASSWORD = "E2E-Only-2026!";
const TEST_CART_SESSION = "00000000-0000-4000-8000-000000002931";

assert.ok(SUPABASE_URL, "E2E_SUPABASE_URL ausente.");
assert.ok(SERVICE_ROLE_KEY, "E2E_SERVICE_ROLE_KEY ausente.");

async function createTestUser() {
  const email = "checkout-payer@example.com";
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: "Conta E2E Checkout",
        account_setup_completed: true
      }
    })
  });
  const payload = await response.json();
  assert.ok(response.ok, `Não foi possível criar usuário de checkout: ${JSON.stringify(payload)}`);
  assert.ok(payload.id, "A API local não retornou o ID do usuário.");
  return email;
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

const intelligenceRequests = [];
const paymentRequests = [];
const paymentProviderRequests = [];

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  /* Usa autenticação Supabase local real; apenas intercepta a abertura externa do WhatsApp. */
  await page.addInitScript(() => {
    window.__capturedWhatsAppUrl = "";
    window.open = function (url) {
      window.__capturedWhatsAppUrl = String(url || "");
      return null;
    };
  });

  // Registros de inteligência são capturados localmente; nenhuma chamada chega ao Supabase real.
  await page.route("**/functions/v1/cart-orders", async route => {
    try {
      const payload = route.request().postDataJSON();
      if (payload && typeof payload === "object") intelligenceRequests.push(payload);
    } catch (_) {}
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, test: true })
    });
  });

  // Qualquer tentativa acidental de criar cobrança é interceptada e contabilizada.
  await page.route("**/functions/v1/create-payment-order", async route => {
    paymentRequests.push(route.request().url());
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "Bloqueado pelo teste: pagamento manual via WhatsApp." })
    });
  });

  page.on("request", request => {
    if (/infinitepay\.(io|com\.br)/i.test(request.url())) {
      paymentProviderRequests.push(request.url());
    }
  });

  await page.goto(`${BASE_URL}/loja.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(sessionKey => {
    localStorage.removeItem("luxuriosa_carrinho");
    localStorage.setItem("lux18", "1");
    localStorage.setItem("lux_cookie_consent_v1", JSON.stringify({
      version: 2,
      updatedAt: new Date().toISOString(),
      necessary: true,
      analytics: true,
      marketing: false
    }));
    localStorage.setItem("luxuriosa_cart_session", sessionKey);
    localStorage.setItem("luxuriosa_cart_session_created_at", String(Date.now()));
  }, TEST_CART_SESSION);
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.locator("#grid article.product").first().waitFor({ state: "visible", timeout: 20000 });

  const bothProductsSnapshotPromise = page.waitForRequest(request => {
    if (!request.url().includes("/functions/v1/cart-orders")) return false;
    try {
      const payload = request.postDataJSON();
      return Boolean(payload &&
        payload.action === "cart_snapshot" &&
        payload.session_key === TEST_CART_SESSION &&
        payload.analytics_consent === true &&
        Array.isArray(payload.items) &&
        payload.items.length === 2);
    } catch (_) {
      return false;
    }
  }, { timeout: 20000 }).then(request => request.postDataJSON());

  // Primeiro produto avulso.
  const regularProduct = page.locator("#grid article.product")
    .filter({ hasText: "Ducha Higiênica — Preta" })
    .first();
  await regularProduct.waitFor({ state: "visible", timeout: 20000 });
  await regularProduct.locator("button.product-cart-button").click();
  await page.locator('#cart[aria-hidden="false"]').waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#cartClose").click();
  await page.waitForFunction(() =>
    document.querySelector("#cart")?.getAttribute("aria-hidden") === "true"
  );

  // Kit com variante de dado: a escolha precisa aparecer no resumo enviado ao WhatsApp.
  const kitProduct = page.locator("#grid article.product")
    .filter({ hasText: "Kit Descoberta" })
    .first();
  await kitProduct.waitFor({ state: "visible", timeout: 20000 });
  page.once("dialog", dialog => dialog.accept("1"));
  await kitProduct.locator("button.product-cart-button").click();

  await page.locator('#cart[aria-hidden="false"]').waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll("#cartItems .cart-item").length === 2);
  assert.equal(await page.locator("#cartItems .cart-item").count(), 2,
    "O carrinho deve manter o produto avulso e o kit selecionados.");

  const cartSnapshot = await bothProductsSnapshotPromise;
  assert.equal(cartSnapshot.items.length, 2,
    "A inteligência deve registrar os dois itens no snapshot do carrinho.");

  // Os ouvintes observam o envio depois que o cliente retorna do cadastro.
  const checkoutStartedPromise = page.waitForRequest(request => {
    if (!request.url().includes("/functions/v1/cart-orders")) return false;
    try {
      const payload = request.postDataJSON();
      return Boolean(payload &&
        payload.action === "checkout_started" &&
        payload.session_key === TEST_CART_SESSION &&
        Array.isArray(payload.items) &&
        payload.items.length === 2);
    } catch (_) {
      return false;
    }
  }, { timeout: 15000 }).then(request => request.postDataJSON());

  const whatsappOpenedPromise = page.waitForRequest(request => {
    if (!request.url().includes("/functions/v1/cart-orders")) return false;
    try {
      const payload = request.postDataJSON();
      return Boolean(payload &&
        payload.action === "site_event" &&
        payload.session_key === TEST_CART_SESSION &&
        payload.event_name === "whatsapp_opened");
    } catch (_) {
      return false;
    }
  }, { timeout: 15000 }).then(request => request.postDataJSON());

  await page.locator("#cartFulfillmentMethod").selectOption("delivery");
  assert.equal(await page.locator("#cartDeliveryFields").isVisible(), true,
    "A seleção da entrega deve abrir os campos de cidade/região.");
  assert.equal(await page.locator("#cartDeliveryCity").getAttribute("required"), "",
    "A cidade/região deve ser obrigatória no formulário.");
  assert.equal(await page.locator("#cartCheckout").isDisabled(), true,
    "O checkout não pode avançar enquanto a região não for selecionada.");
  await page.locator("#cartDeliveryCity").selectOption("bauru");
  assert.match(await page.locator("#cartFreightValue").innerText(), /R\$\s*15,00/,
    "Pedido com kit em Bauru deve pagar a tarifa normal de entrega.");

  await page.locator("#cartCheckout").click();
  await page.waitForURL("**/login.html?cadastro=1", { timeout: 15000 });
  assert.equal(await page.evaluate(() => localStorage.getItem("luxuriosa_checkout_after_login")), "1",
    "O pedido deve ficar marcado para ser retomado depois da autenticação.");
  assert.equal(await page.locator("#signupForm").isVisible(), true,
    "O visitante deve chegar diretamente à tela de criar conta.");

  /* O E2E autentica uma conta criada na base descartável usando a tela real de login. */
  const checkoutUser = await createTestUser();
  await page.locator("#loginTab").click();
  await page.locator("#loginEmail").fill(checkoutUser);
  await page.locator("#loginPassword").fill(TEST_PASSWORD);
  await Promise.all([
    page.waitForURL(url => url.pathname === "/loja.html" &&
      url.searchParams.get("retomar-checkout") === "1", { timeout: 30000 }),
    page.locator('#loginForm button[type="submit"]').click()
  ]);
  assert.equal(await page.evaluate(() => localStorage.getItem("luxuriosa_checkout_after_login")), null,
    "A tela de login deve consumir a marcação ao redirecionar de volta para o pedido.");
  await page.waitForFunction(() =>
    typeof window.__capturedWhatsAppUrl === "string" &&
    window.__capturedWhatsAppUrl.length > 0,
    null,
    { timeout: 15000 }
  );

  const [checkoutStarted, whatsappOpened] = await Promise.all([
    checkoutStartedPromise,
    whatsappOpenedPromise
  ]);
  assert.equal(checkoutStarted.items.length, 2,
    "O início da finalização deve registrar os dois itens.");
  assert.equal(whatsappOpened.event_name, "whatsapp_opened",
    "O clique para abrir o WhatsApp deve ser registrado.");

  const parsedWhatsAppUrl = new URL(
    await page.evaluate(() => window.__capturedWhatsAppUrl)
  );
  assert.equal(parsedWhatsAppUrl.hostname, "wa.me");
  assert.equal(parsedWhatsAppUrl.pathname, "/5514996355924");

  const message = parsedWhatsAppUrl.searchParams.get("text") || "";
  assert.match(message, /RESUMO DO CARRINHO/);
  assert.match(message, /Ducha Higiênica — Preta/i);
  assert.match(message, /Kit Descoberta/i);
  assert.match(message, /Dado:\s*Hétero/i);
  assert.match(message, /Subtotal estimado dos produtos/i);
  assert.ok(message.includes("🛍️"), "A mensagem deve conter emojis.");
  assert.match(message, /ENTREGA/i);
  assert.match(message, /Localidade: Bauru/i, "A região selecionada antes do cadastro deve ser mantida.");
  assert.match(message, /Frete: R\$\s*15,00/i);
  assert.match(message, /Total estimado/i);
  assert.match(message, /link de pagamento ou a chave PIX/i);
  assert.match(message, /O pedido só será confirmado após a identificação do pagamento/i);

  // Retirada agendada em Bauru não adiciona frete ao pedido.
  await page.locator("#cartFulfillmentMethod").selectOption("pickup");
  assert.match(await page.locator("#cartFreightValue").innerText(), /R\$\s*0,00/,
    "A retirada agendada deve ser gratuita.");
  await page.evaluate(() => { window.__capturedWhatsAppUrl = ""; });
  await page.locator("#cartCheckout").click();
  await page.waitForFunction(() =>
    typeof window.__capturedWhatsAppUrl === "string" &&
    window.__capturedWhatsAppUrl.length > 0,
    null,
    { timeout: 10000 }
  );
  const pickupUrl = new URL(await page.evaluate(() => window.__capturedWhatsAppUrl));
  const pickupMessage = pickupUrl.searchParams.get("text") || "";
  assert.match(pickupMessage, /RETIRADA AGENDADA EM BAURU/i);
  assert.match(pickupMessage, /Frete para retirada: R\$\s*0,00/i);
  assert.match(pickupMessage, /Total estimado:/i);


  assert.equal(await page.locator("#customerOverlay").evaluate(element => element.hidden), true,
    "O novo fluxo não deve abrir o formulário antigo de dados de pagamento.");
  assert.deepEqual(paymentRequests, [],
    "A finalização manual não pode chamar create-payment-order.");
  assert.deepEqual(paymentProviderRequests, [],
    "A finalização manual não pode chamar a InfinitePay.");

  const addToCartEvents = intelligenceRequests.filter(payload =>
    payload.action === "site_event" && payload.event_name === "add_to_cart");
  assert.ok(addToCartEvents.length >= 2,
    "A inteligência deve manter o registro de adição dos produtos.");

  console.log(JSON.stringify({
    test: "finalização manual pelo WhatsApp",
    result: "PASS",
    cartSnapshotContainsBothItems: true,
    checkoutStartedRegistered: true,
    whatsappOpenedRegistered: true,
    kitVariantIncludedInMessage: true,
    noPaymentOrderCreated: true,
    paymentProviderRequests: paymentProviderRequests.length
  }, null, 2));

  await context.close();
} finally {
  await browser.close();
}
