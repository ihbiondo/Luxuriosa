import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

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

function listPublicHtml(directory = ".") {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "previa"].includes(entry.name)) continue;
      files.push(...listPublicHtml(join(directory, entry.name)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".html") {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

test("todas as páginas públicas usam a versão atual do script de privacidade", () => {
  const htmlFiles = listPublicHtml();
  const staleReferences = [];
  for (const path of htmlFiles) {
    const html = readFileSync(path, "utf8");
    const scripts = [...html.matchAll(/<script\b[^>]+src=["']([^"']*consentimento\.js[^"']*)["']/gi)];
    for (const [, source] of scripts) {
      if (!source.includes("v=20261119-sem-convites-automaticos-v1")) {
        staleReferences.push(path + " -> " + source);
      }
    }
  }
  assert.deepEqual(staleReferences, [], "Há páginas públicas carregando versão antiga do script de privacidade.");
});
