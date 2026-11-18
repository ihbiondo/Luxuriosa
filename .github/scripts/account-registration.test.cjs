const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const read = path => fs.readFileSync(path, "utf8");
const pages = ["login.html", "minha-conta/index.html"];

for (const page of pages) {
  test(page + ": cadastro inicial contém somente usuário e os seis dados essenciais", () => {
    const html = read(page);
    const start = html.indexOf('<form id="signupForm"');
    const end = html.indexOf('<form id="resetForm"', start);
    assert.ok(start >= 0 && end > start, "Formulário de cadastro não encontrado");
    const form = html.slice(start, end);
    const ids = [...form.matchAll(/<input\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(ids, [
      "username",
      "fullName",
      "birthDate",
      "phone",
      "signupEmail",
      "signupPassword",
      "confirmPassword"
    ]);
    assert.doesNotMatch(form, /postalCode|addressNumber|addressStreet|addressNeighborhood|favoriteColor|favoriteCategory|PreferredPrice|PreferredOffer|Consent/);
    assert.match(form, /id="username"/);
    assert.match(html, /requestUsernameIdentity\("availability", username\)/);
  });

  test(page + ": endereço permanece opcional dentro do perfil da conta", () => {
    const html = read(page);
    for (const id of ["accountPostalCode", "accountAddressNumber", "accountStreet", "accountNeighborhood", "accountCity", "accountState"]) {
      const input = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
      assert.ok(input, "Campo ausente: " + id);
      assert.doesNotMatch(input[0], /\srequired(?:\s|>)/, "Campo de endereço não pode bloquear o perfil: " + id);
    }
    assert.match(html, /if \(hasCompleteAddress\)/);
    assert.match(html, /hasAnyAddress && !hasCompleteAddress/);
    assert.match(html, /accountUsername/);
  });
}

test("fixture E2E do Supabase inclui username no perfil", () => {
  const fixture = read("tests/e2e/login-fixtures.sql");
  assert.match(fixture, /username text unique/);
});

test("login aceita usuário ou e-mail e preserva login por e-mail", () => {
  const html = read("login.html");
  assert.match(html, /E-mail ou usuário/);
  assert.match(html, /signInWithPassword\(\{[\s\S]{0,160}email: identifier\.toLowerCase\(\)/);
  assert.match(html, /requestUsernameIdentity\("login"/);
  assert.match(html, /supabase\.auth\.setSession/);
  assert.match(html, /Informe seu e-mail cadastrado para recuperar a senha/);
});

test("checkout só exige endereço na entrega e libera retirada agendada", () => {
  const clients = read("js/clientes.js");
  const index = read("index.html");
  const shop = read("loja.html");
  assert.match(clients, /exigirEnderecoEntrega = exigirEndereco && !modalidadeRetirada\(\)/);
  assert.match(clients, /"customerCep", "customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"/);
  for (const [name, html] of [["index.html", index], ["loja.html", shop]]) {
    assert.match(html, /id="customerFulfillmentMode"/, name + " precisa oferecer modalidade de retirada");
    assert.match(html, /value="pickup">Retirada agendada gratuita em Bauru/);
    assert.match(html, /id="customerPickupDate"/);
    assert.match(html, /id="customerPickupTime"/);
  }
});
