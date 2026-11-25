import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const routes = ["/", "/loja.html", "/loja/lingerie/", "/atendimento.html", "/entregas/", "/faq.html", "/produtos/11-hot-ball-xana-loka.html"];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const page = await context.newPage();

try {
  await page.addInitScript(() => {
    window.__luxFocusCalls = [];
    window.__luxFocusEvents = [];
    const nativeFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options) {
      if (this.classList?.contains("nav-drawer-close")) {
        window.__luxFocusCalls.push({
          tag: this.tagName,
          disabled: this.disabled,
          connected: this.isConnected,
          inert: !!this.closest("[inert]")
        });
      }
      return nativeFocus.call(this, options);
    };
    document.addEventListener("focusin", event => {
      if (event.target?.classList?.contains("nav-drawer-close")) window.__luxFocusEvents.push("close-focused");
    }, true);
    localStorage.setItem("lux18", "1");
    localStorage.setItem("lux_cookie_consent_v1", JSON.stringify({
      version: 2, updatedAt: new Date().toISOString(), necessary: true, analytics: false
    }));
  });

  for (const route of routes) {
    const response = await page.goto(new URL(route, BASE_URL).href, { waitUntil: "domcontentloaded", timeout: 20000 });
    assert.ok(response && response.status() < 400, route + " deve abrir sem erro HTTP");
    await page.locator(".skip-link").waitFor({ state: "attached" });
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const el = document.activeElement, style = getComputedStyle(el);
      return {
        isSkip: el?.classList?.contains("skip-link") === true,
        visible: !!el && el.getClientRects().length > 0 && style.visibility !== "hidden",
        keyboard: !!el && el.matches(":focus-visible"),
        outline: parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none",
        shadow: style.boxShadow !== "none"
      };
    });
    assert.equal(focus.isSkip, true, route + " deve focar primeiro o link de pulo");
    assert.equal(focus.visible, true, route + " deve exibir o link de pulo");
    assert.equal(focus.keyboard, true, route + " deve reconhecer foco de teclado");
    assert.ok(focus.outline || focus.shadow, route + " deve exibir indicador de foco");
  }

  await page.goto(new URL("/", BASE_URL).href, { waitUntil: "domcontentloaded" });
  const burger = page.locator("#burger");
  await burger.waitFor({ state: "visible" });
  await page.waitForFunction(() => !!document.querySelector("#burger") && !document.querySelector("#burger").disabled);
  await burger.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const b = document.querySelector("#burger"), m = document.querySelector("#navlinks");
    return b?.getAttribute("aria-expanded") === "true" && m?.getAttribute("aria-hidden") === "false" && !m?.hasAttribute("inert");
  });
  await page.waitForTimeout(120);
  const menuState = await page.evaluate(() => {
    const menu = document.querySelector("#navlinks");
    const close = menu?.querySelector(".nav-drawer-close");
    const active = document.activeElement;
    const style = close ? getComputedStyle(close) : null;
    return {
      burgerExpanded: document.querySelector("#burger")?.getAttribute("aria-expanded"),
      menuClass: menu?.className || "",
      menuHidden: menu?.getAttribute("aria-hidden"),
      menuInert: menu?.hasAttribute("inert") || false,
      closeExists: !!close,
      closeDisplay: style?.display || "",
      closeVisibility: style?.visibility || "",
      focusTag: active?.tagName || "",
      focusId: active?.id || "",
      focusClass: String(active?.className || ""),
      focusInMenu: !!menu?.contains(active),
      closeDisabled: close?.disabled ?? null,
      closeTabIndex: close?.tabIndex ?? null,
      closeConnected: close?.isConnected ?? false,
      inertAncestor: !!close?.closest("[inert]"),
      focusCalls: window.__luxFocusCalls || [],
      focusEvents: window.__luxFocusEvents || []
    };
  });
  console.log("Diagnóstico do menu por teclado:", JSON.stringify(menuState));
  assert.equal(menuState.focusInMenu, true, "O foco deve entrar no menu ao abri-lo");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.querySelector("#navlinks")?.contains(document.activeElement)), true,
    "Shift+Tab deve manter o foco dentro do menu");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    const b = document.querySelector("#burger"), m = document.querySelector("#navlinks");
    return b?.getAttribute("aria-expanded") === "false" && m?.getAttribute("aria-hidden") === "true" &&
      m?.hasAttribute("inert") && document.activeElement === b;
  });

  console.log("Navegação por teclado Playwright: PASS.");
  console.log(JSON.stringify({ routesChecked: routes.length, skipLinksWithVisibleFocus: routes.length,
    mobileMenu: "Enter abre, foco permanece no menu, Escape fecha e devolve foco ao botão" }, null, 2));
} finally { await browser.close(); }
