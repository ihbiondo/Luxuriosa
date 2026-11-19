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
  publicMobileViewportResults: [],
  publicMobileViewportFailures: [],
  mobileTouchTargets: [],
  mobileTouchTargetFailures: [],
  homeFeaturedImages: [],
  homeFeaturedImageFailures: [],
  experiencesPresentationOrder: null,
  missingViewportMeta: [],
  coreViewportResults: [],
  catalogCards: [],
  catalogImageFailures: [],
  catalogImageFitFailures: [],
  catalogCardFrameFailures: [],
  lingerieCards: [],
  catalogViewport320: null,
  catalogImageNavigation: null,
  catalogGridNavigation: null,
  catalogBodyNavigation: null,
  lingerieBodyNavigation: null,
  lingerieBodyNavigation320: null,
  productGalleryLayout: null,
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

  // Expande a cobertura mobile para TODAS as rotas públicas em 320 px e 390 px.
  // Isso encontra quebras em páginas editoriais, cidades, educação e conteúdo que não está no grupo central.
  const allPublicMobileViewports = [
    { name: "mobile-320", width: 320, height: 740 },
    { name: "mobile-390", width: 390, height: 844 }
  ];
  for (const route of routes) {
    for (const viewport of allPublicMobileViewports) {
      try {
        const response = await openPage(page, route, viewport);
        const item = {
          route,
          viewport: viewport.name,
          status: response?.status() ?? null,
          ...(await inspectLayout(page, route, viewport))
        };
        result.publicMobileViewportResults.push(item);

        // Registra alvos de toque reais no celular estreito, sem tratar links inline de texto como botões.
        if (viewport.width === 320) {
          const targets = await page.evaluate(() => {
            const selectors = [
              "button",
              "input:not([type='hidden'])",
              "select",
              "textarea",
              "summary",
              "[role='button']",
              "a.btn",
              "a.button",
              ".navlinks a",
              ".product-detail-gallery button",
              ".filters button"
            ].join(",");
            return [...document.querySelectorAll(selectors)].map(element => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              const hidden = style.display === "none" ||
                style.visibility === "hidden" ||
                Boolean(element.closest("[hidden], [aria-hidden='true']"));
              if (hidden || rect.width <= 0 || rect.height <= 0) return null;
              const text = (element.getAttribute("aria-label") ||
                element.getAttribute("title") ||
                element.getAttribute("placeholder") ||
                element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 90);
              const iconOnly = !((element.textContent || "").trim()) &&
                !element.getAttribute("placeholder");
              return {
                tag: element.tagName.toLowerCase(),
                type: element.getAttribute("type") || "",
                text,
                id: element.id || "",
                className: typeof element.className === "string" ? element.className.slice(0, 100) : "",
                width: Number(rect.width.toFixed(1)),
                height: Number(rect.height.toFixed(1)),
                below24: rect.width < 24 || rect.height < 24,
                belowComfort40: rect.height < 40 || (iconOnly && rect.width < 40),
                iconOnly
              };
            }).filter(Boolean);
          });
          const pageTargets = {
            route,
            targets,
            below24: targets.filter(target => target.below24),
            belowComfort40: targets.filter(target => target.belowComfort40)
          };
          result.mobileTouchTargets.push(pageTargets);
          if (pageTargets.below24.length) result.mobileTouchTargetFailures.push(pageTargets);
        }

        if ((item.status !== null && item.status >= 400) ||
            item.horizontalOverflow || !item.hasViewportMeta) {
          result.publicMobileViewportFailures.push(item);
        }
      } catch (error) {
        const item = { route, viewport: viewport.name, error: error.message.slice(0, 240) };
        result.publicMobileViewportResults.push(item);
        result.publicMobileViewportFailures.push(item);
      }
    }
  }

  // Verifica os quatro kits em destaque da home após forçar o carregamento lazy real.
  await openPage(page, "/", { name: "mobile-390", width: 390, height: 844 });
  const homeKitImages = page.locator("#destaques-grid .home-kit-static-media img");
  const homeKitCount = await homeKitImages.count();
  if (homeKitCount !== 4) {
    result.homeFeaturedImageFailures.push({
      expected: 4,
      actual: homeKitCount,
      reason: "Quantidade inesperada de imagens nos kits em destaque."
    });
  }
  for (let index = 0; index < homeKitCount; index++) {
    const image = homeKitImages.nth(index);
    await image.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      currentIndex => {
        const current = document.querySelectorAll("#destaques-grid .home-kit-static-media img")[currentIndex];
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
  result.homeFeaturedImages = await homeKitImages.evaluateAll(images =>
    images.map(image => ({
      alt: image.alt,
      src: image.getAttribute("src"),
      loaded: image.complete && image.naturalWidth > 0,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight
    }))
  );
  result.homeFeaturedImageFailures.push(
    ...result.homeFeaturedImages.filter(image => !image.loaded)
  );
  await capture(page, "home-kits-mobile-390");

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

  // Todos os cards do catálogo devem apontar para a página individual correspondente.
  const renderedCards = await page.locator("#grid .product").evaluateAll(cards =>
    cards.map(card => {
      const imageLink = card.querySelector(".product-image-link");
      const detailsLink = card.querySelector(".product-detail-link");
      return {
        label: card.getAttribute("aria-label") || "",
        tabIndex: card.tabIndex,
        imageHref: imageLink?.href || null,
        detailsHref: detailsLink?.href || null
      };
    })
  );
  const cardNavigationFailures = renderedCards.filter(card => {
    const product = catalogData.produtos.find(item =>
      card.label === "Ver detalhes de " + item.nome
    );
    const expectedHref = product?.pagina ? new URL(product.pagina, BASE_URL).href : null;
    return !expectedHref || card.tabIndex !== 0 ||
      card.imageHref !== expectedHref || card.detailsHref !== expectedHref;
  });
  result.catalogGridNavigation = {
    rendered: renderedCards.length,
    expected: expectedCatalogCards,
    failures: cardNavigationFailures
  };

  // A foto do card deve seguir o mesmo destino do link "Mais detalhes", sem abrir o modal.
  const firstImageLink = page.locator("#grid .product-image-link").first();
  await firstImageLink.waitFor({ state: "visible", timeout: 10000 });
  const imageLinkData = await firstImageLink.evaluate(link => ({
    href: link.getAttribute("href"),
    cardLabel: link.closest(".product")?.getAttribute("aria-label") || ""
  }));
  const linkedProduct = catalogData.produtos.find(product =>
    imageLinkData.cardLabel === "Ver detalhes de " + product.nome
  );
  const expectedImagePath = linkedProduct?.pagina
    ? new URL(linkedProduct.pagina, BASE_URL).pathname
    : null;
  const clickStaysOutsideCard = await firstImageLink.evaluate(link => {
    const card = link.closest(".product");
    let bubbledToCard = false;
    const watchCard = () => { bubbledToCard = true; };
    const preventNavigation = event => event.preventDefault();
    link.addEventListener("click", preventNavigation);
    card.addEventListener("click", watchCard);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    card.removeEventListener("click", watchCard);
    link.removeEventListener("click", preventNavigation);
    return !bubbledToCard && !document.querySelector("#modal.open");
  });
  await Promise.all([
    page.waitForURL(url => url.pathname === expectedImagePath, { timeout: 10000 }),
    firstImageLink.click()
  ]);
  const actualImagePath = new URL(page.url()).pathname;
  result.catalogImageNavigation = {
    href: imageLinkData.href,
    expectedPath: expectedImagePath,
    actualPath: actualImagePath,
    destinationMatched: Boolean(expectedImagePath && actualImagePath === expectedImagePath),
    clickStaysOutsideCard
  };

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
      iconHeight: icon ? Math.round(icon.getBoundingClientRect().height) : 0,
      storeCategoriesOpen: document.querySelector("#navlinks .nav-store-submenu")?.open ?? false,
      accordionGroups: [...document.querySelectorAll("#navlinks .nav-menu-group")].map(group => {
        const toggle = group.querySelector(":scope > .nav-menu-group-toggle");
        const childLinks = [...group.querySelectorAll(":scope > a, :scope > .nav-submenu")];
        return {
          name: toggle?.textContent.trim() || "",
          expanded: toggle?.getAttribute("aria-expanded") === "true",
          visibleByDefault: childLinks.length > 0 &&
            childLinks.every(item => getComputedStyle(item).display !== "none")
        };
      }),
      experienceMenuOrder: (() => {
        const group = document.querySelector("#navlinks .nav-menu-group--discover");
        const link = [...(group?.querySelectorAll(":scope > a") || [])]
          .find(item => item.getAttribute("href") === "/experiencias/");
        const submenu = link?.nextElementSibling;
        return [...(submenu?.querySelectorAll(":scope > a") || [])].map(item => item.textContent.trim());
      })()
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

  result.mobileMenu.accordionsCorrect = Boolean(
    result.mobileMenu.storeCategoriesOpen &&
    result.mobileMenu.accordionGroups.length === 2 &&
    result.mobileMenu.accordionGroups.every(group => group.expanded && group.visibleByDefault) &&
    result.mobileMenu.experienceMenuOrder.join("|") ===
      "Conexão a dois|Astrologia|Quizzes|Desafios"
  );

  const conhecerGroup = page.locator("#navlinks .nav-menu-group--discover");
  const conhecerToggle = conhecerGroup.locator(":scope > .nav-menu-group-toggle");
  await conhecerToggle.click();
  await page.waitForFunction(() =>
    !document.querySelector("#navlinks .nav-menu-group--discover")?.classList.contains("is-open") &&
    document.querySelector("#navlinks .nav-menu-group--discover > .nav-menu-group-toggle")?.getAttribute("aria-expanded") === "false"
  );
  const linksRecolhidos = await conhecerGroup.locator(":scope > a, :scope > .nav-submenu").evaluateAll(items =>
    items.length > 0 && items.every(item => getComputedStyle(item).display === "none")
  );
  await conhecerToggle.click();
  await page.waitForFunction(() =>
    document.querySelector("#navlinks .nav-menu-group--discover")?.classList.contains("is-open") &&
    document.querySelector("#navlinks .nav-menu-group--discover > .nav-menu-group-toggle")?.getAttribute("aria-expanded") === "true"
  );
  result.mobileMenu.accordionInteractionWorks =
    linksRecolhidos &&
    await conhecerGroup.locator(":scope > .nav-menu-group-toggle").getAttribute("aria-expanded") === "true";

  // Fechar e reabrir o drawer restaura as listas visíveis por padrão.
  await page.locator("#navlinks .nav-drawer-close").click();
  await page.locator("#navlinks").waitFor({ state: "hidden", timeout: 8000 });
  await page.locator("#burger").click();
  await page.locator("#navlinks.open").waitFor({ state: "visible", timeout: 8000 });
  result.mobileMenu.initialListsRestoreAfterReopen = await page.evaluate(() => {
    const groups = [...document.querySelectorAll(
      "#navlinks .nav-menu-group--help, #navlinks .nav-menu-group--discover"
    )];
    return groups.length === 2 && groups.every(group => {
      const toggle = group.querySelector(":scope > .nav-menu-group-toggle");
      const children = [...group.querySelectorAll(":scope > a, :scope > .nav-submenu")];
      return group.classList.contains("is-open") &&
        toggle?.getAttribute("aria-expanded") === "true" &&
        children.length > 0 &&
        children.every(item => getComputedStyle(item).display !== "none");
    });
  });

  // A página Experiências deve destacar Conexão a dois e Astrologia antes das demais opções.
  await openPage(page, "/experiencias/", { name: "mobile-390", width: 390, height: 844 });
  result.experiencesPresentationOrder = await page.evaluate(() => ({
    categories: [...document.querySelectorAll("#experienceCategories .experience-category-card strong")]
      .map(item => item.textContent.trim()),
    featured: [...document.querySelectorAll("#experienceGrid > .card")]
      .map(item => item.querySelector("h3")?.textContent.trim() || ""),
    filters: [...document.querySelectorAll(".filters button[data-filter]")]
      .map(item => item.getAttribute("data-filter"))
  }));
  await capture(page, "experiencias-ordem-mobile-390");

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

  // A área de conteúdo do card também navega para a mesma página individual.
  await openPage(page, "/loja.html", { name: "mobile-390", width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelectorAll("#grid .product").length > 0,
    null,
    { timeout: 15000 }
  );
  const firstCard = page.locator("#grid .product").first();
  const firstCardName = await firstCard.locator(".product-body h3").innerText();
  const firstCardHref = await firstCard.locator(".product-image-link").getAttribute("href");
  const firstCardPath = new URL(firstCardHref, BASE_URL).pathname;
  await Promise.all([
    page.waitForURL(url => url.pathname === firstCardPath, { timeout: 10000 }),
    firstCard.locator(".product-body h3").click()
  ]);
  result.catalogBodyNavigation = {
    name: firstCardName,
    expectedPath: firstCardPath,
    actualPath: new URL(page.url()).pathname,
    destinationMatched: new URL(page.url()).pathname === firstCardPath,
    modalOpened: Boolean(await page.locator("#modal.open").count())
  };
  await capture(page, "produto-aberto-pelo-corpo-card-mobile-390");

  // A mesma regra vale na vitrine específica de Lingerie, mesmo com URL de diretório.
  await openPage(page, "/loja/lingerie/", { name: "mobile-390", width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelectorAll("#grid .product").length === 14,
    null,
    { timeout: 15000 }
  );
  const lingerieCard = page.locator("#grid .product").filter({
    hasText: "Body Sensual Rendado — Frente Única"
  }).first();
  const lingerieCardHref = await lingerieCard.locator(".product-image-link").getAttribute("href");
  const lingerieCardPath = new URL(lingerieCardHref, BASE_URL).pathname;
  await Promise.all([
    page.waitForURL(url => url.pathname === lingerieCardPath, { timeout: 10000 }),
    lingerieCard.locator(".product-body h3").click()
  ]);
  result.lingerieBodyNavigation = {
    expectedPath: lingerieCardPath,
    actualPath: new URL(page.url()).pathname,
    destinationMatched: new URL(page.url()).pathname === lingerieCardPath,
    modalOpened: Boolean(await page.locator("#modal.open").count())
  };
  await capture(page, "lingerie-aberta-pelo-corpo-card-mobile-390");

  // Confirma o mesmo comportamento na menor largura e verifica o layout da página individual.
  await openPage(page, "/loja/lingerie/", { name: "mobile-320", width: 320, height: 740 });
  await page.waitForFunction(
    () => document.querySelectorAll("#grid .product").length === 14,
    null,
    { timeout: 15000 }
  );
  const lingerieCard320 = page.locator("#grid .product").filter({
    hasText: "Body Sensual Rendado — Frente Única"
  }).first();
  const lingerieHref320 = await lingerieCard320.locator(".product-image-link").getAttribute("href");
  const lingeriePath320 = new URL(lingerieHref320, BASE_URL).pathname;
  await Promise.all([
    page.waitForURL(url => url.pathname === lingeriePath320, { timeout: 10000 }),
    lingerieCard320.locator(".product-body h3").click()
  ]);
  result.lingerieBodyNavigation320 = {
    expectedPath: lingeriePath320,
    actualPath: new URL(page.url()).pathname,
    destinationMatched: new URL(page.url()).pathname === lingeriePath320,
    modalOpened: Boolean(await page.locator("#modal.open").count()),
    ...(await inspectLayout(page, lingeriePath320, { name: "mobile-320", width: 320, height: 740 }))
  };
  await capture(page, "lingerie-produto-mobile-320");

  // Confere a escala da foto principal em todas as páginas individuais e a troca de miniaturas onde houver galeria.
  const productsWithPage = catalogData.produtos.filter(product => product.pagina);
  for (const product of productsWithPage) {
    const route = product.pagina.charAt(0) === "/" ? product.pagina : "/" + product.pagina;
    try {
      const pageViewport = Number(product.id) === 31
        ? { name: "mobile-360", width: 360, height: 800 }
        : { name: "mobile-390", width: 390, height: 844 };
      await openPage(page, route, pageViewport);
      const mainImage = page.locator(".product-detail-image > img").first();
      await page.waitForFunction(() => {
        const image = document.querySelector(".product-detail-image > img");
        return Boolean(image && image.complete && image.naturalWidth > 0);
      }, null, { timeout: 10000 });

      const productImages = Array.isArray(product.imagens)
        ? product.imagens.filter(image => typeof image === "string" && image.trim())
        : [];
      if (product.imagem && !productImages.includes(product.imagem)) productImages.unshift(product.imagem);
      const expectedThumbCount = productImages.length > 1 ? productImages.length : 0;
      const gallery = page.locator(".product-detail-gallery");
      const galleryCount = await gallery.count();
      const thumbCount = galleryCount ? await gallery.locator("button").count() : 0;
      const initialSrc = await mainImage.getAttribute("src");

      const imageLayout = await page.evaluate(() => {
        const frame = document.querySelector(".product-detail-image");
        const image = frame?.querySelector(":scope > img");
        const galleryElement = frame?.querySelector(".product-detail-gallery");
        const frameRect = frame?.getBoundingClientRect();
        const imageRect = image?.getBoundingClientRect();
        const thumbRects = [...(galleryElement?.querySelectorAll(".product-detail-gallery-thumb") || [])]
          .map(thumb => thumb.getBoundingClientRect());
        const galleryRect = galleryElement?.getBoundingClientRect();
        const groupLeft = thumbRects.length ? Math.min(...thumbRects.map(rect => rect.left)) : 0;
        const groupRight = thumbRects.length ? Math.max(...thumbRects.map(rect => rect.right)) : 0;
        const groupCenterDelta = galleryRect && thumbRects.length
          ? Math.abs((groupLeft + groupRight) / 2 - (galleryRect.left + galleryRect.right) / 2)
          : null;
        return {
          frameWidth: frame?.clientWidth || 0,
          imageWidth: imageRect?.width || 0,
          imageFillRatio: frame?.clientWidth && imageRect
            ? Number((imageRect.width / frame.clientWidth).toFixed(3))
            : 0,
          imageCenterDelta: frameRect && imageRect
            ? Number(Math.abs((imageRect.left + imageRect.right) / 2 - (frameRect.left + frameRect.right) / 2).toFixed(2))
            : null,
          groupCenterDelta: groupCenterDelta === null ? null : Number(groupCenterDelta.toFixed(2))
        };
      });

      if (Number(product.id) === 31) result.productGalleryLayout = imageLayout;
      let changedAfterClick = expectedThumbCount === 0;
      if (expectedThumbCount > 1 && thumbCount > 1) {
        const secondThumb = gallery.locator("button").nth(1);
        const expectedSrc = await secondThumb.locator("img").getAttribute("src");
        await secondThumb.click();
        changedAfterClick = (await mainImage.getAttribute("src")) === expectedSrc;
      }
      const item = {
        id: product.id, route, expected: expectedThumbCount, actual: thumbCount,
        changedAfterClick, initialSrc, ...imageLayout
      };
      result.productGalleries.push(item);
      if (thumbCount !== expectedThumbCount || !changedAfterClick ||
          item.imageFillRatio < 0.90 || item.imageCenterDelta > 2) {
        result.productGalleryFailures.push(item);
      }
      if (expectedThumbCount > 1) await capture(page, "produto-galeria-" + product.id + "-mobile");
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
  !result.mobileMenu?.accordionsCorrect ||
  !result.mobileMenu?.accordionInteractionWorks ||
  !result.mobileMenu?.initialListsRestoreAfterReopen ||
  result.experiencesPresentationOrder?.categories.join("|") !== "Conexão a dois|Astrologia|Quizzes|Desafios" ||
  result.experiencesPresentationOrder?.featured.join("|") !==
    "Conexão a dois.|Seu signo, suas descobertas.|Descubra seu estilo.|Mitos ou verdades?|Pequenas descobertas." ||
  result.experiencesPresentationOrder?.filters.join("|") !== "all|couple|astrology|quiz|challenge|favorites" ||
  result.catalogGridNavigation?.failures.length > 0 ||
  result.catalogGridNavigation?.rendered !== expectedCatalogCards ||
  !result.catalogImageNavigation?.destinationMatched ||
  !result.catalogBodyNavigation?.destinationMatched ||
  result.catalogBodyNavigation?.modalOpened ||
  !result.lingerieBodyNavigation?.destinationMatched ||
  result.lingerieBodyNavigation?.modalOpened ||
  !result.lingerieBodyNavigation320?.destinationMatched ||
  result.lingerieBodyNavigation320?.modalOpened ||
  result.lingerieBodyNavigation320?.horizontalOverflow ||
  !result.catalogImageNavigation?.clickStaysOutsideCard ||
  !result.productGalleryLayout ||
  result.productGalleryLayout.imageFillRatio < 0.84 ||
  result.productGalleryLayout.groupCenterDelta > 2;

console.log(JSON.stringify({
  summary: {
    routesChecked: result.routeCount,
    coreViewportChecks: result.coreViewportResults.length,
    routeFailures: result.routeFailures.length,
    horizontalOverflowFailures: result.overflowFailures.length,
    publicMobileViewportChecks: result.publicMobileViewportResults.length,
    publicMobileViewportFailures: result.publicMobileViewportFailures.length,
    mobileTouchTargetRoutes: result.mobileTouchTargets.length,
    mobileTouchTargetsChecked: result.mobileTouchTargets.reduce((sum, item) => sum + item.targets.length, 0),
    mobileTouchTargetsBelow24: result.mobileTouchTargets.reduce((sum, item) => sum + item.below24.length, 0),
    mobileTouchTargetsBelowComfort40: result.mobileTouchTargets.reduce((sum, item) => sum + item.belowComfort40.length, 0),
    homeFeaturedImages: result.homeFeaturedImages.length,
    homeFeaturedImageFailures: result.homeFeaturedImageFailures.length,
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
    mobileMenuAccordionsCorrect: result.mobileMenu?.accordionsCorrect ?? false,
    mobileMenuAccordionInteractionWorks: result.mobileMenu?.accordionInteractionWorks ?? false,
    mobileMenuInitialListsRestoreAfterReopen: result.mobileMenu?.initialListsRestoreAfterReopen ?? false,
    experiencesPresentationOrder: result.experiencesPresentationOrder,
    productPagesChecked: result.productGalleries.length,
    productGalleryFailures: result.productGalleryFailures.length,
    catalogGridNavigation: result.catalogGridNavigation,
    catalogImageNavigation: result.catalogImageNavigation,
    catalogBodyNavigation: result.catalogBodyNavigation,
    lingerieBodyNavigation: result.lingerieBodyNavigation,
    lingerieBodyNavigation320: result.lingerieBodyNavigation320,
    productGalleryLayout: result.productGalleryLayout,
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
  publicMobileViewportResults: result.publicMobileViewportResults,
  publicMobileViewportFailures: result.publicMobileViewportFailures,
  mobileTouchTargets: result.mobileTouchTargets,
  mobileTouchTargetFailures: result.mobileTouchTargetFailures,
  homeFeaturedImages: result.homeFeaturedImages,
  homeFeaturedImageFailures: result.homeFeaturedImageFailures,
  experiencesPresentationOrder: result.experiencesPresentationOrder,
  missingViewportMeta: result.missingViewportMeta,
  pageErrors: result.pageErrors.slice(0, 30)
}, null, 2));

if (REPORT_PATH) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2));
}

assert.equal(result.routeFailures.length, 0, "Uma ou mais rotas públicas falharam.");
assert.equal(result.overflowFailures.length, 0, "Foram encontrados casos de rolagem horizontal.");
assert.equal(result.publicMobileViewportFailures.length, 0,
  "Foram encontradas falhas nas rotas públicas em 320/390 px: " +
  JSON.stringify(result.publicMobileViewportFailures.slice(0, 20)));
assert.equal(result.mobileTouchTargetFailures.length, 0,
  "Foram encontrados controles essenciais menores que 24 × 24 px: " +
  JSON.stringify(result.mobileTouchTargetFailures.slice(0, 15)));
assert.equal(result.homeFeaturedImageFailures.length, 0,
  "Uma ou mais imagens dos kits em destaque da home não carregaram: " +
  JSON.stringify(result.homeFeaturedImageFailures));
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
assert.ok(result.mobileMenu?.accordionsCorrect && result.mobileMenu?.accordionInteractionWorks &&
  result.mobileMenu?.initialListsRestoreAfterReopen,
  "O menu mobile deve iniciar com somente a Loja expandida, recolher os demais grupos e permitir expandi-los: " +
  JSON.stringify(result.mobileMenu));
assert.deepEqual(result.experiencesPresentationOrder?.categories,
  ["Conexão a dois", "Astrologia", "Quizzes", "Desafios"],
  "As categorias da página Experiências devem priorizar Conexão a dois e Astrologia.");
assert.deepEqual(result.experiencesPresentationOrder?.featured,
  ["Conexão a dois.", "Seu signo, suas descobertas.", "Descubra seu estilo.", "Mitos ou verdades?", "Pequenas descobertas."],
  "Os cards em destaque da página Experiências devem seguir a nova prioridade.");
assert.deepEqual(result.experiencesPresentationOrder?.filters,
  ["all", "couple", "astrology", "quiz", "challenge", "favorites"],
  "Os filtros devem seguir a nova prioridade de categorias.");
assert.equal(result.productGalleryFailures.length, 0, "Uma ou mais páginas individuais apresentam foto principal pequena/descentralizada ou galeria incompleta: " + JSON.stringify(result.productGalleryFailures));
assert.equal(result.catalogGridNavigation?.rendered, expectedCatalogCards,
  "A auditoria deve validar a navegação de todos os cards.");
assert.equal(result.catalogGridNavigation?.failures.length, 0,
  "Um ou mais cards não apontam para sua página individual: " + JSON.stringify(result.catalogGridNavigation?.failures));
assert.ok(result.catalogBodyNavigation?.destinationMatched && !result.catalogBodyNavigation?.modalOpened,
  "Clicar no corpo do card da loja não abriu a página individual.");
assert.ok(result.lingerieBodyNavigation?.destinationMatched && !result.lingerieBodyNavigation?.modalOpened,
  "Clicar no corpo do card de Lingerie não abriu a página individual.");
assert.ok(result.lingerieBodyNavigation320?.destinationMatched &&
  !result.lingerieBodyNavigation320?.modalOpened &&
  !result.lingerieBodyNavigation320?.horizontalOverflow,
  "A navegação do card de Lingerie falhou ou gerou rolagem horizontal em 320 px.");
assert.ok(result.catalogImageNavigation?.destinationMatched,
  "Clicar na foto do card não abriu a página de detalhes correspondente.");
assert.ok(result.catalogImageNavigation?.clickStaysOutsideCard,
  "O clique na foto também acionou o modal do card.");
assert.ok(result.productGalleryLayout?.imageFillRatio >= 0.90,
  "A foto principal da lingerie não preencheu suficientemente o quadro mobile: " + JSON.stringify(result.productGalleryLayout));
assert.ok(result.productGalleryLayout?.groupCenterDelta <= 2,
  "As miniaturas da página do produto não ficaram centralizadas.");
assert.ok(result.productGalleryLayout?.imageCenterDelta <= 2,
  "A foto principal da página do produto não ficou centralizada.");

console.log("Auditoria responsiva Playwright: PASS.");
