import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const productCss = readFileSync("css/produto.css", "utf8");
const productDirectory = "produtos";
const productPages = readdirSync(productDirectory)
  .filter((name) => name.toLowerCase().endsWith(".html"))
  .sort();

test("todas as páginas de produto usam a folha compartilhada com cache versionado", () => {
  assert.equal(productPages.length, 47, "A quantidade de páginas individuais mudou; revisar o escopo deste teste.");
  const failures = [];
  for (const name of productPages) {
    const html = readFileSync(join(productDirectory, name), "utf8");
    if (!html.includes('../css/produto.css?v=20261119-produto-css-v1')) {
      failures.push(name + ": referência de css/produto.css ausente ou sem versão atual");
    }
  }
  assert.deepEqual(failures, []);
});

test("páginas de produto não repetem CSS inline", () => {
  const failures = productPages.filter((name) => {
    const html = readFileSync(join(productDirectory, name), "utf8");
    return /<style\b/i.test(html);
  });
  assert.deepEqual(failures, [], "Há páginas individuais mantendo blocos CSS inline.");
});

test("a folha compartilhada contém as regras retiradas dos blocos antigos", () => {
  assert.match(productCss, /\.product-detail-page \.product-detail-description p/);
  assert.match(productCss, /\.product-detail-page \.product-detail-description ul/);
  assert.match(productCss, /\.product-detail-page \.product-status/);
});
