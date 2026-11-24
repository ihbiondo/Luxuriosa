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

  // Playwright full-page capture also considers body.scrollWidth. The closed cart
  // drawer is fixed and translated outside the viewport, so it can widen the PNG
  // even though html/body clip horizontal overflow for real visitors. Hide only
  // the closed drawer in this test-only capture; never hide an open cart.
  await page.addStyleTag({
    content: "#cart:not(.open), #cartOverlay:not(.open),\n    header:not(.mobile-menu-active) .navlinks { display: none !important; }"
  });

  // Full-page screenshots do not trigger every lazy image before capture.
  // Visit each image, wait for decoding, then restore the initial scroll position.
  await page.evaluate(async () => {
    const images = [...document.images].filter(image => image.getAttribute("src"));
    for (const image of images) {
      image.scrollIntoView({ block: "center", behavior: "auto" });
      if (typeof image.decode === "function") {
        await Promise.race([
          image.decode().catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 4000))
        ]);
      }
    }
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo(0, 0);
    await new Promise(resolve => requestAnimationFrame(() =>
      requestAnimationFrame(resolve)
    ));
  });

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
  mobileTouchTargetComfortFailures: [],
  unifiedNavigationChecks: [],
  unifiedNavigationFailures: [],
  unifiedNavigationInteractions: [],
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
  productGalleryFailures: [],
  simpleSignup: {
    checks: [],
    failures: []
  }
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
  // Verifica que a antiga tela de login não oferece criação de conta.
  const accountFreeViewports = [
    { name: "mobile-320", width: 320, height: 740 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "desktop-1366", width: 1366, height: 900 }
  ];

  for (const viewport of accountFreeViewports) {
    await openPage(page, "/login.html", viewport);
    await page.locator("h1").waitFor({ state: "visible" });
    const audit = await page.evaluate(() => {
      const heading = document.querySelector("h1")?.textContent.replace(/\\s+/g, " ").trim() || "";
      const storeLink = document.querySelector('a[href="/loja.html"]');
      const bodyText = document.body.innerText.replace(/\\s+/g, " ").trim();
      const accountControls = document.querySelectorAll(
        "#signupTab, #loginTab, #signupForm, #loginForm, form, input[type='password']"
      );
      return {
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        heading,
        explainsNoAccount: /não precisa criar uma conta/i.test(bodyText),
        storeLinkVisible: Boolean(storeLink && storeLink.getClientRects().length),
        accountControls: accountControls.length
      };
    });

    result.simpleSignup.checks.push({ name: viewport.name, ...audit });
    const valid = /não precisa criar uma conta/i.test(audit.heading) &&
      audit.explainsNoAccount && audit.storeLinkVisible &&
      audit.accountControls === 0 && !audit.horizontalOverflow;
    if (!valid) result.simpleSignup.failures.push({ name: viewport.name, ...audit });

    await capture(page, "compra-sem-conta-" + viewport.name);
  }

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

        // Confirma que todas as páginas representativas usam o menu mobile simplificado.
        const normalizedRoute = route.startsWith("/") ? route : "/" + route;
        const usesSharedNavigation = normalizedRoute.startsWith("/produtos/") ||
          ["/loja/lingerie/", "/loja/lingerie/index.html", "/atendimento.html", "/entregas/"].includes(normalizedRoute);
        if (viewport.width === 390 && usesSharedNavigation) {
          await page.waitForFunction(() => {
            const nav = document.querySelector("#navlinks");
            const styleLink = [...document.querySelectorAll('link[rel="stylesheet"]')]
              .find(link => (link.href || "").includes("navigation.css"));
            const appScript = [...document.scripts].find(script =>
              (script.src || "").includes("/js/app.js"));
            return Boolean(nav && nav.querySelector(".nav-drawer-close") &&
              styleLink && styleLink.sheet && appScript);
          }, null, { timeout: 10000 });

          const audit = await page.evaluate(() => {
            const nav = document.querySelector("#navlinks");
            const account = nav?.querySelector(".nav-drawer-account-area > .nav-account-primary");
            const help = nav?.querySelector(".nav-menu-group--help");
            const discover = nav?.querySelector(".nav-menu-group--discover");
            const links = [...(nav?.querySelectorAll("a") || [])].filter(link =>
              getComputedStyle(link).display !== "none" && link.getClientRects().length
            );
            const heights = links.map(link => Math.round(link.getBoundingClientRect().height));
            const fontSizes = links.map(link => getComputedStyle(link).fontSize);
            const fontWeights = links.map(link => getComputedStyle(link).fontWeight);
            const hiddenSubmenus = [...(nav?.querySelectorAll(
              ".nav-account-submenu, .nav-store-submenu, .nav-menu-group > .nav-submenu"
            ) || [])].every(item => getComputedStyle(item).display === "none");
            const visibleToggles = [...(nav?.querySelectorAll(
              ".nav-menu-group-toggle, .nav-store-submenu > summary"
            ) || [])].some(item => getComputedStyle(item).display !== "none");
            const categoryGrid = nav?.querySelector(".nav-store-grid");
            return {
              burger: Boolean(document.querySelector("#burger")),
              drawer: Boolean(nav && nav.querySelector(".nav-drawer-top") &&
                nav.querySelector(".nav-drawer-close")),
              brand: nav?.querySelector(".nav-drawer-title")?.textContent.trim() || "",
              appScriptVersion: [...document.scripts].find(script =>
                (script.src || "").includes("/js/app.js"))?.src || "",
              navigationCssVersion: [...document.querySelectorAll('link[rel="stylesheet"]')]
                .find(link => (link.href || "").includes("navigation.css"))?.href || "",
              visibleLinks: links.map(link => link.textContent.trim()),
              expectedLinks: ["Loja", "Atendimento", "Entregas",
                "Dúvidas frequentes", "Educação", "Experiências"],
              accountRemoved: !account,
              hiddenSubmenus,
              visibleToggles,
              categoryGridVisible: Boolean(categoryGrid && getComputedStyle(categoryGrid).display !== "none"),
              firstDivider: help ? getComputedStyle(help).borderTopStyle : "none",
              secondDivider: discover ? getComputedStyle(discover).borderTopStyle : "none",
              uniformHeights: heights.length === 6 && heights.every(value => value === heights[0]),
              uniformTypography: fontSizes.length === 6 &&
                fontSizes.every(value => value === "14px") &&
                fontWeights.every(value => value === "500")
            };
          });
          item.unifiedNavigation = audit;
          result.unifiedNavigationChecks.push({ route: normalizedRoute, ...audit });
          if (!audit.burger || !audit.drawer || !audit.brand ||
              !audit.appScriptVersion.includes("/js/app.js?v=") ||
              !audit.navigationCssVersion.includes("/css/navigation.css?v=") ||
              audit.visibleLinks.join("|") !== audit.expectedLinks.join("|") ||
              !audit.accountRemoved || !audit.hiddenSubmenus || audit.visibleToggles ||
              audit.categoryGridVisible || audit.firstDivider !== "solid" ||
              audit.secondDivider !== "solid" || !audit.uniformHeights ||
              !audit.uniformTypography) {
            result.unifiedNavigationFailures.push({ route: normalizedRoute, ...audit });
          }
        }

        // Registra alvos de toque reais no celular estreito, sem tratar links inline de texto como botões.
        if (viewport.width === 320) {
          // Aguarda todas as folhas de estilo (inclusive CSS específico de produto) antes de medir.
          await page.waitForFunction(() =>
            [...document.querySelectorAll('link[rel~="stylesheet"]')].every(link => Boolean(link.sheet)),
            null,
            { timeout: 10000 }
          );
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
              const controlRect = element.getBoundingClientRect();
              const wrappingLabel = element.closest("label");
              const associatedLabel = element.labels?.[0] || null;
              // Só substitui a área do controle pela área do label quando o label o envolve.
              // Labels externos de campos de busca podem ser apenas o texto do rótulo, não a área clicável.
              const targetRect = wrappingLabel ? wrappingLabel.getBoundingClientRect() : controlRect;
              const targetStyle = wrappingLabel ? getComputedStyle(wrappingLabel) : style;
              const hidden = style.display === "none" ||
                style.visibility === "hidden" ||
                targetStyle.display === "none" ||
                targetStyle.visibility === "hidden" ||
                Boolean(element.closest("[hidden], [aria-hidden='true']"));
              if (hidden || targetRect.width <= 0 || targetRect.height <= 0) return null;
              const text = (element.getAttribute("aria-label") ||
                element.getAttribute("title") ||
                element.getAttribute("placeholder") ||
                wrappingLabel?.textContent ||
                associatedLabel?.textContent ||
                element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 90);
              const iconOnly = !((element.textContent || "").trim()) &&
                !element.getAttribute("placeholder") && !wrappingLabel;
              return {
                tag: element.tagName.toLowerCase(),
                type: element.getAttribute("type") || "",
                text,
                id: element.id || "",
                className: typeof element.className === "string" ? element.className.slice(0, 100) : "",
                width: Number(targetRect.width.toFixed(1)),
                height: Number(targetRect.height.toFixed(1)),
                controlWidth: Number(controlRect.width.toFixed(1)),
                controlHeight: Number(controlRect.height.toFixed(1)),
                measuredViaLabel: Boolean(wrappingLabel),
                computedDisplay: style.display,
                computedHeight: style.height,
                computedMinHeight: style.minHeight,
                below24: targetRect.width < 24 || targetRect.height < 24,
                belowComfort40: targetRect.height < 40 || (iconOnly && targetRect.width < 40),
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
          if (pageTargets.belowComfort40.length) result.mobileTouchTargetComfortFailures.push(pageTargets);
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

  // Captura a gaveta real do carrinho após adicionar um produto pelo catálogo.
  // Mantém a verificação restrita ao navegador descartável da auditoria.
  await page.locator("#grid .product-cart-button").first().click();
  await page.locator("#cart.open").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForFunction(() => {
    const items = document.querySelectorAll("#cartItems .cart-item").length;
    const footer = document.querySelector("#cartFooter");
    const checkout = document.querySelector("#cartCheckout");
    return items > 0 && footer && !footer.hidden && checkout;
  }, null, { timeout: 8000 });

  const inspectCartDrawer = async (viewportName) => page.evaluate((name) => {
    const cart = document.querySelector("#cart");
    const items = document.querySelector("#cartItems");
    const footer = document.querySelector("#cartFooter");
    const close = document.querySelector("#cartClose");
    const checkout = document.querySelector("#cartCheckout");
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height)
      };
    };
    const cartRect = rect(cart);
    return {
      viewport: name,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      isOpen: Boolean(cart?.classList.contains("open")),
      ariaHidden: cart?.getAttribute("aria-hidden") || null,
      bodyScrollLocked: document.body.classList.contains("cart-open"),
      cart: cartRect,
      cartWithinViewport: Boolean(cartRect &&
        cartRect.left >= -1 && cartRect.right <= innerWidth + 1 &&
        cartRect.top >= -1 && cartRect.bottom <= innerHeight + 1),
      itemCount: items?.querySelectorAll(".cart-item").length || 0,
      itemsArea: rect(items),
      itemsScrollable: Boolean(items && items.scrollHeight > items.clientHeight),
      footerVisible: Boolean(footer && !footer.hidden &&
        getComputedStyle(footer).display !== "none"),
      footer: rect(footer),
      closeButton: rect(close),
      checkoutButton: rect(checkout),
      checkoutVisible: Boolean(checkout && checkout.getClientRects().length)
    };
  }, viewportName);

  result.cartDrawerMobile = await inspectCartDrawer("mobile-390");
  assert.ok(result.cartDrawerMobile.isOpen && result.cartDrawerMobile.ariaHidden === "false",
    "A gaveta do carrinho não abriu corretamente no mobile.");
  assert.ok(result.cartDrawerMobile.cartWithinViewport,
    "A gaveta do carrinho ultrapassa a viewport mobile: " + JSON.stringify(result.cartDrawerMobile.cart));
  assert.ok(result.cartDrawerMobile.itemCount > 0 &&
    result.cartDrawerMobile.footerVisible && result.cartDrawerMobile.checkoutVisible,
    "O resumo ou a ação de continuar não ficou visível no carrinho mobile.");
  assert.ok(result.cartDrawerMobile.closeButton?.width >= 40 &&
    result.cartDrawerMobile.closeButton?.height >= 40,
    "O botão de fechar do carrinho está pequeno no mobile.");

  if (SCREENSHOT_DIR) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "carrinho-com-item-mobile-390.png"),
      fullPage: false,
      animations: "disabled",
      timeout: 20000
    });
  }

  // A mesma gaveta deve permanecer contida e utilizável na experiência desktop.
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.waitForTimeout(180);
  result.cartDrawerDesktop = await inspectCartDrawer("desktop-1366");
  assert.ok(result.cartDrawerDesktop.isOpen && result.cartDrawerDesktop.cartWithinViewport,
    "A gaveta do carrinho ultrapassa a viewport desktop.");
  assert.ok(result.cartDrawerDesktop.footerVisible && result.cartDrawerDesktop.checkoutVisible,
    "O resumo ou a ação de continuar não ficou visível no carrinho desktop.");

  if (SCREENSHOT_DIR) {
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "carrinho-com-item-desktop-1366.png"),
      fullPage: false,
      animations: "disabled",
      timeout: 20000
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#cartClose").click();
  await page.locator("#cart.open").waitFor({ state: "hidden", timeout: 8000 });

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

  // O menu mobile deve ser uma lista plana, na ordem aprovada, sem destaques ou submenus.
  await openPage(page, "/", { name: "mobile-390", width: 390, height: 844 });
  await page.locator("#burger").click();
  await page.locator("#navlinks.open").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(250);
  result.mobileMenu = await page.evaluate(() => {
    const menu = document.querySelector("#navlinks");
    const shop = menu?.querySelector(":scope > .nav-link-shop");
    const help = menu?.querySelector(".nav-menu-group--help");
    const discover = menu?.querySelector(".nav-menu-group--discover");
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: Math.round(box.left), right: Math.round(box.right),
        width: Math.round(box.width), height: Math.round(box.height) };
    };
    const visibleLinks = [...menu.querySelectorAll("a")].filter(link =>
      getComputedStyle(link).display !== "none" && link.getClientRects().length
    ).map(link => link.textContent.trim());
    const hiddenSubmenus = [...menu.querySelectorAll(
      ".nav-store-submenu, .nav-menu-group > .nav-submenu"
    )].every(item => getComputedStyle(item).display === "none");
    const visibleToggles = [...menu.querySelectorAll(
      ".nav-menu-group-toggle, .nav-store-submenu > summary"
    )].some(item => getComputedStyle(item).display !== "none");
    const firstDivider = help ? getComputedStyle(help).borderTopStyle : "none";
    const secondDivider = discover ? getComputedStyle(discover).borderTopStyle : "none";
    const links = [shop, ...[...(help?.querySelectorAll(":scope > a") || [])],
      ...[...(discover?.querySelectorAll(":scope > a") || [])]].filter(Boolean);
    const heights = links.map(item => Math.round(item.getBoundingClientRect().height));
    const fontSizes = links.map(item => getComputedStyle(item).fontSize);
    const fontWeights = links.map(item => getComputedStyle(item).fontWeight);
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      visibleLinks,
      expectedLinks: ["Loja", "Atendimento", "Entregas",
        "Dúvidas frequentes", "Educação", "Experiências"],
      shop: rect(shop),
      noAccountLinks: !menu.querySelector("[data-nav-account], .nav-account-primary, .nav-drawer-account-area"),
      hiddenSubmenus,
      visibleToggles,
      categoryGridVisible: (() => {
        const grid = menu?.querySelector(".nav-store-grid");
        return Boolean(grid && getComputedStyle(grid).display !== "none");
      })(),
      firstDivider,
      secondDivider,
      uniformHeights: heights.length === 6 && heights.every(value => value === heights[0]),
      uniformTypography: fontSizes.every(value => value === "14px") &&
        fontWeights.every(value => value === "500")
    };
  });
  result.mobileMenu.shopRowAligned = Boolean(
    result.mobileMenu.shop &&
    result.mobileMenu.shop.height >= 44 &&
    result.mobileMenu.document <= result.mobileMenu.viewport + 1
  );
  result.mobileMenu.navigationHierarchyCorrect =
    result.mobileMenu.visibleLinks.join("|") === result.mobileMenu.expectedLinks.join("|") &&
    result.mobileMenu.noAccountLinks &&
    result.mobileMenu.hiddenSubmenus &&
    !result.mobileMenu.visibleToggles &&
    !result.mobileMenu.categoryGridVisible &&
    result.mobileMenu.firstDivider === "solid" &&
    result.mobileMenu.secondDivider === "solid" &&
    result.mobileMenu.uniformHeights &&
    result.mobileMenu.uniformTypography;
  await capture(page, "menu-mobile-sem-conta-390");

  // Confere abertura, dimensões, rolagem, conteúdo e fechamento do menu em páginas representativas.
  const unifiedMenuSamples = [
    { route: "/produtos/1-dado-do-prazer-gay.html", name: "produto-detalhe" },
    { route: "/produtos/31-body-sensual-rendado-frente-unica.html", name: "produto-lingerie" },
    { route: "/loja/lingerie/", name: "vitrine-lingerie" },
    { route: "/atendimento.html", name: "atendimento" },
    { route: "/entregas/", name: "entregas" }
  ];
  for (const sample of unifiedMenuSamples) {
    await openPage(page, sample.route, { name: "mobile-390", width: 390, height: 844 });
    await page.waitForFunction(() => {
      const styleLink = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .find(link => (link.href || "").includes("navigation.css"));
      const nav = document.querySelector("#navlinks");
      const backdrop = document.querySelector(".nav-drawer-backdrop");
      return Boolean(
        styleLink && styleLink.sheet &&
        document.querySelector("#burger") &&
        nav && backdrop &&
        getComputedStyle(nav).position === "fixed" &&
        getComputedStyle(backdrop).position === "fixed" &&
        Number(getComputedStyle(nav).zIndex) > Number(getComputedStyle(backdrop).zIndex)
      );
    }, null, { timeout: 10000 });

    await page.locator("#burger").click();
    await page.locator("#navlinks.open").waitFor({ state: "visible", timeout: 8000 });
    await page.waitForFunction(() => {
      const nav = document.querySelector("#navlinks");
      if (!nav) return false;
      const rect = nav.getBoundingClientRect();
      return rect.left >= -1 && Math.abs(rect.right - innerWidth) <= 1;
    }, null, { timeout: 5000 });

    const interaction = await page.evaluate(() => {
      const nav = document.querySelector("#navlinks");
      const rect = nav?.getBoundingClientRect();
      const links = [...(nav?.querySelectorAll("a") || [])].filter(link =>
        getComputedStyle(link).display !== "none" && link.getClientRects().length
      );
      const visibleLinks = links.map(link => link.textContent.replace(/\\s+/g, " ").trim());
      const hiddenSubmenus = [...(nav?.querySelectorAll(
        ".nav-account-submenu, .nav-store-submenu, .nav-menu-group > .nav-submenu"
      ) || [])].every(item => getComputedStyle(item).display === "none");
      const visibleToggles = [...(nav?.querySelectorAll(
        ".nav-menu-group-toggle, .nav-store-submenu > summary"
      ) || [])].some(item => getComputedStyle(item).display !== "none");
      const categoryGrid = nav?.querySelector(".nav-store-grid");
      return {
        open: nav?.classList.contains("open") || false,
        widthWithinViewport: Boolean(rect && rect.left >= -1 && rect.right <= innerWidth + 1),
        heightWithinViewport: Boolean(rect && rect.height <= innerHeight + 1),
        internalScroll: Boolean(nav && ["auto", "scroll"].includes(getComputedStyle(nav).overflowY)),
        backgroundLocked: document.body.classList.contains("mobile-menu-open"),
        visibleLinks,
        approvedLinksOnly: visibleLinks.join("|") === [
          "Loja", "Atendimento", "Entregas",
          "Dúvidas frequentes", "Educação", "Experiências"
        ].join("|"),
        hiddenSubmenus,
        visibleToggles,
        categoryGridHidden: !categoryGrid || getComputedStyle(categoryGrid).display === "none",
        closeButtonPresent: Boolean(nav?.querySelector(".nav-drawer-close"))
      };
    });
    result.unifiedNavigationInteractions.push({ route: sample.route, ...interaction });
    if (!interaction.open || !interaction.widthWithinViewport || !interaction.heightWithinViewport ||
        !interaction.internalScroll || !interaction.backgroundLocked || !interaction.approvedLinksOnly ||
        !interaction.hiddenSubmenus || interaction.visibleToggles ||
        !interaction.categoryGridHidden || !interaction.closeButtonPresent) {
      result.unifiedNavigationFailures.push({ route: sample.route, ...interaction });
    }

    const closeHitTest = await page.evaluate(() => {
      const close = document.querySelector("#navlinks .nav-drawer-close");
      if (!close) return { reachable: false, reason: "botão de fechar ausente" };
      const rect = close.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { reachable: Boolean(target && (target === close || close.contains(target))) };
    });
    assert.ok(closeHitTest.reachable,
      "O botão de fechar do menu está encoberto em " + sample.route + ": " + JSON.stringify(closeHitTest));

    await capture(page, "menu-mobile-" + sample.name + "-390");
    await page.locator("#navlinks .nav-drawer-close").click();
    await page.locator("#navlinks.open").waitFor({ state: "hidden", timeout: 8000 });
  }

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
        const galleryStyle = galleryElement ? getComputedStyle(galleryElement) : null;
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
          groupCenterDelta: groupCenterDelta === null ? null : Number(groupCenterDelta.toFixed(2)),
          galleryFlexWrap: galleryStyle?.flexWrap || null,
          galleryNoHorizontalOverflow: !galleryElement ||
            galleryElement.scrollWidth <= galleryElement.clientWidth + 2
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
          item.imageFillRatio < 0.90 || item.imageCenterDelta > 2 ||
          (expectedThumbCount > 1 &&
            (item.galleryFlexWrap !== "wrap" || !item.galleryNoHorizontalOverflow))) {
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
  result.simpleSignup.failures.length > 0 ||
  (result.imageFailures || []).length > 0 ||
  (result.imageFitFailures || []).length > 0 ||
  (result.portraitCardFailures || []).length > 0 ||
  result.catalogImageFailures.length > 0 ||
  result.catalogImageFitFailures.length > 0 ||
  result.catalogCardFrameFailures.length > 0 ||
  result.productGalleryFailures.length > 0 ||
  result.mobileTouchTargetFailures.length > 0 ||
  result.mobileTouchTargetComfortFailures.length > 0 ||
  result.unifiedNavigationFailures.length > 0 ||
  !result.mobileMenu?.navigationHierarchyCorrect ||

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
    unifiedNavigationPagesChecked: result.unifiedNavigationChecks.length,
    unifiedNavigationFailures: result.unifiedNavigationFailures.length,
    unifiedNavigationInteractions: result.unifiedNavigationInteractions.length,
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
    mobileMenuShopAligned: result.mobileMenu?.shopRowAligned ?? false,
    mobileMenuNavigationHierarchyCorrect: result.mobileMenu?.navigationHierarchyCorrect ?? false,
    experiencesPresentationOrder: result.experiencesPresentationOrder,
    productPagesChecked: result.productGalleries.length,
    productGalleryFailures: result.productGalleryFailures.length,
    simpleSignupViewportsChecked: result.simpleSignup.checks.length,
    simpleSignupFailures: result.simpleSignup.failures.length,
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
  mobileTouchTargetComfortFailures: result.mobileTouchTargetComfortFailures,
  unifiedNavigationChecks: result.unifiedNavigationChecks,
  unifiedNavigationFailures: result.unifiedNavigationFailures,
  unifiedNavigationInteractions: result.unifiedNavigationInteractions,
  homeFeaturedImages: result.homeFeaturedImages,
  homeFeaturedImageFailures: result.homeFeaturedImageFailures,
  experiencesPresentationOrder: result.experiencesPresentationOrder,
  missingViewportMeta: result.missingViewportMeta,
  pageErrors: result.pageErrors.slice(0, 30),
  simpleSignup: result.simpleSignup
}, null, 2));

if (REPORT_PATH) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2));
}

assert.equal(result.simpleSignup.checks.length, 3,
  "O cadastro simplificado deve ser verificado em 320 px, 390 px e desktop.");
assert.equal(result.simpleSignup.failures.length, 0,
  "A tela sem cadastro apresentou problemas de acesso ou layout: " +
  JSON.stringify(result.simpleSignup.failures));
assert.equal(result.routeFailures.length, 0, "Uma ou mais rotas públicas falharam.");
assert.equal(result.overflowFailures.length, 0, "Foram encontrados casos de rolagem horizontal.");
assert.equal(result.publicMobileViewportFailures.length, 0,
  "Foram encontradas falhas nas rotas públicas em 320/390 px: " +
  JSON.stringify(result.publicMobileViewportFailures.slice(0, 20)));
assert.equal(result.mobileTouchTargetFailures.length, 0,
  "Foram encontrados controles essenciais menores que 24 × 24 px: " +
  JSON.stringify(result.mobileTouchTargetFailures.slice(0, 15)));
assert.equal(result.mobileTouchTargetComfortFailures.length, 0,
  "Foram encontrados controles importantes abaixo de 40 px de altura/largura: " +
  JSON.stringify(result.mobileTouchTargetComfortFailures.slice(0, 15)));
assert.equal(result.unifiedNavigationFailures.length, 0,
  "O menu unificado falhou em páginas públicas: " +
  JSON.stringify(result.unifiedNavigationFailures.slice(0, 15)));
const expectedProductNavigationPages = catalogData.produtos.filter(product => product.pagina).length;
const checkedProductNavigationPages = result.unifiedNavigationChecks.filter(item => item.route.startsWith("/produtos/")).length;
assert.equal(checkedProductNavigationPages, expectedProductNavigationPages,
  "Nem todas as páginas individuais foram verificadas quanto ao menu unificado.");
assert.equal(result.unifiedNavigationInteractions.length, 5,
  "Nem todas as páginas representativas tiveram a abertura do menu testada.");
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
assert.ok(result.mobileMenu?.shopRowAligned,
  "O link Loja deve ser o primeiro item alinhado do menu mobile: " + JSON.stringify(result.mobileMenu));
assert.ok(result.mobileMenu?.navigationHierarchyCorrect,
  "O menu mobile deve exibir somente os sete links aprovados, em lista plana e sem destaques ou submenus: " +
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