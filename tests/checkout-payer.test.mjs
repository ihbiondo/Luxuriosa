import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkoutPages = ["index.html", "loja.html"].map((path) => ({
  path,
  html: readFileSync(path, "utf8")
}));
const cart = readFileSync("js/carrinho.js", "utf8");
const client = readFileSync("js/clientes.js", "utf8");
const app = readFileSync("js/app.js", "utf8");
const login = readFileSync("login.html", "utf8");

test("home e loja carregam a versão atual do checkout sem conta", () => {
  for (const { path, html } of checkoutPages) {
    assert.ok(html.includes('src="js/carrinho.js?v=20261124-whatsapp-sem-conta-v1'), path);
    assert.ok(html.includes('src="js/clientes.js?v=20261124-whatsapp-sem-conta-v1'), path);
  }
});

test("carrinho abre a coleta de dados sem exigir login ou cadastro", () => {
  assert.match(cart, /function enviarPedidoWhatsApp\(\)/);
  assert.match(cart, /checkout\.iniciarFinalizacao\(\)/);
  assert.match(cart, /function finalizarPedido\(\)/);
  assert.match(cart, /RECEBIMENTO_STORAGE_KEY/);
  assert.match(cart, /salvarPreferenciaRecebimento\(\)/);
  assert.match(cart, /restaurarPreferenciaRecebimento\(\)/);
  assert.doesNotMatch(cart, /iniciarFinalizacaoWhatsApp|Entre ou crie sua conta|validar sua conta/);

  for (const { path, html } of checkoutPages) {
    assert.match(html, /Cidade ou região da entrega/, path);
    assert.match(html, /id="cartDeliveryCity" required aria-required="true"/, path);
    assert.match(html, /id="cartClubInfo"/, path);
    assert.match(html, /id="cartClubJoinLink" href="\/clube\/"/, path);
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

test("a antiga área de conta e os convites de cadastro não aparecem na navegação", () => {
  assert.doesNotMatch(app, /nav-drawer-account-area|data-nav-account|Minha conta/);
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

test("o WhatsApp recebe resumo completo com emojis, indentação e quebras de linha", () => {
  for (const emoji of [
    "\\u{1F497}", "\\u{1F6CD}", "\\u{1F4B0}", "\\u{1F464}",
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
  assert.match(client, /https:\/\/wa\.me\/5514996355924\?text=/);
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
  assert.match(client, /required = exigirEnderecoEntrega[\s\S]*customerName[\s\S]*customerPhone/);
  assert.doesNotMatch(client, /required = exigirEnderecoEntrega[\s\S]*customerEmail/);
});
