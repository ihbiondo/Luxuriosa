import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const sitemap = readFileSync("sitemap.xml", "utf8");
const catalog = JSON.parse(readFileSync("data/produtos.json", "utf8"));
const robots = readFileSync("robots.txt", "utf8");
const urls = [...sitemap.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map((match) => match[1]);

function pagePathFromUrl(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:", value);
  assert.equal(url.hostname, "luxuriosa.com.br", value);
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") return "index.html";
  if (pathname.endsWith("/")) return pathname.slice(1) + "index.html";
  return pathname.slice(1);
}

function robotsDirective(html, page) {
  const tag = html.match(/<meta\b[^>]*name=["']robots["'][^>]*>/i);
  assert.ok(tag, page + " precisa declarar a diretiva robots");
  const content = tag[0].match(/content=["']([^"']+)["']/i);
  assert.ok(content, page + " precisa declarar o conteúdo da diretiva robots");
  return content[1].toLowerCase().split(/[\s,]+/).filter(Boolean);
}

test("sitemap contém URLs públicas únicas, canônicas e existentes", () => {
  assert.ok(urls.length > 0, "O sitemap deve conter URLs");
  assert.equal(new Set(urls).size, urls.length, "O sitemap não pode repetir URLs");
  for (const url of urls) {
    assert.ok(existsSync(pagePathFromUrl(url)), "Arquivo do sitemap não existe: " + url);
  }
  for (const path of [
    "https://luxuriosa.com.br/",
    "https://luxuriosa.com.br/loja.html",
    "https://luxuriosa.com.br/loja/lingerie/",
    "https://luxuriosa.com.br/entregas/",
    "https://luxuriosa.com.br/atendimento.html",
    "https://luxuriosa.com.br/faq.html"
  ]) {
    assert.ok(urls.includes(path), "Página pública importante ausente do sitemap: " + path);
  }

  assert.equal(catalog.produtos.length, 47);
  for (const product of catalog.produtos) {
    assert.ok(product.pagina, "Produto sem página individual: " + product.id);
    const canonical = "https://luxuriosa.com.br/" + product.pagina;
    assert.ok(urls.includes(canonical), "Página de produto ausente do sitemap: " + canonical);
    const html = readFileSync(product.pagina, "utf8");
    const canonicalTags = [...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)];
    assert.equal(canonicalTags.length, 1, "Cada produto deve ter exatamente um canonical: " + product.pagina);
    assert.ok(canonicalTags[0][0].includes('href="' + canonical + '"'),
      "Canonical do produto não corresponde ao catálogo: " + product.pagina);
    assert.ok(robotsDirective(html, product.pagina).includes("index"),
      "Páginas de produto precisam estar disponíveis para indexação: " + product.pagina);

    const productImages = [
      product.imagem,
      ...(Array.isArray(product.imagens) ? product.imagens : [])
    ].filter((image) => typeof image === "string" && image.trim() &&
      !image.startsWith("http://") && !image.startsWith("https://"));
    for (const image of productImages) {
      const imagePath = image.startsWith("./") ? image.slice(2) : image;
      assert.ok(existsSync(imagePath), "Imagem cadastrada não existe: " + imagePath);
    }
  }
});

test("páginas de conta, Clube e gestão não são listadas e declaram noindex", () => {
  const privatePages = [
    "clube.html",
    "clube/index.html",
    "login.html",
    "minha-conta/index.html",
    "meus-pedidos/index.html",
    "portal/index.html",
    "portal/conquistas/index.html",
    "442/index.html",
    "lux-gestao/index.html",
    "lux-gestao-pedidos/index.html",
    "lux-central/index.html",
    "acompanhar-pedido/index.html",
    "gestao-privada-8f2c6d.html",
    "avaliar/index.html",
    "previa/index.html",
    "previa/checkout.html",
    "previa/login.html",
    "previa/pagamento-retorno.html",
    "previa/lux-central/index.html",
    "previa/lux-gestao/index.html",
    "previa/lux-gestao-pedidos/index.html"
  ];

  for (const page of privatePages) {
    const html = readFileSync(page, "utf8");
    const route = page.endsWith("/index.html")
      ? "/" + page.slice(0, -"index.html".length)
      : "/" + page;
    assert.ok(!urls.some((url) => new URL(url).pathname === route),
      "Página interna não pode entrar no sitemap: " + page);
    assert.ok(robotsDirective(html, page).includes("noindex"),
      "Página interna precisa ser noindex: " + page);
  }
});

test("robots.txt aponta para o sitemap público", () => {
  assert.match(robots, /Sitemap:\s*https:\/\/luxuriosa\.com\.br\/sitemap\.xml/i);
  assert.match(robots, /User-agent:\s*\*/i);
});
