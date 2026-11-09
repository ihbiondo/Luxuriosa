(function () {
  "use strict";
  var ENDPOINT = "https://byiykxfugvxuowueuxca.supabase.co/functions/v1/cart-orders";
  var STORAGE_KEY = "luxuriosa_cart_session";
  var sessionKey = null;
  var pendingTimer = null;

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return c === "x" ? r : (r & 3 | 8).toString(16);
    });
  }
  function getSessionKey() {
    if (sessionKey) return sessionKey;
    var createdAt = 0;
    try {
      sessionKey = localStorage.getItem(STORAGE_KEY);
      createdAt = Number(localStorage.getItem(STORAGE_KEY + "_created_at")) || 0;
    } catch (_) {}
    var validKey = typeof sessionKey === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionKey);
    if (!validKey || !createdAt || createdAt > Date.now() ||
        Date.now() - createdAt > 180 * 86400000) {
      sessionKey = uuid();
      try {
        localStorage.setItem(STORAGE_KEY, sessionKey);
        localStorage.setItem(STORAGE_KEY + "_created_at", String(Date.now()));
      } catch (_) {}
    }
    return sessionKey;
  }
  function readConsent() {
    try {
      var consent = JSON.parse(localStorage.getItem("lux_cookie_consent_v1") || "null");
      if (!consent || consent.version !== 1 || !consent.updatedAt) return null;
      var updated = new Date(consent.updatedAt).getTime();
      if (!Number.isFinite(updated) || updated > Date.now() || Date.now() - updated > 180 * 86400000) return null;
      return consent;
    } catch (_) { return null; }
  }
  function analyticsConsentGranted() {
    var consent = readConsent();
    return !!(consent && consent.analytics === true);
  }
  function marketingConsentGranted() {
    var consent = readConsent();
    return !!(consent && consent.marketing === true);
  }
  function getAccessToken() {
    try {
      var raw = localStorage.getItem("sb-byiykxfugvxuowueuxca-auth-token");
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.access_token ? parsed.access_token : "";
    } catch (_) { return ""; }
  }
  function send(payload) {
    var headers = { "content-type": "application/json", "apikey": "sb_publishable_LaMbeWQ1PNANEQ85SD_35Q_wDzswy8y" };
    var token = getAccessToken();
    if (token) headers.authorization = "Bearer " + token;
    return fetch(ENDPOINT, {
      method: "POST", headers: headers,
      body: JSON.stringify(Object.assign({ session_key: getSessionKey() }, payload)),
      keepalive: true
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw new Error(data.error || "Falha ao registrar atividade.");
        return data;
      });
    });
  }
  function pageType() {
    var path = window.location.pathname || "/";
    if (/\/produtos\//i.test(path)) return "product";
    if (path === "/" || /index\.html$/i.test(path)) return "home";
    if (/loja\.html$/i.test(path)) return "catalog";
    if (/checkout|pedido/i.test(path)) return "checkout";
    if (/atendimento|sobre|privacidade|faq/i.test(path)) return "institutional";
    return "other";
  }
  function registrarEvento(eventName, options) {
    if (!analyticsConsentGranted()) return Promise.resolve({ skipped: true });
    options = options || {};
    var payload = {
      action: "site_event", analytics_consent: true,
      event_name: eventName, page_type: options.page_type || pageType()
    };
    if (options.product_id != null) payload.product_id = String(options.product_id).slice(0, 100);
    if (Number.isInteger(options.quantity) && options.quantity >= 1 && options.quantity <= 99) payload.quantity = options.quantity;
    return send(payload).catch(function (error) {
      console.warn("Luxuriosa: evento analítico não registrado.", error);
      return { error: true };
    });
  }
  function normalizeItems(items) {
    return (Array.isArray(items) ? items : []).slice(0, 80).map(function (item) {
      return { id: item.id, nome: String(item.nome || item.name || "Produto").slice(0, 180),
        quantidade: Number(item.quantidade) || 1, preco: Number(item.preco) || 0, sku: item.sku || null };
    });
  }
  function registrarCarrinho(items) {
    if (!analyticsConsentGranted()) return;
    clearTimeout(pendingTimer);
    var snapshot = normalizeItems(items);
    pendingTimer = setTimeout(function () {
      send({ action: "cart_snapshot", items: snapshot }).catch(function (error) {
        console.warn("Luxuriosa: não foi possível sincronizar o carrinho.", error);
      });
    }, 900);
  }
  function registrarEtapa(action, items, customer) {
    var explicitWhatsAppOptIn = action === "checkout_reviewed" && customer && customer.marketingWhatsappOptIn === true;
    if (!analyticsConsentGranted() && !explicitWhatsAppOptIn) return Promise.resolve({ skipped: true });
    return send({
      action: action, items: normalizeItems(items),
      customer: explicitWhatsAppOptIn ? customer : undefined
    }).then(function (result) {
      if (action === "checkout_started" || action === "checkout_reviewed") registrarEvento(action);
      return result;
    });
  }
  function registrarPedido(items, customer, shippingAmount) {
    return send({
      action: "whatsapp_opened", items: normalizeItems(items),
      customer: customer, shipping_amount: shippingAmount
    }).then(function (result) {
      registrarEvento("whatsapp_opened");
      return result;
    });
  }

  window.LuxuriosaInteligencia = {
    registrarCarrinho: registrarCarrinho,
    registrarEtapa: registrarEtapa,
    registrarPedido: registrarPedido,
    registrarEvento: registrarEvento,
    obterSessao: getSessionKey
  };

  var pageViewRecorded = false;
  function trackPageViewIfAllowed() {
    if (pageViewRecorded || !analyticsConsentGranted()) return;
    pageViewRecorded = true;
    registrarEvento("page_view");
    if (pageType() === "product") {
      var productButton = document.querySelector("[data-product-id]");
      if (productButton) registrarEvento("product_view", { product_id: productButton.getAttribute("data-product-id") });
    }
  }
  window.addEventListener("lux:consent-updated", trackPageViewIfAllowed);
  trackPageViewIfAllowed();
})();