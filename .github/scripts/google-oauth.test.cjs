const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("login.html", "utf8");
const fixture = fs.readFileSync("tests/e2e/login-fixtures.sql", "utf8");
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] || "";

test("login apresenta o Google sem remover o acesso tradicional", () => {
  assert.match(html, /id="googleAuthButton"/);
  assert.match(html, /CONTINUAR COM GOOGLE/);
  assert.match(html, /id="loginForm"/);
  assert.match(html, /id="signupForm"/);
  assert.match(script, /signInWithOAuth\(\{[\s\S]*?provider: "google"/);
  assert.match(script, /signInWithPassword/);
  assert.match(script, /requestUsernameIdentity\("login"/);
});

test("novo usuário Google completa os mesmos dados essenciais depois da autenticação", () => {
  for (const id of ["googleUsername","googleFullName","googleBirthDate","googlePhone"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(script, /complete_google_account_setup/);
  assert.match(script, /account_setup_completed: true/);
  assert.match(script, /Conta existente com cadastro completo/);
  assert.match(script, /oauth_setup_completed_at/);
  assert.match(script, /provider === "google"/);
  assert.match(script, /requestUsernameIdentity\("availability", username\)/);
});

test("aviso de privacidade é obrigatório e autorizações opcionais começam desmarcadas", () => {
  assert.match(html, /id="googlePrivacyNoticeAccepted" type="checkbox" required/);
  assert.match(html, /href="\/privacidade.html"/);
  for (const id of ["googleExperienceConsent","googleAggregatedConsent","googleWhatsappMarketingConsent"]) {
    const input = html.match(new RegExp('<input id="' + id + '"[^>]*>'));
    assert.ok(input, "Consentimento ausente: " + id);
    assert.doesNotMatch(input[0], /\schecked(?:\s|>)/);
    assert.doesNotMatch(input[0], /\srequired(?:\s|>)/);
  }
  assert.match(script, /p_experience_personalization: \$\("googleExperienceConsent"\)\.checked/);
  assert.match(script, /p_aggregated_statistics: \$\("googleAggregatedConsent"\)\.checked/);
  assert.match(script, /p_whatsapp_marketing: \$\("googleWhatsappMarketingConsent"\)\.checked/);
});

test("fixture local inclui o campo consultado durante o login", () => {
  assert.match(fixture, /oauth_setup_completed_at timestamptz/);
});
