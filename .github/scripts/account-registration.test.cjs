const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const read = path => fs.readFileSync(path, "utf8");

test("a página de acesso não oferece cadastro nem login de conta", () => {
  const html = read("login.html");
  assert.match(html, /Você não precisa criar uma conta/);
  assert.match(html, /href="\/loja.html"/);
  assert.doesNotMatch(html, /<form|signupForm|signupTab|loginForm|loginTab|googleAuthButton|type="password"/);
  assert.doesNotMatch(html, /signUp\\(|signInWithPassword|signInWithOAuth|supabase-js/);
});

test("o perfil existente continua com endereço opcional", () => {
  const html = read("minha-conta/index.html");
  for (const id of [
    "accountPostalCode", "accountAddressNumber", "accountStreet",
    "accountNeighborhood", "accountCity", "accountState"
  ]) {
    const input = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
    assert.ok(input, "Campo ausente: " + id);
    assert.doesNotMatch(input[0], /\\srequired(?:\\s|>)/,
      "Campo de endereço não pode bloquear o perfil: " + id);
  }
  assert.match(html, /if \\(hasCompleteAddress\\)/);
  assert.match(html, /hasAnyAddress && !hasCompleteAddress/);
  assert.match(html, /accountUsername/);
});

test("fixture E2E do Supabase mantém username no perfil legado", () => {
  const fixture = read("tests/e2e/login-fixtures.sql");
  assert.match(fixture, /username text unique/);
});

test("checkout exige endereço somente para entrega e permite retirada agendada", () => {
  const clients = read("js/clientes.js");
  const index = read("index.html");
  const shop = read("loja.html");
  assert.match(clients, /exigirEnderecoEntrega = exigirEndereco && !modalidadeRetirada\\(\\)/);
  assert.match(clients, /\\? \\["customerName", "customerPhone", "customerCep", "customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"\\]/);
  assert.match(clients, /campoCep\\.required = !pickup/);
  assert.match(clients, /campoCep\\.setAttribute\\("aria-required", pickup \\? "false" : "true"\\)/);
  assert.doesNotMatch(clients, /required = exigirEnderecoEntrega[\\s\\S]*customerEmail/);
  assert.doesNotMatch(shop, /id="customerCepHelp">Opcional\\./);
  for (const [name, html] of [["index.html", index], ["loja.html", shop]]) {
    assert.match(html, /id="customerCep"[^>]*required/, name + " precisa exigir CEP para entrega");
    assert.match(html, /id="customerCepHelp">Obrigatório para entrega\\./, name + " precisa explicar o CEP");
    assert.match(html, /id="customerFulfillmentMode"/, name + " precisa oferecer retirada");
    assert.match(html, /value="pickup">Retirada agendada gratuita em Bauru/);
    assert.match(html, /id="customerPickupDate"/);
    assert.match(html, /id="customerPickupTime"/);
  }
});
