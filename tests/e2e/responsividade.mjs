import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const ROOT = process.cwd();
const SCREENSHOT_DIR = process.env.RESPONSIVE_SCREENSHOT_DIR || "";
const catalogData = JSON.parse(fs.readFileSync(path.join(ROOT, "data/produtos.json"), "utf8"));
const expectedCatalogCards = Array.isArray(catalogData.produtos) ? catalogData.produtos.length : 0;
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
      // O body pode ter scrollWidth maior por causa da gaveta fixa fechada.
      // O que determina rolagem horizontal real da página é o scrollWidth do documento.
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
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

async function dismissAgeGate(page) {
  await page.evaluate(() => {
    ["#gate", "#ageGate", "#ageGateOverlay"].forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.style.setProperty("display", "none", "important");
      });
    });
  });
}

async function openPage(page, route, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const response = await page.goto(new URL(route, BASE_URL).href, {
    waitUntil: "domcontentloaded",
    timeout: 20000
  });
  await dismissAgeGate(page);
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
  catalogCards: [],
  catalogImageFailures: [],
  catalogImageFitFailures: [],
  catalogCardFrameFailures: [],
  lingerieCards: [],
  catalogViewport320: null,
  modal: null,
  modalGallery: null,
  pageErrors: [],
  productGalleries: [],
  productGalleryFailures: []
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

  // Percorre a vitrine geral para acionar o carregamento lazy de todas as imagens.
  // A captura fullPage, sozinha, não rola a página e pode deixar cards abaixo da dobra em placeholder.
  await openPage(page, "/loja.html", { name: "mobile-390", width: 390, height: 844 });
  await page.waitForFunction(
    expected => document.querySelectorAll("#grid .product").length === expected &&
      document.querySelectorAll("#grid .product-card-main-image").length === expected,
    expectedCatalogCards,
    { timeout: 15000 }
  );
  const catalogImages = page.locator("#grid .product-card-main-image");
  for (let index = 0; index < expectedCatalogCards; index++) {
    const image = catalogImages.nth(index);
    await image.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      indexAtual => {
        const current = document.querySelectorAll("#grid .product-card-main-image")[indexAtual];
        return Boolean(current && current.complete);
      },
      index,
      { timeout: 10000 }
    );
    await image.evaluate(async current => {
      if (current.complete && current.naturalWidth > 0 && current.decode) {
        await current.decode().catch(() => {});
      }
    });
  }
  result.catalogCards = await catalogImages.evaluateAll(images =>
    images.map(image => {
      const frame = image.closest(".product-img") || image.parentElement;
      return {
        product: image.alt,
        src: image.getAttribute("src"),
        loaded: image.complete && image.naturalWidth > 0,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        frameWidth: frame?.clientWidth || 0,
        frameHeight: frame?.clientHeight || 0,
        objectFit: getComputedStyle(image).objectFit
      };
    })
  );
  result.catalogImageFailures = result.catalogCards.filter(item => !item.loaded);
  result.catalogImageFitFailures = result.catalogCards.filter(item => item.objectFit !== "cover");
  result.catalogCardFrameFailures = result.catalogCards.filter(item => item.frameWidth <= 0 || item.frameHeight <= 0);
  await capture(page, "catalogo-completo-mobile-390");

  // Confere também se os quadros dos cards continuam utilizáveis na menor largura.
  await page.setViewportSize({ width: 320, height: 740 });
  result.catalogViewport320 = await inspectLayout(page, "/loja.html (cards 320 px)", {
    name: "mobile-320", width: 320, height: 740
  });
  if (result.catalogViewport320.horizontalOverflow) {
    result.overflowFailures.push(result.catalogViewport320);
  }

  // Abre o menu mobile e compara Minha conta com um item comum de navegação.
  await openPage(page, "/", { name: "mobile-390", width: 390, height: 844 });
  await page.locator("#burger").click();
  await page.locator("#navlinks.open").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(300);
  result.mobileMenu = await page.evaluate(() => {
    const account = document.querySelector("#navlinks .nav-drawer-account-area > .nav-account-primary");
    // Minha conta é um link principal; a referência equivalente é Loja, não Atendimento (item de grupo).
    const regular = document.querySelector("#navlinks > .nav-primary-link.nav-link-shop");
    const icon = account?.querySelector(".nav-link-icon");
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        width: Math.round(box.width),
        height: Math.round(box.height)
      };
    };
    const accountStyle = account ? getComputedStyle(account) : null;
    const regularStyle = regular ? getComputedStyle(regular) : null;
    const iconStyle = icon ? getComputedStyle(icon) : null;
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      account: rect(account),
      regular: rect(regular),
      accountDisplay: accountStyle?.display || null,
      regularDisplay: regularStyle?.display || null,
      accountFontSize: accountStyle?.fontSize || null,
      regularFontSize: regularStyle?.fontSize || null,
      accountFontWeight: accountStyle?.fontWeight || null,
      regularFontWeight: regularStyle?.fontWeight || null,
      accountBackground: accountStyle?.backgroundColor || null,
      accountBorderRadius: accountStyle?.borderRadius || null,
      iconDisplay: iconStyle?.display || null,
      iconWidth: icon ? Math.round(icon.getBoundingClientRect().width) : 0,
      iconHeight: icon ? Math.round(icon.getBoundingClientRect().height) : 0
    };
  });
  result.mobileMenu.accountRowAligned = Boolean(
    result.mobileMenu.account &&
    result.mobileMenu.regular &&
    result.mobileMenu.accountDisplay === "flex" &&
    result.mobileMenu.regularDisplay === "flex" &&
    Math.abs(result.mobileMenu.account.height - result.mobileMenu.regular.height) <= 1 &&
    result.mobileMenu.accountFontSize === result.mobileMenu.regularFontSize &&
    result.mobileMenu.accountFontWeight === result.mobileMenu.regularFontWeight &&
    ["grid", "inline-grid"].includes(result.mobileMenu.iconDisplay) &&
    result.mobileMenu.iconWidth === 25 &&
    result.mobileMenu.iconHeight === 25 &&
    result.mobileMenu.document <= result.mobileMenu.viewport + 1
  );
  await capture(page, "menu-mobile-aberto-390");

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
  await page.waitForFunction(
    () => [...document.querySelectorAll("#grid .product-card-main-image")].length === 14,
    null,
    { timeout: 15000 }
  );
  await page.evaluate(async () => {
    const images = [...document.querySelectorAll("#grid .product-card-main-image")];
    await Promise.all(images.map(async image => {
      image.loading = "eager";
      if (!image.complete || image.naturalWidth === 0) {
        await new Promise(resolve => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }
      if (image.complete && image.naturalWidth > 0 && image.decode) {
        await image.decode().catch(() => {});
      }
    }));
  });
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
        portraitCard: frame?.classList.contains("product-img--portrait") ?? false,
        objectFit: getComputedStyle(image).objectFit,
        objectPosition: getComputedStyle(image).objectPosition,
        estimatedCropPercent: visibleRatio ? Math.round((1 - visibleRatio) * 100) : null
      };
    })
  );

  await capture(page, "lingerie-cards-mobile-390");

  const missingLingerieImages = result.lingerieCards.filter(item => !item.loaded);
  const wrongFit = result.lingerieCards.filter(item => item.objectFit !== "cover");
  const missingPortraitClass = result.lingerieCards.filter(item => !item.portraitCard);
  result.lingerieCropWarnings = result.lingerieCards.filter(item =>
    item.estimatedCropPercent !== null && item.estimatedCropPercent > 20
  );
  if (missingLingerieImages.length) {
    result.imageFailures = missingLingerieImages;
  }
  if (wrongFit.length) {
    result.imageFitFailures = wrongFit;
  }
  if (missingPortraitClass.length) {
    result.portraitCardFailures = missingPortraitClass;
  }

  // Registra a geometria da tabela de entregas na menor largura testada.
  await openPage(page, "/entregas/", { name: "mobile-320", width: 320, height: 740 });
  result.deliveryTable320 = await page.evaluate(() => {
    const table = document.querySelector(".delivery-comparison");
    const wrapper = document.querySelector(".delivery-table-wrap");
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width) };
    };
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      wrapper: rect(wrapper),
      table: rect(table),
      rows: [...(table?.querySelectorAll("tbody tr") || [])].map(row => ({
        row: rect(row),
        heading: rect(row.querySelector("th"))
      }))
    };
  });
  await capture(page, "entregas-mobile-320");

  // Volta à vitrine antes de abrir o modal; a página de entregas não possui cards.
  await openPage(page, "/loja/lingerie/", { name: "mobile-390", width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelectorAll("#grid .product").length > 0,
    null,
    { timeout: 15000 }
  );

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
      imageFrameRatio: imageFrame && imageFrame.getBoundingClientRect().height
        ? Number((imageFrame.getBoundingClientRect().width / imageFrame.getBoundingClientRect().height).toFixed(3))
        : 0,
      imageObjectFit: image ? getComputedStyle(image).objectFit : null,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    };
  });
  result.modal = modalState;

  // As miniaturas do modal estão na tela: exige que todas terminem de carregar antes da captura.
  await page.waitForFunction(() => {
    const imagens = [...document.querySelectorAll("#modal .product-gallery-thumb img")];
    return imagens.length > 1 && imagens.every(img => img.complete && img.naturalWidth > 0);
  }, null, { timeout: 12000 });
  const modalThumbs = page.locator("#modal .product-gallery-thumb");
  const modalThumbCount = await modalThumbs.count();
  const modalMainImage = page.locator("#modal .product-detail-main-image");
  const modalSecondThumbSrc = await modalThumbs.nth(1).locator("img").getAttribute("src");
  await modalThumbs.nth(1).click();
  result.modalGallery = await page.evaluate(() => {
    const thumbs = [...document.querySelectorAll("#modal .product-gallery-thumb img")];
    const selected = document.querySelector("#modal .product-gallery-thumb[aria-pressed='true']");
    const main = document.querySelector("#modal .product-detail-main-image");
    return {
      count: thumbs.length,
      loaded: thumbs.filter(img => img.complete && img.naturalWidth > 0).length,
      selectedCount: document.querySelectorAll("#modal .product-gallery-thumb[aria-pressed='true']").length,
      mainSrc: main?.getAttribute("src") || null,
      selectedSrc: selected?.querySelector("img")?.getAttribute("src") || null
    };
  });
  result.modalGallery.countMatchesExpected = modalThumbCount === result.modalGallery.count;
  result.modalGallery.changesMainImage = result.modalGallery.mainSrc === modalSecondThumbSrc &&
    result.modalGallery.selectedSrc === modalSecondThumbSrc;
  await capture(page, "modal-lingerie-mobile-390");

  await openPage(page, "/loja/lingerie/", { name: "mobile-320", width: 320, height: 740 });
  await page.waitForFunction(
    () => document.querySelectorAll("#grid .product").length > 0,
    null,
    { timeout: 15000 }
  );
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

  // Valida a galeria nas páginas individuais para todos os produtos com fotos extras no catálogo.
  const productsWithGallery = catalogData.produtos.filter(product =>
    Array.isArray(product.imagens) && product.imagens.length > 1 && product.pagina
  );
  for (const product of productsWithGallery) {
    const route = product.pagina.charAt(0) === "/" ? product.pagina : "/" + product.pagina;
    try {
      await openPage(page, route, { name: "mobile-390", width: 390, height: 844 });
      const gallery = page.locator(".product-detail-gallery");
      await gallery.waitFor({ state: "visible", timeout: 10000 });
      const thumbCount = await gallery.locator("button").count();
      const mainImage = page.locator(".product-detail-image > img").first();
      const initialSrc = await mainImage.getAttribute("src");
      let changedAfterClick = false;
      if (thumbCount > 1) {
        const secondThumb = gallery.locator("button").nth(1);
        const expectedSrc = await secondThumb.locator("img").getAttribute("src");
        await secondThumb.click();
        changedAfterClick = (await mainImage.getAttribute("src")) === expectedSrc;
      }
      const item = { id: product.id, route, expected: product.imagens.length, actual: thumbCount, changedAfterClick, initialSrc };
      result.productGalleries.push(item);
      if (thumbCount !== product.imagens.length || !changedAfterClick) {
        result.productGalleryFailures.push(item);
      }
      await capture(page, "produto-galeria-" + product.id + "-390");
    } catch (error) {
      const item = { id: product.id, route, error: error.message.slice(0, 220) };
      result.productGalleries.push(item);
      result.productGalleryFailures.push(item);
    }
  }

} finally {
  await browser.close();
}

const failed = result.routeFailures.length > 0 ||
  result.overflowFailures.length > 0 ||
  (result.imageFailures || []).length > 0 ||
  (result.imageFitFailures || []).length > 0 ||
  (result.portraitCardFailures || []).length > 0 ||
  result.catalogImageFailures.length > 0 ||
  result.catalogImageFitFailures.length > 0 ||
  result.catalogCardFrameFailures.length > 0 ||
  result.productGalleryFailures.length > 0 ||
  !result.modalGallery?.countMatchesExpected ||
  result.modalGallery?.loaded !== result.modalGallery?.count ||
  !result.modalGallery?.changesMainImage;

console.log(JSON.stringify({
  summary: {
    routesChecked: result.routeCount,
    coreViewportChecks: result.coreViewportResults.length,
    routeFailures: result.routeFailures.length,
    horizontalOverflowFailures: result.overflowFailures.length,
    missingViewportMeta: result.missingViewportMeta.length,
    catalogCards: result.catalogCards.length,
    missingCatalogImages: result.catalogImageFailures.length,
    catalogImageFitFailures: result.catalogImageFitFailures.length,
    catalogCardFrameFailures: result.catalogCardFrameFailures.length,
    lingerieCards: result.lingerieCards.length,
    missingLingerieImages: (result.imageFailures || []).length,
    wrongImageFit: (result.imageFitFailures || []).length,
    portraitCardFailures: (result.portraitCardFailures || []).length,
    lingerieCropWarnings: (result.lingerieCropWarnings || []).length,
    mobileMenuAccountAligned: result.mobileMenu?.accountRowAligned ?? false,
    modalVisible: result.modal?.visible ?? false,
    modalHeight: result.modal?.height ?? null,
    productGalleriesChecked: result.productGalleries.length,
    productGalleryFailures: result.productGalleryFailures.length,
    modalThumbnails: result.modalGallery?.count ?? 0,
    modalThumbnailsLoaded: result.modalGallery?.loaded ?? 0,
    modalThumbnailSwitchWorks: result.modalGallery?.changesMainImage ?? false,
    failed
  },
  catalogCards: result.catalogCards,
  catalogImageFailures: result.catalogImageFailures,
  catalogImageFitFailures: result.catalogImageFitFailures,
  catalogCardFrameFailures: result.catalogCardFrameFailures,
  catalogViewport320: result.catalogViewport320,
  lingerieCards: result.lingerieCards,
  lingerieCropWarnings: result.lingerieCropWarnings,
  deliveryTable320: result.deliveryTable320,
  routeFailures: result.routeFailures,
  overflowFailures: result.overflowFailures,
  missingViewportMeta: result.missingViewportMeta,
  modal: result.modal,
  modalGallery: result.modalGallery,
  pageErrors: result.pageErrors.slice(0, 30)
}, null, 2));

if (REPORT_PATH) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2));
}

assert.equal(result.routeFailures.length, 0, "Uma ou mais rotas públicas falharam.");
assert.equal(result.overflowFailures.length, 0, "Foram encontrados casos de rolagem horizontal.");
assert.equal(result.catalogCards.length, expectedCatalogCards, "A auditoria deve conferir todos os cards do catálogo.");
assert.equal(result.catalogImageFailures.length, 0, "Uma ou mais imagens do catálogo geral não carregaram.");
assert.equal(result.catalogImageFitFailures.length, 0, "Há imagens do catálogo geral sem object-fit: cover.");
assert.equal(result.catalogCardFrameFailures.length, 0, "Há cards sem quadro de imagem com dimensões válidas.");
assert.equal((result.imageFailures || []).length, 0, "Uma ou mais imagens de lingerie não carregaram.");
assert.equal((result.imageFitFailures || []).length, 0, "Há imagens de cards que não usam object-fit: cover.");
assert.equal((result.portraitCardFailures || []).length, 0, "Cards de lingerie não receberam o formato vertical.");
assert.equal(result.lingerieCards.length, 14, "A auditoria deve conferir as 14 lingeries do catálogo.");
assert.ok(result.mobileMenu?.accountRowAligned,
  "Minha conta deve alinhar-se como item comum do menu mobile: " + JSON.stringify(result.mobileMenu));
assert.ok(result.modal?.visible, "O modal de produto não abriu durante a auditoria.");
assert.ok(
  result.modal.height <= result.modal.viewportHeight * 0.88 + 2,
  "O modal excede 88% da altura do viewport mobile."
);
assert.ok(result.modal.imageFrameWidth <= result.modal.viewportWidth * 0.58 + 2,
  "A imagem principal do modal ultrapassa 58% da largura do celular.");
assert.ok(result.modal.imageFrameRatio >= 0.70 && result.modal.imageFrameRatio <= 0.80,
  "A imagem principal do modal não manteve o enquadramento vertical 3:4.");
assert.equal(result.productGalleryFailures.length, 0, "Uma ou mais páginas individuais não exibem/trocam todas as fotos cadastradas.");
assert.ok(result.modalGallery && result.modalGallery.count > 1, "O modal não exibiu uma galeria de miniaturas.");
assert.equal(result.modalGallery.loaded, result.modalGallery.count, "Há miniaturas do modal que não carregaram.");
assert.ok(result.modalGallery.changesMainImage, "Clicar em uma miniatura do modal não trocou a foto principal.");

console.log("Auditoria responsiva Playwright: PASS.");
