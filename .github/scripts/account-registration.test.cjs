const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const read = path => fs.readFileSync(path, "utf8");

test("a página de acesso não oferece cadastro nem login de conta", () => {
  const html = read("login.html");
  assert.ok(html.includes("Você não precisa criar uma conta."));
  assert.ok(html.includes('href="/loja.html"'));
  for (const legacy of [
    "<form", "signupForm", "signupTab", "loginForm", "loginTab",
    "googleAuthButton", 'type="password"', "signUp(", "signInWithPassword",
    "signInWithOAuth", "supabase-js"
  ]) {
    assert.ok(!html.includes(legacy), "A tela de acesso ainda contém: " + legacy);
  }
});

test("o perfil existente continua com endereço opcional", () => {
  const html = read("minha-conta/index.html");
  for (const id of [
    "accountPostalCode", "accountAddressNumber", "accountStreet",
    "accountNeighborhood", "accountCity", "accountState"
  ]) {
    const input = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
    assert.ok(input, "Campo ausente: " + id);
    assert.ok(!input[0].includes(" required"), "Campo de endereço não pode bloquear o perfil: " + id);
  }
  assert.ok(html.includes("if (hasCompleteAddress)"));
  assert.ok(html.includes("hasAnyAddress && !hasCompleteAddress"));
  assert.ok(html.includes("accountUsername"));
});

test("fixture E2E do Supabase mantém username no perfil legado", () => {
  const fixture = read("tests/e2e/login-fixtures.sql");
  assert.ok(fixture.includes("username text unique"));
});

test("checkout exige endereço somente para entrega e permite retirada agendada", () => {
  const clients = read("js/clientes.js");
  const index = read("index.html");
  const shop = read("loja.html");
  assert.ok(clients.includes("exigirEnderecoEntrega = exigirEndereco && !modalidadeRetirada()"));
  assert.ok(clients.includes("campoCep.required = !pickup"));
  assert.ok(clients.includes('campoCep.setAttribute("aria-required", pickup ? "false" : "true")'));
  const start = clients.indexOf("var required = exigirEnderecoEntrega");
  const end = clients.indexOf("document.querySelectorAll", start);
  const requiredBlock = clients.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(requiredBlock.includes("customerName") && requiredBlock.includes("customerPhone"));
  assert.ok(!requiredBlock.includes("customerEmail"), "E-mail deve ser opcional.");
  assert.ok(!shop.includes('id="customerCepHelp">Opcional.'));
  for (const [name, html] of [["index.html", index], ["loja.html", shop]]) {
    assert.ok(html.includes('id="customerCep"') && html.includes("required"), name + " precisa exigir CEP para entrega");
    assert.ok(html.includes('id="customerCepHelp">Obrigatório para entrega.'), name + " precisa explicar o CEP");
    assert.ok(html.includes('id="customerFulfillmentMode"'), name + " precisa oferecer retirada");
    assert.ok(html.includes('value="pickup">Retirada agendada gratuita em Bauru'));
    assert.ok(html.includes('id="customerPickupDate"'));
    assert.ok(html.includes('id="customerPickupTime"'));
  }
});
