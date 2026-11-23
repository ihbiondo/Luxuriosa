(function () {
  "use strict";
  var ENDPOINT = "https://byiykxfugvxuowueuxca.supabase.co/functions/v1/cart-orders";
  var STORAGE_KEY = "luxuriosa_cart_session";
  var sessionKey = null;
  var pendingTimer = null;
  var VISIT_STORAGE_KEY = "luxuriosa_visit_session_v1";
  var VISIT_IDLE_MS = 30 * 60 * 1000;
  var HEARTBEAT_INTERVAL_MS = 30 * 1000;
  var visitContext = null;
  var lastPageViewVisitId = "";
  var heartbeatTimer = null;
  var heartbeatInFlight = false;
  var activityListenersInstalled = false;

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
      if (!consent || consent.version !== 2 || !consent.updatedAt) return null;
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
      body: JSON.stringify(Object.assign({
        session_key: getSessionKey(),
        analytics_consent: analyticsConsentGranted(),
        analytics_context: analyticsConsentGranted() ? analyticsContext() : undefined
      }, payload)),
      keepalive: true
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw new Error(data.error || "Falha ao registrar atividade.");
        return data;
      });
    });
  }
  function analyticsContext() {
    var storedKey = "luxuriosa_traffic_context_v1";
    var attribution = null;
    try {
      var raw = localStorage.getItem(storedKey);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.created_at && Date.now() - Number(parsed.created_at) < 180 * 86400000) attribution = parsed;
    } catch (_) {}
    if (!attribution) {
      var source = "unknown", detail = null, medium = "unknown", host = "";
      var params = new URLSearchParams(window.location.search || "");
      var utmSource = String(params.get("utm_source") || "").toLowerCase().slice(0, 80);
      var utmMedium = String(params.get("utm_medium") || "").toLowerCase().slice(0, 40);
      try { if (document.referrer) host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, ""); } catch (_) {}
      var candidate = utmSource || host;
      if (!candidate && !host) { source = "direct"; medium = "direct"; detail = "direct"; }
      else if (/google|bing|duckduckgo|yahoo|ecosia|brave/.test(candidate) || params.has("gclid") || params.has("gbraid") || params.has("wbraid")) {
        source = "search";
        detail = /bing/.test(candidate) ? "bing" : /duckduckgo/.test(candidate) ? "duckduckgo" : /yahoo/.test(candidate) ? "yahoo" : /ecosia/.test(candidate) ? "ecosia" : /brave/.test(candidate) ? "brave" : "google";
        medium = /cpc|ppc|paid|ads/.test(utmMedium) || params.has("gclid") || params.has("gbraid") || params.has("wbraid") ? "paid" : "organic";
      } else if (/instagram|l\.instagram/.test(candidate)) { source = "instagram"; detail = "instagram"; medium = "social"; }
      else if (/facebook|fb\.com/.test(candidate)) { source = "facebook"; detail = "facebook"; medium = "social"; }
      else if (/tiktok|vm\.tiktok/.test(candidate)) { source = "tiktok"; detail = "tiktok"; medium = "social"; }
      else if (/youtube|youtu\.be/.test(candidate)) { source = "youtube"; detail = "youtube"; medium = "social"; }
      else if (candidate) {
        source = "referral";
        detail = candidate.replace(/[^a-z0-9.-]/g, "").slice(0, 120) || "referral";
        medium = utmMedium === "email" ? "email" : "referral";
      }
      if (/cpc|ppc|paid|ads/.test(utmMedium) || params.has("gclid") || params.has("gbraid") || params.has("wbraid")) medium = "paid";
      else if (utmMedium === "email") medium = "email";
      attribution = { traffic_source: source, traffic_source_detail: detail, traffic_medium: medium, created_at: Date.now() };
      try { localStorage.setItem(storedKey, JSON.stringify(attribution)); } catch (_) {}
    }
    var ua = String(navigator.userAgent || "");
    var platform = String(navigator.platform || "");
    var os = /Android/i.test(ua) ? "android"
      : /iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "ios"
      : /Windows/i.test(ua) ? "windows"
      : /Mac OS X|Macintosh/i.test(ua) ? "macos"
      : /CrOS/i.test(ua) ? "chromeos"
      : /Linux/i.test(ua) ? "linux" : "unknown";
    var device = /iPad|Tablet/i.test(ua) || (os === "ios" && /MacIntel/.test(platform)) ||
      (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? "tablet"
      : /Mobile|Android|iPhone|iPod/i.test(ua) ? "mobile" : "desktop";
    var browser = /SamsungBrowser/i.test(ua) ? "samsung_internet"
      : /Edg\//i.test(ua) || /EdgiOS/i.test(ua) ? "edge"
      : /OPR\//i.test(ua) ? "opera"
      : /Firefox\//i.test(ua) || /FxiOS/i.test(ua) ? "firefox"
      : /Chrome\//i.test(ua) || /CriOS/i.test(ua) ? "chrome"
      : /Safari\//i.test(ua) ? "safari" : "other";
    return {
      traffic_source: attribution.traffic_source || "unknown",
      traffic_source_detail: attribution.traffic_source_detail || null,
      traffic_medium: attribution.traffic_medium || "unknown",
      device_category: device,
      operating_system: os,
      browser_family: browser
    };
  }
  function isValidUuid(value) {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  function normalizeVisitUtm(value) {
    if (typeof value !== "string") return null;
    var cleaned = value.normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
      .replace(/[^\p{L}\p{N} ._:/+-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    return cleaned || null;
  }

  function visitAnalyticsContext() {
    var context = analyticsContext();
    var params = new URLSearchParams(window.location.search || "");
    var utmSource = normalizeVisitUtm(params.get("utm_source"));
    var utmMedium = normalizeVisitUtm(params.get("utm_medium"));
    var utmCampaign = normalizeVisitUtm(params.get("utm_campaign"));
    var utmContent = normalizeVisitUtm(params.get("utm_content"));
    var utmTerm = normalizeVisitUtm(params.get("utm_term"));
    var utmId = normalizeVisitUtm(params.get("utm_id"));
    var host = "";
    try {
      if (document.referrer) host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, "");
    } catch (_) {}

    var isInternalReferrer = host === "luxuriosa.com.br" || /\.luxuriosa\.com\.br$/.test(host);
    var candidate = utmSource || (isInternalReferrer ? "" : host);
    var hasAdClick = params.has("gclid") || params.has("gbraid") || params.has("wbraid");
    if (!candidate && hasAdClick) candidate = "google";

    var source = "direct", detail = "direct", medium = "direct";
    if (candidate) {
      if (/google|bing|duckduckgo|yahoo|ecosia|brave/.test(candidate)) {
        source = "search";
        detail = /bing/.test(candidate) ? "bing"
          : /duckduckgo/.test(candidate) ? "duckduckgo"
          : /yahoo/.test(candidate) ? "yahoo"
          : /ecosia/.test(candidate) ? "ecosia"
          : /brave/.test(candidate) ? "brave" : "google";
        medium = "organic";
      } else if (/instagram|l\.instagram/.test(candidate)) {
        source = "instagram"; detail = "instagram"; medium = "social";
      } else if (/facebook|fb\.com/.test(candidate)) {
        source = "facebook"; detail = "facebook"; medium = "social";
      } else if (/tiktok|vm\.tiktok/.test(candidate)) {
        source = "tiktok"; detail = "tiktok"; medium = "social";
      } else if (/youtube|youtu\.be/.test(candidate)) {
        source = "youtube"; detail = "youtube"; medium = "social";
      } else {
        source = "referral";
        detail = candidate.replace(/[^a-z0-9.-]/g, "").slice(0, 120) || "referral";
        medium = "referral";
      }
    }
    if (hasAdClick || /cpc|ppc|paid|ads/.test(String(utmMedium || "").toLowerCase())) medium = "paid";
    else if (String(utmMedium || "").toLowerCase() === "email") medium = "email";
    else if (String(utmMedium || "").toLowerCase() === "social") medium = "social";
    else if (String(utmMedium || "").toLowerCase() === "organic") medium = "organic";
    else if (String(utmMedium || "").toLowerCase() === "referral") medium = "referral";

    return Object.assign({}, context, {
      traffic_source: source,
      traffic_source_detail: detail,
      traffic_medium: medium,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      utm_id: utmId
    });
  }

  function readStoredVisit() {
    try {
      var raw = sessionStorage.getItem(VISIT_STORAGE_KEY);
      var visit = raw ? JSON.parse(raw) : null;
      if (!visit || !isValidUuid(visit.visit_id)) return null;
      var lastActivity = Number(visit.last_activity_at);
      if (!Number.isFinite(lastActivity) || lastActivity > Date.now() ||
          Date.now() - lastActivity > VISIT_IDLE_MS) return null;
      if (!visit.analytics_context || typeof visit.analytics_context !== "object") return null;
      return visit;
    } catch (_) { return null; }
  }

  function persistVisit(visit) {
    visitContext = visit;
    try { sessionStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(visit)); } catch (_) {}
    return visit;
  }

  function getCurrentVisit() {
    if (visitContext && isValidUuid(visitContext.visit_id) &&
        Number.isFinite(Number(visitContext.last_activity_at)) &&
        Date.now() - Number(visitContext.last_activity_at) <= VISIT_IDLE_MS) {
      return visitContext;
    }
    var stored = readStoredVisit();
    if (stored) return persistVisit(stored);
    return persistVisit({
      visit_id: uuid(),
      last_activity_at: Date.now(),
      analytics_context: visitAnalyticsContext()
    });
  }

  function visitRequestFields(visit) {
    var path = String(window.location.pathname || "/").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").slice(0, 300);
    if (!path || path.charAt(0) !== "/" || path.indexOf("//") === 0) path = "/";
    var title = String(document.title || "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim().slice(0, 180) || null;

    // Educação sexual e experiências pessoais não devem revelar o artigo,
    // tema ou resultado individual nos relatórios de navegação.
    if (/^\/educacao(?:\/|$)/i.test(path)) {
      path = "/educacao/";
      title = "Conteúdo educativo | Luxuriosa";
    } else if (/^\/experiencias(?:\/|$)/i.test(path)) {
      path = "/experiencias/";
      title = "Experiências | Luxuriosa";
    }

    return {
      visit_id: visit.visit_id,
      page_path: path,
      page_title: title,
      analytics_context: visit.analytics_context
    };
  }

  function markVisitActivity() {
    if (!analyticsConsentGranted()) return;
    var previousId = visitContext && visitContext.visit_id;
    var visit = getCurrentVisit();
    if (previousId && previousId !== visit.visit_id) {
      registrarEvento("page_view");
      return;
    }
    visit.last_activity_at = Date.now();
    persistVisit(visit);
  }

  function recordSiteEvent(eventName, options, visit) {
    options = options || {};
    var payload = Object.assign({
      action: "site_event",
      analytics_consent: true,
      event_name: eventName,
      page_type: options.page_type || pageType()
    }, visitRequestFields(visit));
    if (options.product_id != null) payload.product_id = String(options.product_id).slice(0, 100);
    if (Number.isInteger(options.quantity) && options.quantity >= 1 && options.quantity <= 99) payload.quantity = options.quantity;
    return send(payload).then(function (result) {
      if (eventName === "page_view") lastPageViewVisitId = visit.visit_id;
      visit.last_activity_at = Date.now();
      persistVisit(visit);
      return result;
    }).catch(function (error) {
      console.warn("Luxuriosa: evento analítico não registrado.", error);
      return { error: true };
    });
  }

  function sendHeartbeat(force) {
    if (!analyticsConsentGranted()) return Promise.resolve({ skipped: true });
    if (!force && document.visibilityState === "hidden") return Promise.resolve({ skipped: true });
    if (heartbeatInFlight) return Promise.resolve({ skipped: true });
    var visit = getCurrentVisit();
    if (lastPageViewVisitId !== visit.visit_id) {
      return recordSiteEvent("page_view", {}, visit);
    }
    heartbeatInFlight = true;
    var payload = Object.assign({
      action: "visitor_heartbeat",
      page_type: pageType()
    }, visitRequestFields(visit));
    return send(payload).then(function (result) {
      visit.last_activity_at = Date.now();
      persistVisit(visit);
      return result;
    }).catch(function (error) {
      console.warn("Luxuriosa: presença da visita não atualizada.", error);
      return { error: true };
    }).then(function (result) {
      heartbeatInFlight = false;
      return result;
    });
  }

  function stopHeartbeatAndResetVisit() {
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    heartbeatInFlight = false;
    visitContext = null;
    lastPageViewVisitId = "";
    try { sessionStorage.removeItem(VISIT_STORAGE_KEY); } catch (_) {}
  }

  function startHeartbeat() {
    if (heartbeatTimer !== null) return;
    heartbeatTimer = window.setInterval(function () {
      if (document.visibilityState !== "hidden") sendHeartbeat(false);
    }, HEARTBEAT_INTERVAL_MS);
  }

  function installVisitActivityListeners() {
    if (activityListenersInstalled) return;
    activityListenersInstalled = true;
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach(function (eventName) {
      document.addEventListener(eventName, markVisitActivity, true);
    });
    document.addEventListener("visibilitychange", function () {
      if (!analyticsConsentGranted()) return;
      if (document.visibilityState === "hidden") sendHeartbeat(true);
      else sendHeartbeat(false);
    });
    window.addEventListener("pagehide", function () {
      if (analyticsConsentGranted()) sendHeartbeat(true);
    });
  }

  function pageType() {
    var path = window.location.pathname || "/";
    if (/\/produtos\//i.test(path)) return "product";
    if (path === "/" || /index\.html$/i.test(path)) return "home";
    if (/loja\.html$/i.test(path)) return "catalog";
    if (/checkout|pedido/i.test(path)) return "checkout";
    if (/atendimento|sobre|privacidade|faq|cidades\//i.test(path)) return "institutional";
    return "other";
  }
  function registrarEvento(eventName, options) {
    if (!analyticsConsentGranted()) return Promise.resolve({ skipped: true });
    var visit = getCurrentVisit();
    if (eventName !== "page_view" && lastPageViewVisitId !== visit.visit_id) {
      return recordSiteEvent("page_view", {}, visit).then(function () {
        return recordSiteEvent(eventName, options || {}, visit);
      });
    }
    return recordSiteEvent(eventName, options || {}, visit);
  }
  function normalizeItems(items) {
    return (Array.isArray(items) ? items : []).slice(0, 80).map(function (item) {
      return { id: item.id, nome: String(item.nome || item.name || "Produto").slice(0, 180),
        quantidade: Number(item.quantidade) || 1, preco: Number(item.preco) || 0, sku: item.sku || null,
        kit_variant_id: item.kit_variant_id == null ? null : String(item.kit_variant_id),
        kit_variant_name: String(item.kit_variant_name || "").slice(0, 80) };
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

  function ensurePrivacyPreferencesLoaded() {
    var path = window.location.pathname || "/";
    if (!/^\/(?:educacao|experiencias)(?:\/|$)/i.test(path)) return;
    if (document.querySelector('script[src*="consentimento-area.js"], script[data-luxuriosa-consent-preferences="true"]')) return;

    // Preserva as confirmações de idade próprias dessas duas áreas.
    document.documentElement.setAttribute("data-lux-skip-global-age-gate", "true");
    var script = document.createElement("script");
    script.src = "/js/consentimento-area.js?v=20261123-area-consent-v1";
    script.async = true;
    script.setAttribute("data-luxuriosa-consent-preferences", "true");
    (document.head || document.documentElement).appendChild(script);
  }

  ensurePrivacyPreferencesLoaded();

  var pageViewRecorded = false;
  function trackPageViewIfAllowed() {
    if (!analyticsConsentGranted()) {
      pageViewRecorded = false;
      stopHeartbeatAndResetVisit();
      return;
    }
    installVisitActivityListeners();
    startHeartbeat();
    if (pageViewRecorded) return;
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