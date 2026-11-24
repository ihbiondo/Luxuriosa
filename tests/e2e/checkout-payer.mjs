import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SERVICE_ROLE_KEY;
const TEST_PASSWORD = "E2E-Only-2026!";
const TEST_CART_SESSION = "00000000-0000-4000-8000-000000002931";

assert.ok(SUPABASE_URL, "E2E_SUPABASE_URL ausente.");
assert.ok(SERVICE_ROLE_KEY, "E2E_SERVICE_ROLE_KEY ausente.");

async function confirmTestUser(userId) {
  const response = await fetch(SUPABASE_URL + "/auth/v1/admin/users/" + encodeURIComponent(userId), {
    method: "PUT",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: "Bearer " + SERVICE_ROLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email_confirm: true })
  });
  const payload = await response.json();
  assert.ok(response.ok, "Não foi possível confirmar o usuário E2E local: " + JSON.stringify(payload));
}

async function readTestProfile(userId) {
  const response = await fetch(
    SUPABASE_URL + "/rest/v1/profiles?select=username,phone&id=eq." + encodeURIComponent(userId),
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: "Bearer " + SERVICE_ROLE_KEY } }
  );
  const payload = await response.json();
  assert.ok(response.ok, "Não foi possível consultar o perfil E2E local: " + JSON.stringify(payload));
  assert.equal(payload.length, 1, "O cadastro deve criar exatamente um perfil.");
  return payload[0];
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

  // username-login é um serviço hospedado que não está versionado neste repositório.
  // O teste isola somente a consulta de disponibilidade e usa o Auth local real.
  const usernameIdentityRequests = [];
  await page.route("**/functions/v1/username-login", async route => {
    let payload = {};
    try { payload = route.request().postDataJSON(); } catch (_) {}
    usernameIdentityRequests.push(payload);
    if (payload?.mode === "availability") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, available: true }) });
      return;
    }
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Modo não utilizado neste teste." }) });
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
  }, { timeout: 20000 }).then(request => request.postDataJSON())
    .catch(error => ({ __waitError: error.message }));

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
  assert.ok(!cartSnapshot.__waitError, "Falha ao observar o snapshot do carrinho: " + cartSnapshot.__waitError);
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
  }, { timeout: 15000 }).then(request => request.postDataJSON())
    .catch(error => ({ __waitError: error.message }));

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

  /* Cria a conta pela tela simplificada, usando o Auth da base descartável. */
  const checkoutUser = {
    email: "checkout-signup@example.com",
    username: "checkout.signup",
    phone: "(14) 99999-0001"
  };
  await page.locator("#username").fill(checkoutUser.username);
  await page.locator("#signupEmail").fill(checkoutUser.email);
  await page.locator("#phone").fill(checkoutUser.phone);
  await page.locator("#signupPassword").fill(TEST_PASSWORD);
  await page.locator("#confirmPassword").fill(TEST_PASSWORD);

  const signupResponsePromise = page.waitForResponse(response =>
    response.url().includes("/auth/v1/signup") && response.request().method() === "POST",
    { timeout: 20000 }
  );
  await page.locator('#signupForm button[type="submit"]').click();
  const signupResponse = await signupResponsePromise;
  const signupPayload = await signupResponse.json();
  assert.ok(signupResponse.ok(), "O cadastro pela interface falhou: " + JSON.stringify(signupPayload));
  assert.ok(signupPayload.user?.id, "O Auth local não retornou o usuário criado pela tela.");
  assert.equal(signupPayload.user.user_metadata?.username, checkoutUser.username,
    "O nome de usuário deve ser enviado ao Auth.");
  assert.equal(signupPayload.user.user_metadata?.phone, checkoutUser.phone,
    "O WhatsApp deve ser enviado ao Auth.");
  assert.equal(signupPayload.user.user_metadata?.full_name, undefined,
    "O cadastro básico não deve pedir nem enviar nome completo.");
  assert.equal(signupPayload.user.user_metadata?.birth_date, undefined,
    "O cadastro básico não deve pedir nem enviar data de nascimento.");
  assert.ok(usernameIdentityRequests.some(request => request.mode === "availability" &&
    request.username === checkoutUser.username),
    "A interface deve verificar a disponibilidade do usuário antes de criar a conta.");

  // Se o Auth local exigir confirmação, confirmamos apenas a conta descartável.
  if (!signupPayload.session) await confirmTestUser(signupPayload.user.id);

  const returnedAutomatically = await page.waitForURL(url =>
    url.pathname === "/loja.html" && url.searchParams.get("retomar-checkout") === "1",
    { timeout: 10000 }
  ).then(() => true).catch(() => false);

  // Sem sessão automática, seguimos pela aba de login da própria interface.
  if (!returnedAutomatically) {
    const loginForm = page.locator("#loginForm");
    if (!await loginForm.isVisible()) {
      const loginTab = page.locator("#loginTab");
      if (await loginTab.isVisible()) await loginTab.click();
    }
    await loginForm.waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#loginEmail").fill(checkoutUser.email);
    await page.locator("#loginPassword").fill(TEST_PASSWORD);
    await Promise.all([
      page.waitForURL(url => url.pathname === "/loja.html" &&
        url.searchParams.get("retomar-checkout") === "1", { timeout: 30000 }),
      page.locator('#loginForm button[type="submit"]').click()
    ]);
  }

  const createdProfile = await readTestProfile(signupPayload.user.id);
  assert.equal(createdProfile.username, checkoutUser.username,
    "O perfil deve persistir o nome de usuário escolhido no cadastro.");
  assert.equal(createdProfile.phone, checkoutUser.phone,
    "O perfil deve persistir o WhatsApp informado no cadastro.");
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
  assert.ok(!checkoutStarted.__waitError, "Não foi observado o início do checkout: " + checkoutStarted.__waitError);
  assert.ok(!whatsappOpened.__waitError, "Não foi observado o evento de abertura do WhatsApp: " + whatsappOpened.__waitError);
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
  assert.match(message, /ITENS DO PEDIDO/);
  assert.match(message, /\d+x Ducha Higiênica — Preta/i);
  assert.match(message, /\d+x Kit Descoberta/i);
  assert.match(message, /Dado:\s*Hétero/i);
  assert.match(message, /Produtos: R\$/i);
  assert.ok(message.includes("🛍️"), "A mensagem deve conter emojis.");
  assert.match(message, /RECEBIMENTO/i);
  assert.match(message, /Entrega em .*Bauru/i, "A região escolhida antes do cadastro deve ser mantida.");
  assert.match(message, /Frete \(.*Bauru.*\): R\$\s*15,00/i);
  assert.match(message, /Total estimado/i);
  assert.match(message, /chave PIX ou o link de pagamento/i);
  assert.match(message, /pedido é confirmado após a identificação do pagamento/i);
  assert.doesNotMatch(message, /RESUMO DOS VALORES/);

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
  assert.match(pickupMessage, /Retirada agendada em Bauru/i);
  assert.match(pickupMessage, /Frete: grátis/i);
  assert.match(pickupMessage, /Total estimado:/i);
  assert.match(pickupMessage, /PRÓXIMO PASSO/i);


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
    test: "cadastro simplificado e finalização manual pelo WhatsApp",
    signupCompletedThroughUi: true,
    usernameAvailabilityChecked: true,
    profilePhonePersisted: true,
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
