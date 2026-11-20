import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const SCREENSHOT_DIR = process.env.DESKTOP_SCREENSHOT_DIR || "";
const REPORT_PATH = process.env.DESKTOP_REPORT_PATH || "";
const VIEWPORTS = [
  { name: "notebook-1024", width: 1024, height: 900 },
  { name: "desktop-1200", width: 1200, height: 900 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "desktop-1360", width: 1360, height: 900 },
  { name: "desktop-1366", width: 1366, height: 900 },
  { name: "desktop-1440", width: 1440, height: 960 },
  { name: "wide-1920", width: 1920, height: 1080 }
];
const ROUTES = [
  { path: "/", name: "home" },
  { path: "/loja.html", name: "loja" },
  { path: "/atendimento.html", name: "atendimento" },
  { path: "/entregas/", name: "entregas" },
  { path: "/loja/lingerie/", name: "lingerie" }
];

const report = {
  baseUrl: BASE_URL,
  checkedAt: new Date().toISOString(),
  viewports: VIEWPORTS,
  pages: [],
  pageErrors: []
};

function ensureDirectory(directory) {
  if (directory) fs.mkdirSync(directory, { recursive: true });
}

async function preparePage(page, route, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const response = await page.goto(new URL(route.path, BASE_URL).href, {
    waitUntil: "domcontentloaded",
    timeout: 20000
  });
  assert.ok(response && response.status() < 400,
    route.path + " respondeu com status " + (response?.status() ?? "desconhecido"));

  await page.evaluate(() => {
    ["#gate", "#ageGate", "#ageGateOverlay", "#modal"].forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.style.setProperty("display", "none", "important");
      });
    });
  });

  await page.waitForFunction(() =>
    [...document.querySelectorAll('link[rel~="stylesheet"]')]
      .filter(link => link.href.startsWith(location.origin))
      .every(link => Boolean(link.sheet)), null, { timeout: 12000 });

  if (route.path === "/loja.html") {
    await page.waitForFunction(
      () => document.querySelectorAll("#grid .product").length > 0,
      null,
      { timeout: 15000 }
    );
  }

  await page.waitForTimeout(350);
}

async function inspect(page, route, viewport) {
  return page.evaluate(({ routePath, viewportWidth }) => {
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        right: Math.round(box.right),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
        display: style.display,
        position: style.position,
        visibility: style.visibility,
        overflowX: style.overflowX,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      };
    };

    const selectors = [
      "header",
      "header .nav",
      "header .logo",
      "header .navlinks",
      "header .nav-right",
      "header .burger",
      "main",
      ".hero",
      ".hero .container",
      ".hero-grid",
      ".hero-copy",
      ".hero h1",
      ".hero-image-main",
      ".hero-image-main img",
      ".featured-section",
      ".home-kit-static-grid",
      ".home-kit-static-card",
      ".categories-section",
      ".categories",
      ".shop-page #catalogo",
      ".shop-page #catalogo .container",
      ".catalog-search",
      ".catalog-filter-panel",
      "#grid",
      "#grid .product",
      "footer .container"
    ];

    const measured = {};
    for (const selector of selectors) {
      measured[selector] = [...document.querySelectorAll(selector)]
        .slice(0, 8).map(rect);
    }

    const visible = element => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        box.width > 1 && box.height > 1 &&
        box.bottom > 0 && box.top < innerHeight &&
        box.right > 0 && box.left < viewportWidth;
    };

    const viewportOverflows = [...document.querySelectorAll("body *")]
      .filter(visible)
      .map(element => {
        const box = element.getBoundingClientRect();
        if (box.left >= -2 && box.right <= viewportWidth + 2) return null;
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          className: typeof element.className === "string"
            ? element.className.trim().slice(0, 120) : "",
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
          text: (element.innerText || "").trim().replace(/\s+/g, " ").slice(0, 90)
        };
      })
      .filter(Boolean)
      .slice(0, 30);

    const main = document.querySelector("main");
    const containers = [...document.querySelectorAll("main .container")].map(element => {
      const box = element.getBoundingClientRect();
      const escapingChildren = [...element.querySelectorAll("*")].filter(child => {
        const childStyle = getComputedStyle(child);
        const childBox = child.getBoundingClientRect();
        return childStyle.display !== "none" &&
          childStyle.visibility !== "hidden" &&
          childBox.width > 1 &&
          (childBox.left < box.left - 2 || childBox.right > box.right + 2);
      }).slice(0, 12).map(child => {
        const childBox = child.getBoundingClientRect();
        return {
          tag: child.tagName.toLowerCase(),
          className: typeof child.className === "string"
            ? child.className.trim().slice(0, 100) : "",
          left: Math.round(childBox.left),
          right: Math.round(childBox.right),
          width: Math.round(childBox.width)
        };
      });
      return {
        className: typeof element.className === "string" ? element.className : "",
        bounds: rect(element),
        escapingChildren
      };
    });

    const navigationStylesheet = [...document.querySelectorAll('link[rel~="stylesheet"]')]
      .find(link => link.href.includes("navigation.css"));
    const menuIcons = [...document.querySelectorAll("header .navlinks .nav-link-icon")]
      .map(element => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          display: style.display,
          width: Math.round(box.width),
          height: Math.round(box.height),
          visible: style.display !== "none" && style.visibility !== "hidden" &&
            box.width > 0 && box.height > 0
        };
      });
    const utilityIcons = {
      cart: rect(document.querySelector("header .cart-icon svg")),
      account: rect(document.querySelector("header .account-trigger-icon svg")),
      cartStroke: document.querySelector("header .cart-icon svg")
        ? getComputedStyle(document.querySelector("header .cart-icon svg")).stroke : null,
      accountStroke: document.querySelector("header .account-trigger-icon svg")
        ? getComputedStyle(document.querySelector("header .account-trigger-icon svg")).stroke : null
    };
    const nav = document.querySelector("header .navlinks");
    const navStyle = nav ? getComputedStyle(nav) : null;
    const logo = document.querySelector("header .nav > .logo");
    const navRight = document.querySelector("header .nav-right");
    const visibleNavItems = nav
      ? [...nav.querySelectorAll("a[href]")].filter(visible).map(element => {
          const box = element.getBoundingClientRect();
          return {
            label: (element.innerText || "").trim().replace(/\s+/g, " "),
            href: element.getAttribute("href"),
            left: Math.round(box.left),
            right: Math.round(box.right),
            top: Math.round(box.top),
            bottom: Math.round(box.bottom)
          };
        })
      : [];
    const accountUtility = document.querySelector("header .nav-right > .account-trigger");
    const burger = document.querySelector("header .nav-right > .burger");
    const desktopNavigation = {
      display: navStyle?.display || null,
      position: navStyle?.position || null,
      flexDirection: navStyle?.flexDirection || null,
      logoBounds: rect(logo),
      bounds: rect(nav),
      actionsBounds: rect(navRight),
      headerControls: [...document.querySelectorAll("header a, header button, header [role='button']")]
        .map(element => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const before = getComputedStyle(element, "::before");
          const after = getComputedStyle(element, "::after");
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || "",
            className: typeof element.className === "string"
              ? element.className.trim().slice(0, 100) : "",
            label: element.getAttribute("aria-label") || element.getAttribute("title") || "",
            text: (element.innerText || element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 80),
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            position: style.position,
            color: style.color,
            fontSize: style.fontSize,
            width: Math.round(box.width),
            height: Math.round(box.height),
            left: Math.round(box.left),
            right: Math.round(box.right),
            before: before.content !== "none" ? before.content : null,
            after: after.content !== "none" ? after.content : null
          };
        }),
      clientWidth: nav?.clientWidth ?? 0,
      scrollWidth: nav?.scrollWidth ?? 0,
      items: visibleNavItems,
      submenusVisible: nav
        ? [...nav.querySelectorAll(".nav-submenu, .nav-store-submenu, .nav-drawer-top, .nav-drawer-footer")].some(visible)
        : false,
      accountUtilityVisible: Boolean(accountUtility && visible(accountUtility)),
      burgerVisible: Boolean(burger && visible(burger))
    };

    return {
      route: routePath,
      viewport: viewportWidth,
      viewportHeight: innerHeight,
      navigationCss: navigationStylesheet?.getAttribute("href") || null,
      menuIcons,
      utilityIcons,
      desktopNavigation,
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth
      },
      main: rect(main),
      measured,
      visibleViewportOverflows: viewportOverflows,
      containers
    };
  }, { routePath: route.path, viewportWidth: viewport.width });
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage();
page.setDefaultTimeout(10000);
page.on("pageerror", error => report.pageErrors.push({
  url: page.url(),
  message: error.message.slice(0, 240)
}));

try {
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      await preparePage(page, route, viewport);
      const measurements = await inspect(page, route, viewport);
      if (viewport.width >= 1200) {
        assert.ok(
          measurements.menuIcons.every(icon => !icon.visible),
          "Ícones do menu mobile não foram ocultados no desktop: " +
            JSON.stringify(measurements.menuIcons)
        );

        const navigation = measurements.desktopNavigation;
        const expectedItems = [
          "Minha conta",
          "Loja",
          "Atendimento",
          "Entregas",
          "Dúvidas frequentes",
          "Educação",
          "Experiências"
        ];
        assert.deepEqual(
          navigation.items.map(item => item.label),
          expectedItems,
          "A navegação desktop deve reproduzir a lista plana aprovada no mobile."
        );
        assert.equal(navigation.display, "flex", "Menu desktop não está visível.");
        assert.equal(navigation.position, "static", "Menu desktop não deve funcionar como painel flutuante.");
        assert.equal(navigation.flexDirection, "row", "Menu desktop deve permanecer horizontal.");
        assert.ok(
          navigation.scrollWidth <= navigation.clientWidth + 2,
          "Os links do menu desktop não cabem na largura disponível."
        );
        assert.equal(navigation.submenusVisible, false, "Submenus antigos não devem aparecer no desktop.");
        assert.equal(navigation.accountUtilityVisible, false, "Minha conta não deve aparecer duplicada no cabeçalho.");
        assert.equal(navigation.burgerVisible, false, "O botão lateral não deve aparecer no desktop.");
        assert.ok(navigation.logoBounds && navigation.bounds && navigation.actionsBounds,
          "O cabeçalho deve manter logo, navegação e ações visíveis.");
        assert.ok(
          !navigation.headerControls.some(control =>
            control.label.toLowerCase().includes("abrir menu") &&
            control.display !== "none" &&
            control.visibility !== "hidden" &&
            control.opacity !== "0" &&
            control.width > 1 && control.height > 1
          ),
          "O controle do menu recolhido não deve aparecer no desktop: " +
            JSON.stringify(navigation.headerControls.filter(control =>
              control.label.toLowerCase().includes("abrir menu")
            ))
        );
        assert.ok(navigation.bounds.x >= navigation.logoBounds.right - 2,
          "A navegação desktop está invadindo a área da marca: " +
            JSON.stringify({ logo: navigation.logoBounds, navigation: navigation.bounds }));
        assert.ok(navigation.bounds.right <= navigation.actionsBounds.x + 2,
          "A navegação desktop está invadindo a área do carrinho/WhatsApp: " +
            JSON.stringify({ navigation: navigation.bounds, actions: navigation.actionsBounds }));
        assert.ok(
          measurements.document.scrollWidth <= measurements.document.clientWidth + 1,
          "A página apresenta rolagem horizontal no desktop: " + route.path + " " +
            viewport.width + "px (" + measurements.document.scrollWidth + "/" +
            measurements.document.clientWidth + ")."
        );

        const centers = navigation.items.map(item => item.top);
        assert.ok(
          Math.max(...centers) - Math.min(...centers) <= 4,
          "Os links do menu desktop não estão alinhados na mesma linha."
        );
        for (let index = 1; index < navigation.items.length; index += 1) {
          assert.ok(
            navigation.items[index].left >= navigation.items[index - 1].right - 2,
            "Os links do menu desktop estão sobrepostos: " + JSON.stringify(navigation.items)
          );
        }
      }

      if (viewport.width >= 901 && viewport.width <= 1199 &&
          ["/", "/loja.html"].includes(route.path)) {
        const expectedUtilityIcons = route.path === "/"
          ? ["cart", "account"]
          : ["cart"];
        for (const name of expectedUtilityIcons) {
          const icon = measurements.utilityIcons[name];
          assert.ok(icon && icon.display !== "none" &&
            icon.width === 17 && icon.height === 17,
            "Ícone " + name + " do cabeçalho compacto está sem dimensão correta: " +
              JSON.stringify(icon)
          );
        }
      }

      const screenshotName = route.name + "-" + viewport.name + ".png";

      if (SCREENSHOT_DIR) {
        ensureDirectory(SCREENSHOT_DIR);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, screenshotName),
          fullPage: false,
          animations: "disabled",
          timeout: 20000
        });
      }

      report.pages.push({
        ...measurements,
        screenshot: SCREENSHOT_DIR ? screenshotName : null
      });
      console.log(route.name + " " + viewport.name + ": " +
        measurements.document.clientWidth + "px viewport, " +
        measurements.document.scrollWidth + "px document, " +
        measurements.visibleViewportOverflows.length + " visible overflow candidates");
    }
  }
} finally {
  await browser.close();
}

if (REPORT_PATH) {
  ensureDirectory(path.dirname(REPORT_PATH));
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

assert.equal(report.pageErrors.length, 0,
  "Erro JavaScript durante a auditoria desktop: " + JSON.stringify(report.pageErrors));
console.log("Auditoria visual desktop concluída.");
