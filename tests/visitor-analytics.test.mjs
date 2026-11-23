import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("js/inteligencia.js", "utf8");
const CONSENT_KEY = "lux_cookie_consent_v1";
const BASE_TIME = Date.parse("2026-11-23T14:00:00-03:00");

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
    _values: values
  };
}

function consent(analytics = true, at = BASE_TIME) {
  return JSON.stringify({
    version: 2,
    updatedAt: new Date(at).toISOString(),
    necessary: true,
    analytics,
    marketing: false
  });
}

function createHarness({
  now = BASE_TIME,
  url = "https://luxuriosa.com.br/",
  referrer = "",
  title = "Luxuriosa | Lingerie & Intimidade",
  analytics = true,
  localStorage = createStorage({ [CONSENT_KEY]: consent(analytics, now) }),
  sessionStorage = createStorage()
} = {}) {
  let currentTime = now;
  let uuidCount = 0;
  const requests = [];
  const windowListeners = new Map();
  const documentListeners = new Map();
  let intervalCallback = null;
  let intervalDelay = null;
  let intervalId = 0;
  let clearedInterval = false;

  class ControlledDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [currentTime]));
    }
    static now() { return currentTime; }
  }

  const window = {
    location: new URL(url),
    crypto: {
      randomUUID() {
        uuidCount += 1;
        return "00000000-0000-4000-8000-" + String(uuidCount).padStart(12, "0");
      }
    },
    addEventListener(name, callback) {
      const callbacks = windowListeners.get(name) || [];
      callbacks.push(callback);
      windowListeners.set(name, callbacks);
    },
    setInterval(callback, delay) {
      intervalCallback = callback;
      intervalDelay = delay;
      intervalId += 1;
      return intervalId;
    },
    clearInterval(id) {
      if (id === intervalId) {
        intervalCallback = null;
        clearedInterval = true;
      }
    },
    _listeners: windowListeners
  };

  const document = {
    title,
    referrer,
    visibilityState: "visible",
    addEventListener(name, callback) {
      const callbacks = documentListeners.get(name) || [];
      callbacks.push(callback);
      documentListeners.set(name, callbacks);
    },
    querySelector() { return null; },
    _listeners: documentListeners
  };

  const navigator = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36",
    platform: "Win32",
    maxTouchPoints: 0
  };

  const fetch = async (urlValue, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    requests.push({ url: String(urlValue), body, options });
    return {
      ok: true,
      json: async () => ({ ok: true })
    };
  };

  vm.runInNewContext(source, {
    window,
    document,
    navigator,
    localStorage,
    sessionStorage,
    fetch,
    URL,
    URLSearchParams,
    Date: ControlledDate,
    console,
    setTimeout,
    clearTimeout
  }, { filename: "js/inteligencia.js" });

  return {
    window,
    document,
    localStorage,
    sessionStorage,
    requests,
    get intervalCallback() { return intervalCallback; },
    get intervalDelay() { return intervalDelay; },
    get clearedInterval() { return clearedInterval; },
    async settle() {
      for (let i = 0; i < 5; i += 1) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  };
}

test("page views, eventos e heartbeat compartilham o mesmo identificador de visita", async () => {
  const harness = createHarness({
    url: "https://luxuriosa.com.br/?utm_source=instagram&utm_medium=social&utm_campaign=novembro"
  });
  await harness.settle();

  const pageView = harness.requests.find(request => request.body.event_name === "page_view");
  assert.ok(pageView, "A visita deve começar com um page_view após o consentimento.");
  assert.match(pageView.body.visit_id, /^[0-9a-f-]{36}$/i);
  assert.equal(pageView.body.page_path, "/");
  assert.equal(pageView.body.page_title, "Luxuriosa | Lingerie & Intimidade");
  assert.equal(pageView.body.analytics_context.traffic_source, "instagram");
  assert.equal(pageView.body.analytics_context.traffic_medium, "social");
  assert.equal(pageView.body.analytics_context.utm_campaign, "novembro");

  await harness.window.LuxuriosaInteligencia.registrarEvento("add_to_cart", {
    product_id: "31",
    quantity: 2
  });
  await harness.settle();

  const addToCart = harness.requests.find(request => request.body.event_name === "add_to_cart");
  assert.ok(addToCart, "A inclusão no carrinho deve gerar evento.");
  assert.equal(addToCart.body.visit_id, pageView.body.visit_id);
  assert.equal(addToCart.body.product_id, "31");
  assert.equal(addToCart.body.quantity, 2);

  assert.equal(harness.intervalDelay, 30_000, "O heartbeat deve ocorrer a cada 30 segundos.");
  assert.equal(typeof harness.intervalCallback, "function");
  harness.intervalCallback();
  await harness.settle();

  const heartbeat = harness.requests.find(request => request.body.action === "visitor_heartbeat");
  assert.ok(heartbeat, "A página visível deve enviar heartbeats.");
  assert.equal(heartbeat.body.visit_id, pageView.body.visit_id);
  assert.equal(heartbeat.body.page_path, "/");
  assert.equal(heartbeat.body.analytics_consent, true);
});

test("a visita permanece entre páginas e é renovada após 30 minutos sem atividade", async () => {
  const firstPage = createHarness({
    url: "https://luxuriosa.com.br/?utm_source=instagram&utm_medium=social&utm_campaign=novembro"
  });
  await firstPage.settle();
  const firstVisitId = firstPage.requests.find(request => request.body.event_name === "page_view")?.body.visit_id;
  assert.ok(firstVisitId);

  const secondPageTime = BASE_TIME + 2 * 60_000;
  const secondPage = createHarness({
    now: secondPageTime,
    url: "https://luxuriosa.com.br/loja.html",
    referrer: "https://luxuriosa.com.br/",
    localStorage: firstPage.localStorage,
    sessionStorage: firstPage.sessionStorage
  });
  await secondPage.settle();
  const secondPageView = secondPage.requests.find(request => request.body.event_name === "page_view");
  assert.ok(secondPageView);
  assert.equal(secondPageView.body.visit_id, firstVisitId, "Navegar para outra página não deve criar outra visita.");
  assert.equal(secondPageView.body.page_path, "/loja.html");
  assert.equal(secondPageView.body.analytics_context.traffic_source, "instagram");
  assert.equal(secondPageView.body.analytics_context.utm_campaign, "novembro");

  const thirdPageTime = BASE_TIME + 33 * 60_000;
  const thirdPage = createHarness({
    now: thirdPageTime,
    url: "https://luxuriosa.com.br/atendimento.html",
    referrer: "https://luxuriosa.com.br/loja.html",
    localStorage: secondPage.localStorage,
    sessionStorage: secondPage.sessionStorage
  });
  await thirdPage.settle();
  const thirdPageView = thirdPage.requests.find(request => request.body.event_name === "page_view");
  assert.ok(thirdPageView);
  assert.notEqual(thirdPageView.body.visit_id, firstVisitId, "Mais de 30 minutos sem atividade deve iniciar uma nova visita.");
  assert.equal(thirdPageView.body.analytics_context.traffic_source, "direct");
  assert.equal(thirdPageView.body.analytics_context.utm_campaign, null);
});

test("sem consentimento analítico não registra eventos nem inicia heartbeat", async () => {
  const harness = createHarness({ analytics: false });
  await harness.settle();
  assert.equal(harness.requests.length, 0);
  assert.equal(harness.intervalCallback, null);

  harness.localStorage.setItem(CONSENT_KEY, consent(true));
  for (const callback of harness.window._listeners.get("lux:consent-updated") || []) callback();
  await harness.settle();

  assert.ok(harness.requests.some(request => request.body.event_name === "page_view"));
  assert.equal(typeof harness.intervalCallback, "function");
});
