import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/lux-gestao-worker.mjs";

test("canonicalizes /lux-gestao to /lux-gestao/", async () => {
  const response = await worker.fetch(new Request("https://luxuriosa.com.br/lux-gestao"));
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://luxuriosa.com.br/lux-gestao/");
});

test("serves the published Pages app under the private production route", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response("<!doctype html><title>Lux-Gestão | Operação da loja</title>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  };

  try {
    const response = await worker.fetch(new Request("https://luxuriosa.com.br/lux-gestao/"));
    assert.equal(new URL(requestedUrl).pathname, "/previa/lux-gestao/");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Lux-Gestão \\| Operação da loja/);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("x-luxuriosa-worker-version"), "2026-11-11.1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not intercept unrelated or unknown paths", async () => {
  const response = await worker.fetch(new Request("https://luxuriosa.com.br/lux-gestao/rota-inexistente"));
  assert.equal(response.status, 404);
});
