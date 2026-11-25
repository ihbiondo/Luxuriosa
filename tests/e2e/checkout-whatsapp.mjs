import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const catalog = JSON.parse(fs.readFileSync("data/produtos.json", "utf8"));
const product = catalog.produtos.find(item => String(item.id) === "6");
assert.ok(product && Number(product.preco) >= 20, "Produto estável para o teste não encontrado.");

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage();
page.setDefaultTimeout(10000);
const openedUrls = [];
const paymentRequests = [];
const cartOrderRequests = [];
page.on("request", request => {
  if (request.url().includes("/functions/v1/create-payment-order")) paymentRequests.push(request.url());
  if (request.url().includes("cart-orders")) console.log("[E2E] request", request.method(), request.url());
});
page.on("response", response => {
  if (response.url().includes("cart-orders")) console.log("[E2E] response", response.status(), response.request().method(), response.url());
});
await page.addInitScript(() => {
  try {
    localStorage.setItem("lux18", "1");
    localStorage.removeItem("luxuriosa_checkout_after_login");
  } catch (_) {}
  window.__luxuriosaOpenedUrls = [];
  window.open = function (url) {
    window.__luxuriosaOpenedUrls.push(String(url));
    return null;
  };
});
await page.route(/https:\/\/byiykxfugvxuowueuxca\.supabase\.co\/functions\/v1\/create-payment-order(?:\?.*)?$/, async route => {
  await route.fulfill({
    status: 403,
    headers: { "access-control-allow-origin": "*" },
    contentType: "application/json",
    body: JSON.stringify({ error: "Pagamentos reais estão bloqueados no E2E." })
  });
});
await page.route(/cart-orders/, async route => {
  const request = route.request();
  console.log("[E2E] intercepted cart-orders", request.method(), request.url());
  if (request.method() === "OPTIONS") {
    const requestedHeaders = request.headers()["access-control-request-headers"] || "apikey,content-type";
    await route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": requestedHeaders
      }
    });
    return;
  }
  if (request.method() !== "POST") {
    await route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ error: "Método não permitido no teste." }) });
    return;
  }
  cartOrderRequests.push(request.postDataJSON());
  await route.fulfill({
    status: 200,
    headers: { "access-control-allow-origin": "*" },
    contentType: "application/json",
    body: JSON.stringify({ ok: true, order_id: "e2e-order", order_number: 900001 })
  });
});

await page.route("https://viacep.com.br/ws/**", route => {
  const cep = new URL(route.request().url()).pathname.split("/").filter(Boolean).at(-2);
  const addresses = {
    "17030290": {
      cep: "17030-290", logradouro: "Rua Madre Clélia",
      bairro: "Jardim Cruzeiro do Sul", localidade: "Bauru", uf: "SP"
    },
    "17000001": {
      cep: "17000-001", logradouro: "Estrada de Tibiriçá",
      bairro: "Tibiriçá", localidade: "Bauru", uf: "SP"
    },
    "17500000": {
      cep: "17500-000", logradouro: "Rua de Teste",
      bairro: "Centro", localidade: "Marília", uf: "SP"
    },
    "17120000": {
      cep: "17120-000", logradouro: "Rua de Teste",
      bairro: "Domélia", localidade: "Agudos", uf: "SP"
    },
    "17200001": {
      cep: "17200-001", logradouro: "Rua de Teste",
      bairro: "Santelmo", localidade: "Pederneiras", uf: "SP"
    },
    "18682000": {
      cep: "18682-000", logradouro: "Rua de Teste",
      bairro: "Alfredo Guedes", localidade: "Lençóis Paulista", uf: "SP"
    }
  };
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(addresses[cep] || { erro: true })
  });
});

try {
  await page.goto(BASE_URL + "/loja.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.LuxuriosaCarrinho && window.LuxuriosaClientes));
  await page.evaluate(item => window.LuxuriosaCarrinho.adicionar(item, 1), product);
  await page.locator("#cartCount").waitFor({ state: "visible" });
  // adicionar() já abre o carrinho; aguarda o painel em vez de clicar novamente no gatilho encoberto.
  await page.locator("#cart.open").waitFor({ state: "visible" });

  await page.locator("#cartFulfillmentMethod").selectOption("delivery");
  await page.locator("#cartCheckout").click();
  await page.locator("#customerOverlay:not([hidden])").waitFor({ state: "visible" });

  await page.locator("#customerName").fill("Cliente de Teste");
  await page.locator("#customerPhone").fill("(14) 99999-9999");
  await page.locator("#customerCep").fill("17030-290");
  await page.waitForFunction(() => document.getElementById("customerCity").value === "Bauru");
  await page.locator("#customerNumber").fill("5-44");

  await page.locator("#customerReviewButton").click();
  await page.locator("#customerReview:not([hidden])").waitFor({ state: "visible" });
  const preview = await page.locator("#customerMessagePreview").textContent();

  assert.ok(preview.includes("PEDIDO | LUXURIOSA"));
  assert.ok(preview.includes("❤️ *PEDIDO | LUXURIOSA*"), "O título deve usar o coração vermelho.");
  assert.ok(preview.includes("🛵 *ENDEREÇO DE ENTREGA*"), "A entrega deve usar o ícone de motocicleta.");
  assert.ok(!preview.includes("📍 *ENDEREÇO DE ENTREGA*"), "O ícone de localização fica reservado à retirada.");
  assert.ok(preview.includes(product.nome));
  assert.ok(preview.includes("Cliente de Teste"));
  assert.ok(preview.includes("(14) 99999-9999"));
  assert.ok(preview.includes("Rua Madre Clélia"));
  assert.ok(preview.includes("Bauru/SP"));
  assert.ok(preview.includes("15,00"), "Frete de Bauru precisa constar no resumo.");
  assert.ok(preview.includes((Number(product.preco) + 15).toFixed(2).replace(".", ",")),
    "Total estimado precisa somar produto e frete.");
  for (const emoji of ["❤️", "🛵", "🛍", "💰", "👤", "💬", "🔒"]) {
    assert.ok(preview.includes(emoji), "Emoji ausente na mensagem: " + emoji);
  }
  const firstItemLine = preview.split("\n").find(line => line.includes("01."));
  assert.ok(firstItemLine && firstItemLine.startsWith("   01."), "Itens precisam ficar indentados e numerados.");
  assert.match(preview, /^ {7}1x/m, "Quantidade e preço precisam ficar na segunda linha indentada.");
  assert.ok(!preview.includes("InfinitePay"));
  assert.ok(!preview.includes("chave PIX"));

  const deliveryResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    if (!request.url().includes("/functions/v1/cart-orders") || request.method() !== "POST") return false;
    try { return request.postDataJSON().action === "whatsapp_opened"; } catch (_) { return false; }
  });
  await page.locator("#customerWhatsAppButton").click();
  const deliveryResponse = await deliveryResponsePromise;
  assert.equal(deliveryResponse.status(), 200);
  const deliveryPayload = cartOrderRequests.find(payload => payload.action === "whatsapp_opened");
  assert.ok(deliveryPayload, "O pedido deve ser encaminhado ao endpoint de pedidos.");
  assert.equal(deliveryPayload.customer.fulfillmentType, "express");
  assert.equal(deliveryPayload.customer.address.zip, "17030-290");
  assert.equal(deliveryPayload.customer.address.city, "Bauru");
  assert.equal(deliveryPayload.customer.address.state, "SP");
  assert.equal(deliveryPayload.shipping_amount, 15);
  await page.waitForFunction(() => window.__luxuriosaOpenedUrls.length === 1);
  const finalUrls = await page.evaluate(() => window.__luxuriosaOpenedUrls.slice());
  openedUrls.push(...finalUrls);
  const whatsapp = new URL(finalUrls[0]);
  assert.equal(whatsapp.hostname, "api.whatsapp.com");
  assert.equal(whatsapp.pathname, "/send");
  assert.equal(whatsapp.searchParams.get("phone"), "5514996355924");
  const message = whatsapp.searchParams.get("text");
  assert.ok(message && message.includes("PEDIDO | LUXURIOSA"));
  assert.ok(message.includes("❤️ *PEDIDO | LUXURIOSA*"));
  assert.ok(message.includes("🛵 *ENDEREÇO DE ENTREGA*"));
  assert.ok(!message.includes("💗"), "O coração antigo não deve aparecer no pedido.");
  assert.ok(message.includes("Cliente de Teste"));
  for (const emoji of ["❤️", "🛵", "🛍", "💰", "👤", "💬", "🔒"]) {
    assert.ok(message.includes(emoji), "Emoji corrompido ou ausente no link do WhatsApp: " + emoji);
  }
  assert.ok(!message.includes("\uFFFD"), "A mensagem do WhatsApp não pode conter o caractere de substituição.");
  assert.equal(paymentRequests.length, 0, "O fluxo WhatsApp não pode iniciar checkout de pagamento.");
  assert.ok(!page.url().includes("login.html"), "A compra não deve redirecionar para login.");
  assert.ok(!page.url().includes("pagamento"), "A compra não deve abrir pagamento no site.");

  // Confere a tarifa mínima de Tibiriçá pelo distrito real retornado no endereço.
  async function revisarRegiao(address) {
    await page.goto(BASE_URL + "/loja.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.LuxuriosaCarrinho && window.LuxuriosaClientes));
    await page.evaluate(() => window.LuxuriosaCarrinho.limpar());
    await page.evaluate(item => window.LuxuriosaCarrinho.adicionar(item, 1), product);
    await page.locator("#cart.open").waitFor({ state: "visible" });
    await page.locator("#cartFulfillmentMethod").selectOption("delivery");
    await page.locator("#cartCheckout").click();
    await page.locator("#customerOverlay:not([hidden])").waitFor({ state: "visible" });
    await page.locator("#customerName").fill("Cliente de Teste");
    await page.locator("#customerPhone").fill("(14) 99999-9999");
    await page.locator("#customerCep").fill(address.zip);
    await page.waitForFunction(city => document.getElementById("customerCity").value === city, address.city);
    await page.locator("#customerNumber").fill("100");
    await page.locator("#customerReviewButton").click();
    await page.locator("#customerReview:not([hidden])").waitFor({ state: "visible" });
    return page.locator("#customerMessagePreview").textContent();
  }

  const tibiricaPreview = await revisarRegiao({
    zip: "17000-001", city: "Bauru"
  });
  const tibiricaText = tibiricaPreview.replace(/\u00A0/g, " ");
  assert.match(tibiricaText, /Frete: R\$ 20,00/, "Tibiriçá deve usar a tarifa específica.");
  assert.match(tibiricaText, /Pedido mínimo: R\$ 50,00 em produtos\./,
    "O pedido mínimo de Tibiriçá deve ser R$ 50,00, mesmo quando o município informado é Bauru.");

  const otherPreview = await revisarRegiao({
    zip: "17500-000", city: "Marília"
  });
  assert.ok(otherPreview.includes("Frete: a confirmar com a equipe"));
  assert.ok(!otherPreview.includes("Pedido mínimo:"),
    "Localidades sob consulta não devem receber um pedido mínimo inventado.");

  for (const address of [
    { zip: "17120-000", city: "Agudos" },
    { zip: "17200-001", city: "Pederneiras" },
    { zip: "18682-000", city: "Lençóis Paulista" }
  ]) {
    const preview = await revisarRegiao(address);
    assert.ok(preview.includes("Frete: a confirmar com a equipe"),
      "O distrito " + address.zip + " deve exigir confirmação de frete.");
  }

  // Retirada deve descartar qualquer endereço e não exigir CEP.
  await page.goto(BASE_URL + "/loja.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.LuxuriosaCarrinho && window.LuxuriosaClientes));
  await page.evaluate(() => window.LuxuriosaCarrinho.limpar());
  await page.evaluate(item => window.LuxuriosaCarrinho.adicionar(item, 1), product);
  await page.locator("#cart.open").waitFor({ state: "visible" });
  await page.locator("#cartFulfillmentMethod").selectOption("pickup");
  await page.locator("#cartCheckout").click();
  await page.locator("#customerOverlay:not([hidden])").waitFor({ state: "visible" });
  await page.locator("#customerName").fill("Cliente Retirada");
  await page.locator("#customerPhone").fill("(14) 99999-9999");
  const tomorrow = await page.evaluate(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  await page.locator("#customerPickupDate").fill(tomorrow);
  await page.locator("#customerPickupTime").fill("15:00");
  await page.locator("#customerReviewButton").click();
  await page.locator("#customerReview:not([hidden])").waitFor({ state: "visible" });
  const pickupPreview = await page.locator("#customerMessagePreview").textContent();
  assert.ok(pickupPreview.includes("RETIRADA"));
  assert.ok(!pickupPreview.includes("ENDEREÇO DE ENTREGA"));
  assert.ok(!pickupPreview.includes("CEP:"));
  // O endereço fixo da loja é informado como local de retirada; nenhum endereço do cliente é enviado.
  const pickupResponsePromise = page.waitForResponse(response => {
    const request = response.request();
    if (!request.url().includes("/functions/v1/cart-orders") || request.method() !== "POST") return false;
    try { return request.postDataJSON().action === "whatsapp_opened"; } catch (_) { return false; }
  });
  await page.locator("#customerWhatsAppButton").click();
  const pickupResponse = await pickupResponsePromise;
  assert.equal(pickupResponse.status(), 200);
  const pickupPayload = cartOrderRequests.filter(payload => payload.action === "whatsapp_opened").at(-1);
  assert.equal(pickupPayload.customer.fulfillmentType, "pickup");
  assert.deepEqual(pickupPayload.customer.address, {});
  assert.equal(pickupPayload.shipping_amount, 0);
  assert.ok(pickupPayload.customer.pickupRequestedAt, "Retirada deve enviar a data e o horário combinados.");

  // A página secundária de lingerie deve usar o mesmo checkout atualizado.
  await page.goto(BASE_URL + "/loja/lingerie/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.LuxuriosaCarrinho && window.LuxuriosaClientes));
  await page.evaluate(() => window.LuxuriosaCarrinho.limpar());
  await page.evaluate(item => window.LuxuriosaCarrinho.adicionar(item, 1), product);
  await page.locator("#cart.open").waitFor({ state: "visible" });
  await page.locator("#cartFulfillmentMethod").selectOption("delivery");
  assert.equal(await page.locator("#cartDeliveryCity").count(), 0);
  await page.locator("#cartCheckout").click();
  await page.locator("#customerOverlay:not([hidden])").waitFor({ state: "visible" });
  await page.locator("#customerCep").fill("17030-290");
  await page.waitForFunction(() => document.getElementById("customerCity").value === "Bauru");
  assert.equal(await page.locator("#customerCity").isEditable(), false);
  assert.equal(await page.locator("#customerState").isEditable(), false);
  assert.equal(await page.locator("#customerWhatsAppButton").count(), 1);
  assert.equal(await page.locator("#customerAccountLoad").count(), 0);

  // Compra iniciada em uma página individual deve chegar ao mesmo carrinho atualizado.
  await page.goto(BASE_URL + "/produtos/6-ducha-higienica-unissex.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.LuxuriosaCarrinho &&
    document.querySelector("[data-add-to-cart]") &&
    !document.querySelector("[data-add-to-cart]").disabled
  ));
  await page.evaluate(() => window.LuxuriosaCarrinho.limpar());
  await Promise.all([
    page.waitForURL(url => url.pathname === "/loja.html" && url.searchParams.get("abrirCarrinho") === "1"),
    page.locator("[data-add-to-cart]").click()
  ]);
  await page.locator("#cart.open").waitFor({ state: "visible" });
  assert.equal(await page.locator("#cartFulfillmentMethod").count(), 1);
  assert.equal(await page.locator("#cartDeliveryCity").count(), 0);
  assert.ok(await page.locator(".cart-item").count() > 0, "O produto deve chegar ao carrinho.");
  assert.equal(await page.locator("#customerAccountLoad").count(), 0);

  console.log("Checkout WhatsApp sem conta: PASS. WhatsApp e Supabase foram interceptados; nenhum pedido real foi criado.");
} finally {
  await browser.close();
}
