const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const html = fs.readFileSync("login.html", "utf8");

test("a tela antiga de login e Google não oferece autenticação nem cadastro", () => {
  assert.match(html, /Você não precisa criar uma conta/);
  assert.match(html, /href="\/loja.html"/);
  assert.doesNotMatch(html, /googleAuthButton|CONTINUAR COM GOOGLE|signupForm|loginForm|signInWithOAuth|signInWithPassword|supabase-js/);
  assert.doesNotMatch(html, /<form|type="password"/);
});
