import assert from "node:assert/strict";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const base = new URL(BASE_URL);
const failures = [];
const localTargets = new Map();

async function request(url, method = "GET") {
  return fetch(url, { method, redirect: "follow" });
}

const sitemapResponse = await request(new URL("/sitemap.xml", base).href);
assert.equal(sitemapResponse.status, 200, "sitemap.xml precisa responder 200");
const sitemap = await sitemapResponse.text();
const pages = [...sitemap.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map((match) => match[1]);

assert.ok(pages.length > 0, "Sitemap sem páginas para verificar");

for (const canonical of pages) {
  let pageUrl;
  try {
    const parsed = new URL(canonical);
    assert.equal(parsed.hostname, "luxuriosa.com.br");
    pageUrl = new URL(parsed.pathname + parsed.search, base);
  } catch (error) {
    failures.push({ source: canonical, target: canonical, reason: "URL inválida no sitemap" });
    continue;
  }

  let response;
  try {
    response = await request(pageUrl.href);
  } catch (error) {
    failures.push({ source: canonical, target: pageUrl.href, reason: String(error) });
    continue;
  }

  if (!response.ok) {
    failures.push({ source: canonical, target: pageUrl.href, reason: "HTTP " + response.status });
    continue;
  }

  const html = await response.text();
  const baseTag = html.match(/<base\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  const documentBase = baseTag ? new URL(baseTag[1], pageUrl) : pageUrl;
  const attributes = /\b(?:href|src|action|poster|data-src)=["']([^"']+)["']/gi;
  let match;

  while ((match = attributes.exec(html))) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith("#") || /^(?:mailto|tel|javascript|data|blob|sms):/i.test(raw)) continue;

    let target;
    try {
      target = new URL(raw, documentBase);
    } catch (_) {
      failures.push({ source: canonical, target: raw, reason: "Referência local inválida" });
      continue;
    }

    // Links absolutos do próprio domínio também devem ser testados contra
    // a cópia local, sem acessar a versão de produção durante o workflow.
    if (target.hostname === "luxuriosa.com.br" || target.hostname === "www.luxuriosa.com.br") {
      target = new URL(target.pathname + target.search, base);
    } else if (target.origin !== base.origin) {
      continue;
    }
    target.search = "";
    target.hash = "";
    const key = target.href;
    if (!localTargets.has(key)) localTargets.set(key, canonical);
  }
}

const targets = [...localTargets.entries()];
for (let i = 0; i < targets.length; i += 12) {
  const batch = targets.slice(i, i + 12);
  const results = await Promise.all(batch.map(async ([target, source]) => {
    try {
      const response = await request(target, "HEAD");
      if (!response.ok) return { source, target, reason: "HTTP " + response.status };
      return null;
    } catch (error) {
      return { source, target, reason: String(error) };
    }
  }));
  failures.push(...results.filter(Boolean));
}

console.log(JSON.stringify({
  pagesChecked: pages.length,
  localTargetsChecked: localTargets.size,
  failures
}, null, 2));

assert.equal(failures.length, 0, "Links e arquivos locais quebrados foram encontrados.");
