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
page.on("request", request => {
  if (request.url().includes("/functions/v1/create-payment-order")) {
    paymentRequests.push(request.url());
  }
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
await page.route("https://viacep.com.br/ws/**", route => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    cep: "17030-290",
    logradouro: "Rua Madre Clélia",
    bairro: "Jardim Cruzeiro do Sul",
    localidade: "Bauru",
    uf: "SP"
  })
}));

try {
  await page.goto(BASE_URL + "/loja.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.LuxuriosaCarrinho && window.LuxuriosaClientes));
  await page.evaluate(item => window.LuxuriosaCarrinho.adicionar(item, 1), product);
  await page.locator("#cartCount").waitFor({ state: "visible" });
  await page.locator("#cartOpen").click();

  await page.locator("#cartFulfillmentMethod").selectOption("delivery");
  await page.locator("#cartDeliveryCity").selectOption("bauru");
  await page.locator("#cartCheckout").click();
  await page.locator("#customerOverlay:not([hidden])").waitFor({ state: "visible" });

  await page.locator("#customerName").fill("Cliente de Teste");
  await page.locator("#customerPhone").fill("(14) 99999-9999");
  await page.locator("#customerCep").fill("17030-290");
  await page.locator("#customerStreet").fill("Rua Madre Clélia");
  await page.locator("#customerNumber").fill("5-44");
  await page.locator("#customerDistrict").fill("Jardim Cruzeiro do Sul");
  await page.locator("#customerCity").fill("Bauru");
  await page.locator("#customerState").fill("SP");

  await page.locator("#customerReviewButton").click();
  await page.locator("#customerReview:not([hidden])").waitFor({ state: "visible" });
  const preview = await page.locator("#customerMessagePreview").textContent();

  assert.ok(preview.includes("PEDIDO | LUXURIOSA"));
  assert.ok(preview.includes(product.nome));
  assert.ok(preview.includes("Cliente de Teste"));
  assert.ok(preview.includes("(14) 99999-9999"));
  assert.ok(preview.includes("Rua Madre Clélia"));
  assert.ok(preview.includes("Bauru/SP"));
  assert.ok(preview.includes("Ducha") || preview.includes(product.nome));
  assert.ok(preview.includes("15,00"), "Frete de Bauru precisa constar no resumo.");
  assert.ok(preview.includes((Number(product.preco) + 15).toFixed(2).replace(".", ",")),
    "Total estimado precisa somar produto e frete.");
  for (const emoji of ["💗", "🛍", "💰", "👤", "📍", "💬", "🔒"]) {
    assert.ok(preview.includes(emoji), "Emoji ausente na mensagem: " + emoji);
  }
  assert.match(preview, /^ {3}01\\./m, "Itens precisam ficar indentados e numerados.");
  assert.match(preview, /^ {7}1x/m, "Quantidade e preço precisam ficar na segunda linha indentada.");
  assert.ok(!preview.includes("InfinitePay"));
  assert.ok(!preview.includes("chave PIX"));

  await page.locator("#customerWhatsAppButton").click();
  await page.waitForFunction(() => window.__luxuriosaOpenedUrls.length === 1);
  const finalUrls = await page.evaluate(() => window.__luxuriosaOpenedUrls.slice());
  openedUrls.push(...finalUrls);
  const whatsapp = new URL(finalUrls[0]);
  assert.equal(whatsapp.hostname, "wa.me");
  assert.equal(whatsapp.pathname, "/5514996355924");
  const message = whatsapp.searchParams.get("text");
  assert.ok(message && message.includes("PEDIDO | LUXURIOSA"));
  assert.ok(message.includes("Cliente de Teste"));
  assert.equal(paymentRequests.length, 0, "O fluxo WhatsApp não pode iniciar checkout de pagamento.");
  assert.ok(!page.url().includes("login.html"), "A compra não deve redirecionar para login.");
  assert.ok(!page.url().includes("pagamento"), "A compra não deve abrir pagamento no site.");
  console.log("Checkout WhatsApp sem conta: PASS. Mensagem aberta foi interceptada; nada foi enviado.");
} finally {
  await browser.close();
}
