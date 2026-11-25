import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkoutPages = ["index.html", "loja.html", "loja/lingerie/index.html"].map((path) => ({
  path,
  html: readFileSync(path, "utf8")
}));
const cart = readFileSync("js/carrinho.js", "utf8");
const client = readFileSync("js/clientes.js", "utf8");
const cartOrders = readFileSync("supabase/functions/cart-orders/index.ts", "utf8");
const app = readFileSync("js/app.js", "utf8");
const login = readFileSync("login.html", "utf8");
const clubLegacy = readFileSync("clube.html", "utf8");
const clubRoute = readFileSync("clube/index.html", "utf8");

test("home, loja e lingerie carregam a versão atual do checkout sem conta", () => {
  for (const { path, html } of checkoutPages) {
    assert.ok(html.includes('src="js/carrinho.js?v=20261125-cep-auto-checkout-v3'), path);
    assert.ok(html.includes('src="js/clientes.js?v=20261125-cep-auto-checkout-v3'), path);
  }
});

test("carrinho abre a coleta de dados sem exigir login ou cadastro", () => {
  assert.match(cart, /function enviarPedidoWhatsApp\(\)/);
  assert.match(cart, /checkout\.iniciarFinalizacao\(\)/);
  assert.match(cart, /function finalizarPedido\(\)/);
  assert.match(cart, /RECEBIMENTO_STORAGE_KEY/);
  assert.match(cart, /salvarPreferenciaRecebimento\(\)/);
  assert.match(cart, /restaurarPreferenciaRecebimento\(\)/);
  assert.match(cart, /A calcular pelo CEP/);
  assert.doesNotMatch(cart, /cartDeliveryCity|iniciarFinalizacaoWhatsApp|Entre ou crie sua conta|validar sua conta/);

  for (const { path, html } of checkoutPages) {
    assert.doesNotMatch(html, /Cidade ou região da entrega|id="cartDeliveryCity"/, path);
    assert.match(html, /id="cartDeliveryInfo"/, path);
    assert.match(html, /id="cartFulfillmentMethod"/, path);
    assert.match(html, /id="customerFulfillmentMode"/, path);
    assert.match(html, /id="customerCity"[^>]*readonly/, path);
    assert.match(html, /id="customerState"[^>]*readonly/, path);
    assert.doesNotMatch(html, /id="cartClubJoinLink"/, path);
    assert.match(html, /id="customerForm"/, path);
    assert.match(html, /id="customerWhatsAppButton"/, path);
    assert.doesNotMatch(html, /id="customerAccountLoad"|id="customerPaymentButton"|id="customerPayerType"/, path);
    assert.doesNotMatch(html, /Entre ou crie sua conta|Cadastre-se para comprar|PAGAR COM PIX OU CARTÃO/, path);
    assert.match(html, /id="customerEmail"[^>]*maxlength="254"/, path);
    assert.doesNotMatch(html, /id="customerEmail"[^>]*required/, path);
    assert.match(html, /id="customerName"[^>]*required/, path);
    assert.match(html, /id="customerPhone"[^>]*required/, path);
  }
});


test("cidade e estado são identificados pelo CEP, sem escolha manual", () => {
  assert.doesNotMatch(cart, /cartDeliveryCity/);
  assert.match(client, /fetch\("https:\/\/viacep\.com\.br\/ws\//);
  assert.match(client, /cepValidado !== cepDigits/);
  assert.match(client, /if \(digits\.length === 8\) consultarCep\(\)/);
  assert.match(client, /\$\("customerCity"\)\.readOnly = true/);
  assert.match(client, /\$\("customerState"\)\.readOnly = true/);
  assert.match(client, /address: pickup \? \{\} :/);
  assert.match(client, /Retirada não coleta nem envia endereço/);
  assert.match(client, /field\.required = !pickup/);
  assert.match(client, /field\.required = pickup/);
});

test("a antiga área de conta e os convites de cadastro não aparecem na navegação", () => {
  assert.doesNotMatch(app, /nav-drawer-account-area|nav-account-primary|Minha conta/);
  assert.match(app, /data-nav-account/);
  assert.match(app, /\.account-trigger/);
  assert.doesNotMatch(app, /supabase\.auth\.getSession\(\)/);
  assert.doesNotMatch(login, /<form|signupTab|loginTab|signupForm|loginForm|type="password"/);
  assert.match(login, /Você não precisa criar uma conta/);
  assert.match(login, /href="\/loja.html"/);
  assert.doesNotMatch(login, /Criar conta|Cadastre-se|Minha conta/);
  for (const { path, html } of checkoutPages) {
    assert.doesNotMatch(html, /data-nav-account|account-trigger|cartClubJoinLink[^>]*login\.html/, path);
  }
});


test("o Clube informa a suspensão de novas adesões e não oferece formulários de conta", () => {
  for (const [path, html] of [["clube.html", clubLegacy], ["clube/index.html", clubRoute]]) {
    assert.match(html, /novas adesões[^.]*suspensas/i, path);
    assert.match(html, /não é necessário criar uma conta|não é necessário cadastro prévio|comprar sem cadastro|sem cadastro prévio/i, path);
    assert.doesNotMatch(html, /<form|type=["']password["']|signupForm|signupEmail|createAccount/i, path);
    assert.doesNotMatch(html, /Entre gratuitamente|Faça seu cadastro gratuito|Cadastre-se para comprar/i, path);
  }
  assert.ok(clubLegacy.includes("</section>"), "Página antiga do Clube deve permanecer com estrutura HTML válida.");
});

test("o checkout envia os dados completos do pedido ao registro comercial, sem depender do consentimento analítico", () => {
  assert.match(client, /LuxuriosaInteligencia\.registrarPedido\(itensAtuais, dadosAtuais, resumoFrete\.fee\)/);
  assert.doesNotMatch(client, /registrarEtapa\("whatsapp_opened", itensAtuais, dadosAtuais\)/);
  assert.match(client, /fulfillmentType: pickup \? "pickup" : "express"/);
  assert.match(client, /pickupRequestedAt:/);
  assert.match(cartOrders, /const fulfillmentType = fulfillmentInput === "pickup" \? "pickup" : "express"/);
  assert.match(cartOrders, /const address = fulfillmentType === "pickup" \? \{\} : submittedAddress/);
  assert.match(cartOrders, /const shippingCents = fulfillmentType === "pickup" \? 0 : null/);
  assert.match(cartOrders, /fulfillment_type: fulfillmentType/);
  assert.match(cartOrders, /pickup_requested_at: pickupRequestedAt/);
  assert.match(readFileSync("js/inteligencia.js", "utf8"), /function registrarPedido\(items, customer, shippingAmount\)/);
});

test("campos de preferências pessoais não aparecem no checkout", () => {
  const removedLabels = [
    "Cores favoritas",
    "Preferências de categorias de produtos",
    "Faixa de preço de interesse",
    "Preferências de lingerie",
    "Interesses declarados pelo visitante"
  ];
  for (const label of removedLabels) {
    assert.doesNotMatch(client, new RegExp(label, "i"));
    for (const { path, html } of checkoutPages) assert.doesNotMatch(html, new RegExp(label, "i"), path);
  }
});

test("o WhatsApp recebe resumo completo com emojis, indentação e quebras de linha", () => {
  for (const emoji of [
    "\\u{2764}\\u{FE0F}", "\\u{1F6F5}", "\\u{1F6CD}", "\\u{1F4B0}", "\\u{1F464}",
    "\\u{1F4CD}", "\\u{1F4AC}", "\\u{1F512}"
  ]) assert.ok(client.includes(emoji), "Emoji ausente: " + emoji);

  for (const section of [
    "*PEDIDO | LUXURIOSA*", "*ITENS DO PEDIDO*", "*RESUMO DOS VALORES*",
    "*DADOS DE CONTATO*", "*ENDEREÇO DE ENTREGA*", "*PRÓXIMOS PASSOS*"
  ]) assert.ok(client.includes(section), "Seção ausente: " + section);

  assert.match(client, /lines\.push\("   " \+ number \+ "\. " \+ item\.nome\)/);
  assert.match(client, /lines\.push\("       " \+ quantity \+ "x/);
  assert.ok(client.includes('return lines.join("\\n");'));
  assert.match(client, /function continuarWhatsApp\(\)/);
  assert.match(client, /https:\/\/api\.whatsapp\.com\/send\?phone=5514996355924&text=/);
  assert.match(client, /window\.open\(url, "_blank", "noopener,noreferrer"\)/);
  assert.doesNotMatch(client, /\\uFFFD|�/);
});

test("checkout mantém somente os dados necessários para a solicitação pelo WhatsApp", () => {
  assert.match(client, /function iniciarFinalizacao\(\)/);
  assert.match(client, /function abrir\(\)/);
  assert.match(client, /form\.addEventListener\("submit", revisarPedido\)/);
  assert.match(client, /customerWhatsAppButton/);
  for (const field of [
    "customerName", "customerPhone", "customerEmail", "customerCep",
    "customerStreet", "customerNumber", "customerDistrict",
    "customerCity", "customerState"
  ]) assert.ok(client.includes(field), "Campo ausente: " + field);

  assert.doesNotMatch(client, /obterClienteSupabase|supabase\.auth|create-payment-order|customerPaymentButton|continuarPagamento|iniciarFinalizacaoWhatsApp/);
  const requiredStart = client.indexOf("var required = exigirEnderecoEntrega");
  const requiredEnd = client.indexOf("document.querySelectorAll", requiredStart);
  const requiredBlock = client.slice(requiredStart, requiredEnd);
  assert.ok(requiredStart >= 0 && requiredEnd > requiredStart, "A lista de campos obrigatórios deve existir.");
  assert.ok(requiredBlock.includes("customerName") && requiredBlock.includes("customerPhone"));
  assert.ok(!requiredBlock.includes("customerEmail"), "E-mail deve ser opcional.");
});


test("entregas, FAQ e páginas locais publicam tarifas, prazos e retirada consistentes", () => {
  const deliveries = readFileSync("entregas/index.html", "utf8");
  const faq = readFileSync("faq.html", "utf8");
  const service = readFileSync("atendimento.html", "utf8");

  assert.match(deliveries, /Bauru<\/th><td data-label="Entrega">R\$ 15,00/);
  assert.match(deliveries, /Tibiriçá<\/th><td data-label="Entrega">R\$ 20,00/);
  assert.match(deliveries, /Agudos<\/th><td data-label="Entrega">R\$ 25,00/);
  assert.match(deliveries, /Piratininga<\/th><td data-label="Entrega">R\$ 25,00/);
  assert.match(deliveries, /Pederneiras<\/th><td data-label="Entrega">R\$ 25,00/);
  assert.match(deliveries, /Lençóis Paulista<\/th><td data-label="Entrega">R\$ 50,00/);
  assert.match(deliveries, /Borebi<\/th><td data-label="Entrega">R\$ 50,00/);
  assert.match(deliveries, /R\$ 20,00 em Bauru e R\$ 50,00 nas demais cidades atendidas/);
  assert.match(deliveries, /até 30 minutos em Bauru, exceto Tibiriçá/);
  assert.match(deliveries, /até 2 horas em Agudos, Piratininga, Pederneiras e Lençóis Paulista/);
  assert.match(deliveries, /Retirada gratuita em Bauru, mediante agendamento prévio/);
  assert.match(deliveries, /identificar automaticamente a cidade e o estado/);

  assert.match(faq, /até 30 minutos em Bauru, exceto Tibiriçá/);
  assert.match(faq, /até 2 horas em Agudos, Piratininga, Pederneiras e Lençóis Paulista/);
  assert.match(faq, /a cidade e o estado são identificados automaticamente/);
  assert.match(faq, /A retirada é gratuita em Bauru e precisa ser agendada previamente/);
  assert.match(service, /Retirada e atendimento presencial somente mediante agendamento prévio/);

  const localPages = [
    ["cidades/sex-shop-agudos.html", /frete fixo de R\$ 25,00/, /até 2 horas após a confirmação do pagamento/],
    ["cidades/sex-shop-piratininga.html", /frete fixo de R\$ 25,00/, /até 2 horas após a confirmação do pagamento/],
    ["cidades/sex-shop-pederneiras.html", /frete fixo de R\$ 25,00/, /até 2 horas após a confirmação do pagamento/],
    ["cidades/sex-shop-lencois-paulista.html", /frete fixo de R\$ 50,00/, /até 2 horas após a confirmação do pagamento/]
  ];
  for (const [path, fee, deadline] of localPages) {
    const html = readFileSync(path, "utf8");
    assert.match(html, fee, path);
    assert.match(html, deadline, path);
  }
});
