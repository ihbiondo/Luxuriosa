import assert from "node:assert/strict";
import workerModule from "../cloudflare/lux-gestao-worker.mjs";

const SOURCE_URL = "https://raw.githubusercontent.com/ihbiondo/Luxuriosa/main/previa/lux-gestao/index.html";
const originalFetch = globalThis.fetch;
let upstreamCalls = [];

async function callWorker(url, init = {}) {
  return workerModule.fetch(new Request(url, init), {});
}

try {
  globalThis.fetch = async (input, init = {}) => {
    upstreamCalls.push({ url: String(input), init });
    return new Response("<!doctype html><title>Lux-Gestão</title>", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  };

  const response = await callWorker("https://attacker.invalid/lux-gestao/");
  assert.equal(response.status, 200, "valid admin route should return the upstream page");
  assert.equal(await response.text(), "<!doctype html><title>Lux-Gestão</title>");
  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].url, SOURCE_URL, "upstream origin must not depend on incoming Host");
  assert.equal(upstreamCalls[0].init.redirect, "error", "upstream redirects must be rejected");
  assert.equal(upstreamCalls[0].init.method, "GET");
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet");

  const head = await callWorker("https://attacker.invalid/lux-gestao/", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body, null, "HEAD must not return a response body");
  assert.equal(upstreamCalls.at(-1).init.method, "HEAD");

  const shortRoute = await callWorker("https://attacker.invalid/lux-gestao?redirect=https://evil.invalid");
  assert.equal(shortRoute.status, 308);
  assert.equal(shortRoute.headers.get("location"), "https://luxuriosa.com.br/lux-gestao/", "redirect destination must use the canonical host and discard query parameters");

  const beforePost = upstreamCalls.length;
  const post = await callWorker("https://attacker.invalid/lux-gestao/", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(upstreamCalls.length, beforePost, "unsupported methods must not reach the upstream");

  const missingRoute = await callWorker("https://attacker.invalid/internal");
  assert.equal(missingRoute.status, 404);
  assert.equal(upstreamCalls.length, beforePost, "unknown routes must not reach the upstream");

  globalThis.fetch = async () => { throw new Error("simulated network failure"); };
  const gatewayError = await callWorker("https://luxuriosa.com.br/lux-gestao/");
  assert.equal(gatewayError.status, 502);

  globalThis.fetch = async () => new Response("not found", { status: 404 });
  const unavailable = await callWorker("https://luxuriosa.com.br/lux-gestao/");
  assert.equal(unavailable.status, 503);
  assert.equal(await unavailable.text(), "Não foi possível carregar a versão publicada do Lux-Gestão.");

  console.log("Lux-Gestão Worker tests passed: fixed origin, host isolation, redirects, methods, route allowlist, response headers and upstream failures.");
} finally {
  globalThis.fetch = originalFetch;
}
