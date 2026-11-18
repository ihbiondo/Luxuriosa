import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const ROOT = process.cwd();
const SCREENSHOT_DIR = process.env.RESPONSIVE_SCREENSHOT_DIR || "";
const REPORT_PATH = process.env.RESPONSIVE_REPORT_PATH || "";
const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 740 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-1024", width: 1024, height: 900 },
  { name: "desktop-1440", width: 1440, height: 960 }
];

const CORE_ROUTES = [
  "/", "/loja.html", "/loja/lingerie/", "/login.html", "/minha-conta/",
  "/meus-pedidos/", "/pagamento-retorno.html", "/acompanhar-pedido/",
  "/atendimento.html", "/faq.html", "/entregas/", "/privacidade.html",
  "/sobre.html", "/clube/", "/educacao/", "/educacao/interatividade/",
  "/experiencias/", "/experiencias/signos.html", "/portal/",
  "/portal/conquistas/", "/produtos/31-body-sensual-rendado-frente-unica.html"
];

const EXCLUDED_ROUTE = [
  /^\/previa\//,
  /^\/lux-central\//,
  /^\/lux-gestao(?:-pedidos)?\//,
  /^\/gestao-privada-/,
  /^\/442\//
];

function readSitemapRoutes() {
  const file = path.join(ROOT, "sitemap.xml");
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gis)]
    .map(match => {
      try {
        const url = new URL(match[1].replaceAll("&amp;", "&"));
        return url.pathname || "/";
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeRoute(route) {
  if (!route.startsWith("/")) return "/" + route;
  return route;
}

function isPublicRoute(route) {
  return !EXCLUDED_ROUTE.some(pattern => pattern.test(route));
}

function routeLabel(route) {
  return route === "/" ? "home" :
    route.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 70) || "home";
}

async function inspectLayout(page, route, viewport) {
  return page.evaluate(({ route, viewport }) => {
    const doc = document.documentElement;
    const body = document.body;
    const offenders = [...document.querySelectorAll("body *")].map(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const parent = element.parentElement;
      const parentStyle = parent ? getComputedStyle(parent) : null;
      const clippedByParent = parentStyle &&
        /(auto|scroll|hidden|clip)/.test(parentStyle.overflowX);
      if (clippedByParent || style.position === "fixed" || style.position === "absolute") return null;
      if (rect.width <= 0 || rect.height <= 0 || rect.left >= viewport.width) return null;
      if (rect.right > viewport.width + 2 || rect.left < -2) {
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          className: typeof element.className === "string" ? element.className.slice(0, 100) : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      }
      return null;
    }).filter(Boolean).slice(0, 8);

    return {
      route,
      viewport: viewport.width,
      clientWidth: doc.clientWidth,
      documentWidth: doc.scrollWidth,
      bodyWidth: body ? body.scrollWidth : 0,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1 ||
        (body && body.scrollWidth > doc.clientWidth + 1),
      hasViewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
      offenders
    };
  }, { route, viewport });
}

async function capture(page, name) {
  if (!SCREENSHOT_DIR) return;
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, name + ".png"),
    fullPage: true,
    animations: "disabled",
    timeout: 20000
  });
}

async function openPage(page, route, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const response = await page.goto(new URL(route, BASE_URL).href, {
    waitUntil: "domcontentloaded",
    timeout: 20000
  });
  await page.waitForTimeout(90);
  return response;
}

const routes = [...new Set([
  ...readSitemapRoutes(),
  ...CORE_ROUTES
].map(normalizeRoute).filter(isPublicRoute))].sort();

const result = {
  baseUrl: BASE_URL,
  checkedAt: new Date().toISOString(),
  routeCount: routes.length,
  viewportNames: VIEWPORTS.map(item => item.name),
  routeFailures: [],
  overflowFailures: [],
  missingViewportMeta: [],
  coreViewportResults: [],
  lingerieCards: [],
  modal: null,
  pageErrors: []
};

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
page.setDefaultTimeout(8000);
page.on("pageerror", error => {
  result.pageErrors.push({ url: page.url(), message: error.message.slice(0, 240) });
});

try {
  // Cobertura ampla: todas as rotas públicas indexadas no sitemap, em 360 px.
  const baseline = { name: "mobile-360", width: 360, height: 800 };
  for (const route of routes) {
    try {
      const response = await openPage(page, route, baseline);
      if (response && response.status() >= 400) {
        result.routeFailures.push({ route, status: response.status() });
        continue;
      }
      const layout = await inspectLayout(page, route, baseline);
      if (layout.horizontalOverflow) result.overflowFailures.push(layout);
      if (!layout.hasViewportMeta) result.missingViewportMeta.push(route);
    } catch (error) {
      result.routeFailures.push({ route, error: error.message.slice(0, 260) });
    }
  }

  // Cobertura detalhada nas páginas e jornadas centrais, do celular ao desktop.
  const coreRoutes = [...new Set(CORE_ROUTES)];
  for (const route of coreRoutes) {
    for (const viewport of VIEWPORTS) {
      try {
        const response = await openPage(page, route, viewport);
        const item = {
          route,
          viewport: viewport.name,
          status: response?.status() ?? null,
          ...(await inspectLayout(page, route, viewport))
        };
        result.coreViewportResults.push(item);
        if (item.status !== null && item.status >= 400) {
          result.routeFailures.push({ route, status: item.status, viewport: viewport.name });
        }
        if (item.horizontalOverflow) result.overflowFailures.push(item);
        if (viewport.width === 390) {
          await capture(page, routeLabel(route) + "-390");
        }
      } catch (error) {
        result.routeFailures.push({
          route,
          viewport: viewport.name,
          error: error.message.slice(0, 260)
        });
      }
    }
  }

  // Inspeção específica dos cards: preenchimento, carregamento e percentual estimado de corte.
  await openPage(page, "/loja/lingerie/", { name: "mobile-390", width: 390, height: 844 });
  await page.evaluate(() => {
    document.querySelectorAll("#grid img[loading='lazy']").forEach(img => { img.loading = "eager"; });
  });
  await page.waitForFunction(
    () => document.querySelectorAll("#grid .product-card-main-image").length > 0,
    null,
    { timeout: 15000 }
  );
  await page.waitForTimeout(900);
  result.lingerieCards = await page.locator("#grid .product-card-main-image").evaluateAll(images =>
    images.map(image => {
      const frame = image.closest(".product-img") || image.parentElement;
      const frameWidth = frame?.clientWidth || 0;
      const frameHeight = frame?.clientHeight || 0;
      const imageRatio = image.naturalWidth && image.naturalHeight
        ? image.naturalWidth / image.naturalHeight
        : 0;
      const frameRatio = frameWidth && frameHeight ? frameWidth / frameHeight : 0;
      const visibleRatio = imageRatio && frameRatio
        ? Math.min(imageRatio / frameRatio, frameRatio / imageRatio, 1)
        : 0;
      return {
        product: image.alt,
        src: image.getAttribute("src"),
        loaded: image.complete && image.naturalWidth > 0,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        frameWidth,
        frameHeight,
        objectFit: getComputedStyle(image).objectFit,
        objectPosition: getComputedStyle(image).objectPosition,
        estimatedCropPercent: visibleRatio ? Math.round((1 - visibleRatio) * 100) : null
      };
    })
  );

  const missingLingerieImages = result.lingerieCards.filter(item => !item.loaded);
  const wrongFit = result.lingerieCards.filter(item => item.objectFit !== "cover");
  if (missingLingerieImages.length) {
    result.imageFailures = missingLingerieImages;
  }
  if (wrongFit.length) {
    result.imageFitFailures = wrongFit;
  }

  // Abre um card para validar o modal vertical em telas estreitas.
  await page.evaluate(() => {
    document.querySelectorAll("#gate, #ageGate, .age-gate").forEach(element => {
      element.style.setProperty("display", "none", "important");
    });
  });
  await page.locator("#grid .product").first().click({ force: true });
  await page.waitForFunction(() => {
    const modal = document.querySelector("#modal");
    return modal && getComputedStyle(modal).display !== "none" &&
      getComputedStyle(modal).visibility !== "hidden";
  }, null, { timeout: 8000 }).catch(() => {});
  const modalState = await page.evaluate(() => {
    const modal = document.querySelector("#modal");
    const content = modal?.querySelector(".modal");
    const imageFrame = modal?.querySelector(".product-detail-image-frame");
    const image = modal?.querySelector(".product-detail-main-image");
    const rect = content?.getBoundingClientRect();
    return {
      visible: Boolean(modal && getComputedStyle(modal).display !== "none" &&
        getComputedStyle(modal).visibility !== "hidden" && rect?.width),
      width: rect ? Math.round(rect.width) : 0,
      height: rect ? Math.round(rect.height) : 0,
      viewportHeight: innerHeight,
      imageFrameWidth: imageFrame ? Math.round(imageFrame.getBoundingClientRect().width) : 0,
      imageFrameHeight: imageFrame ? Math.round(imageFrame.getBoundingClientRect().height) : 0,
      imageObjectFit: image ? getComputedStyle(image).objectFit : null,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    };
  });
  result.modal = modalState;
  await capture(page, "modal-lingerie-mobile-390");

  await openPage(page, "/loja/lingerie/", { name: "mobile-320", width: 320, height: 740 });
  await page.evaluate(() => {
    document.querySelectorAll("#gate, #ageGate, .age-gate").forEach(element => {
      element.style.setProperty("display", "none", "important");
    });
  });
  await page.locator("#grid .product").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(120);
  const modal320 = await inspectLayout(page, "/loja/lingerie/ (modal 320 px)", {
    name: "mobile-320", width: 320, height: 740
  });
  result.coreViewportResults.push({ ...modal320, state: "product-modal" });
  if (modal320.horizontalOverflow) result.overflowFailures.push(modal320);
  await capture(page, "modal-lingerie-mobile-320");

} finally {
  await browser.close();
}

const failed = result.routeFailures.length > 0 ||
  result.overflowFailures.length > 0 ||
  (result.imageFailures || []).length > 0 ||
  (result.imageFitFailures || []).length > 0;

console.log(JSON.stringify({
  summary: {
    routesChecked: result.routeCount,
    coreViewportChecks: result.coreViewportResults.length,
    routeFailures: result.routeFailures.length,
    horizontalOverflowFailures: result.overflowFailures.length,
    missingViewportMeta: result.missingViewportMeta.length,
    lingerieCards: result.lingerieCards.length,
    missingLingerieImages: (result.imageFailures || []).length,
    wrongImageFit: (result.imageFitFailures || []).length,
    modalVisible: result.modal?.visible ?? false,
    modalHeight: result.modal?.height ?? null,
    failed
  },
  lingerieCards: result.lingerieCards,
  routeFailures: result.routeFailures,
  overflowFailures: result.overflowFailures,
  missingViewportMeta: result.missingViewportMeta,
  modal: result.modal,
  pageErrors: result.pageErrors.slice(0, 30)
}, null, 2));

if (REPORT_PATH) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2));
}

assert.equal(result.routeFailures.length, 0, "Uma ou mais rotas públicas falharam.");
assert.equal(result.overflowFailures.length, 0, "Foram encontrados casos de rolagem horizontal.");
assert.equal((result.imageFailures || []).length, 0, "Uma ou mais imagens de lingerie não carregaram.");
assert.equal((result.imageFitFailures || []).length, 0, "Há imagens de cards que não usam object-fit: cover.");
assert.ok(result.modal?.visible, "O modal de produto não abriu durante a auditoria.");
assert.ok(
  result.modal.height <= result.modal.viewportHeight + 2,
  "O modal excede a altura do viewport mobile."
);

console.log("Auditoria responsiva Playwright: PASS.");
