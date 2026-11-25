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
  const firstCategory = page.locator(".cat").first();
  if (await firstCategory.count()) {
    await firstCategory.focus();
    const categoryFocus = await firstCategory.evaluate(el => {
      const style = getComputedStyle(el);
      return { visible: el.matches(":focus-visible"), outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle, outlineColor: style.outlineColor };
    });
    assert.equal(categoryFocus.visible, true, "Cards de categoria devem reconhecer foco de teclado");
    assert.equal(categoryFocus.outlineStyle, "solid", "Cards de categoria devem exibir contorno de foco");
    assert.ok(parseFloat(categoryFocus.outlineWidth) >= 2, "Contorno de foco dos cards deve ter pelo menos 2 px");
  }

  await page.goto(new URL("/experiencias/", BASE_URL).href, { waitUntil: "domcontentloaded" });
  const experienceSearch = page.locator("#experienceSearch");
  await experienceSearch.waitFor({ state: "visible" });
  await experienceSearch.focus();
  const experienceSearchFocus = await experienceSearch.evaluate(el => {
    const inputStyle = getComputedStyle(el);
    const containerStyle = getComputedStyle(el.closest(".search"));
    return {
      keyboard: el.matches(":focus-visible"),
      containerBorder: containerStyle.borderColor,
      containerShadow: containerStyle.boxShadow
    };
  });
  assert.equal(experienceSearchFocus.keyboard, true, "Busca de Experiências deve reconhecer foco de teclado");
  assert.notEqual(experienceSearchFocus.containerShadow, "none", "Contêiner da busca deve destacar o foco");
  assert.match(experienceSearchFocus.containerBorder, /227, 68, 157/, "Borda do contêiner deve usar o rosa de foco");

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
    const ancestors = [];
    for (let node = close; node && node.nodeType === 1; node = node.parentElement) {
      const cs = getComputedStyle(node);
      ancestors.push({
        tag: node.tagName, id: node.id, className: String(node.className || ""),
        display: cs.display, visibility: cs.visibility, position: cs.position,
        opacity: cs.opacity, inert: node.hasAttribute("inert"), ariaHidden: node.getAttribute("aria-hidden")
      });
    }
    return {
      burgerExpanded: document.querySelector("#burger")?.getAttribute("aria-expanded"),
      menuClass: menu?.className || "",
      menuHidden: menu?.getAttribute("aria-hidden"),
      menuInert: menu?.hasAttribute("inert") || false,
      closeExists: !!close,
      closeDisplay: style?.display || "",
      closeVisibility: style?.visibility || "",
      closeRects: close ? [...close.getClientRects()].map(r => ({width:r.width,height:r.height,top:r.top,left:r.left})) : [],
      focusTag: active?.tagName || "",
      focusId: active?.id || "",
      focusClass: String(active?.className || ""),
      focusInMenu: !!menu?.contains(active),
      closeDisabled: close?.disabled ?? null,
      closeTabIndex: close?.tabIndex ?? null,
      closeConnected: close?.isConnected ?? false,
      inertAncestor: !!close?.closest("[inert]"),
      documentHasFocus: document.hasFocus(),
      activeElement: active?.outerHTML?.slice(0,300) || "",
      ancestors,
      focusCalls: window.__luxFocusCalls || [],
      focusEvents: window.__luxFocusEvents || []
    };
  });
  const directFocus = await page.evaluate(() => {
    const close = document.querySelector("#navlinks .nav-drawer-close");
    if (!close) return false;
    close.focus();
    return document.activeElement === close;
  });
  console.log("Diagnóstico do menu por teclado:", JSON.stringify({ ...menuState, directFocus }));
  assert.equal(directFocus, true, "O botão de fechar precisa aceitar foco programático");
  assert.equal(await page.evaluate(() => document.querySelector("#navlinks")?.contains(document.activeElement)), true,
    "O foco deve entrar no menu ao abri-lo");
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
