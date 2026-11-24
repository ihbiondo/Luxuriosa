const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const read = path => fs.readFileSync(path, "utf8");
const pages = ["login.html", "minha-conta/index.html"];

for (const page of pages) {
  test(page + ": cadastro inicial pede somente usuário, e-mail, WhatsApp e senha", () => {
    const html = read(page);
    const start = html.indexOf('<form id="signupForm"');
    const end = html.indexOf('<form id="resetForm"', start);
    assert.ok(start >= 0 && end > start, "Formulário de cadastro não encontrado");
    const form = html.slice(start, end);
    const ids = [...form.matchAll(/<input\\b[^>]*\\bid="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(ids, [
      "username",
      "signupEmail",
      "phone",
      "signupPassword",
      "confirmPassword"
    ]);
    assert.doesNotMatch(form, /id="(?:fullName|birthDate)"/);
    assert.doesNotMatch(form, /postalCode|addressNumber|addressStreet|addressNeighborhood|favoriteColor|favoriteCategory|PreferredPrice|PreferredOffer|Consent/);
    assert.match(form, /confirma que tem 18 anos ou mais/);
    assert.match(form, /Para aderir ao Clube gratuito, será necessário informar nome completo e data de nascimento/);
    assert.match(html, /requestUsernameIdentity\\("availability", username\\)/);
  });

  test(page + ": cadastro inicial envia somente os dados básicos ao Supabase", () => {
    const html = read(page);
    const start = html.indexOf('signupForm.addEventListener("submit"');
    const marker = 'message("Cadastro recebido! Enviamos um link de confirmação para seu e-mail. Abra a mensagem para ativar sua conta e concluir o acesso.");';
    const markerPosition = html.indexOf(marker, start);
    assert.ok(start >= 0 && markerPosition > start, "Handler de cadastro não encontrado");
    const end = html.indexOf("\\n    });", markerPosition);
    assert.ok(end > markerPosition, "Final do handler de cadastro não encontrado");
    const handler = html.slice(start, end);
    assert.doesNotMatch(handler, /\\$\\("fullName"\\)|\\$\\("birthDate"\\)|firstName|full_name:|birth_date:/);
    assert.match(handler, /display_name: username/);
    assert.match(handler, /phone/);
    assert.match(handler, /username/);
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
  assert.match(clients, /\? \["customerName", "customerPhone", "customerEmail", "customerCep", "customerStreet", "customerNumber", "customerDistrict", "customerCity", "customerState"\]/);
  assert.match(clients, /campoCep\.required = !pickup/);
  assert.match(clients, /campoCep\.setAttribute\("aria-required", pickup \? "false" : "true"\)/);
  assert.doesNotMatch(shop, /id="customerCepHelp">Opcional\./);
  for (const [name, html] of [["index.html", index], ["loja.html", shop]]) {
    assert.match(html, /id="customerCep"[^>]*required/, name + " precisa exigir CEP no formulário de entrega");
    assert.match(html, /id="customerCepHelp">Obrigatório para entrega\./, name + " precisa explicar quando o CEP é exigido");
  }
  for (const [name, html] of [["index.html", index], ["loja.html", shop]]) {
    assert.match(html, /id="customerFulfillmentMode"/, name + " precisa oferecer modalidade de retirada");
    assert.match(html, /value="pickup">Retirada agendada gratuita em Bauru/);
    assert.match(html, /id="customerPickupDate"/);
    assert.match(html, /id="customerPickupTime"/);
  }
});
