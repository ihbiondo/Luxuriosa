import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const consent = readFileSync("js/consentimento.js", "utf8");
const app = readFileSync("js/app.js", "utf8");
const home = readFileSync("index.html", "utf8");
const shop = readFileSync("loja.html", "utf8");

test("mantém confirmação 18+ e preferências de cookies", () => {
  assert.match(consent, /function ensureAgeGate/);
  assert.match(consent, /function createConsentPanel/);
  assert.match(consent, /function addPreferencesLink/);
  assert.match(consent, /function saveConsent/);
  assert.match(consent, /function clearOptionalAnalytics/);
  assert.match(consent, /if \(!consent\.analytics\) clearOptionalAnalytics\(\)/);
});

test("não agenda convites em tela cheia para Clube ou autorizações", () => {
  assert.doesNotMatch(consent, /scheduleDataInvitation|scheduleClubInvitation/);
  assert.doesNotMatch(consent, /lux-data-invite|lux-club-invite/);
});

test("remove o convite de cadastro não utilizado e mantém o Clube acessível no rodapé", () => {
  assert.doesNotMatch(home, /accountPromo/);
  assert.doesNotMatch(app, /configurarConviteCadastro|accountPromo/);
  assert.match(home, /href="clube\/">Clube de Vantagens/);
  assert.match(shop, /href="clube\/">Clube de Vantagens/);
});
