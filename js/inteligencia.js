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
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }
  function getSessionKey() {
    if (sessionKey) return sessionKey;
    try { sessionKey = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    if (!sessionKey) {
      sessionKey = uuid();
      try { localStorage.setItem(STORAGE_KEY, sessionKey); } catch (_) {}
    }
    return sessionKey;
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
      method: "POST",
      headers: headers,
      body: JSON.stringify(Object.assign({ session_key: getSessionKey() }, payload)),
      keepalive: true
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw new Error(data.error || "Falha ao registrar atividade.");
        return data;
      });
    });
  }
  function normalizeItems(items) {
    return (Array.isArray(items) ? items : []).slice(0, 80).map(function (item) {
      return {
        id: item.id,
        nome: String(item.nome || item.name || "Produto").slice(0, 180),
        quantidade: Number(item.quantidade) || 1,
        preco: Number(item.preco) || 0,
        sku: item.sku || null
      };
    });
  }
  function registrarCarrinho(items) {
    clearTimeout(pendingTimer);
    var snapshot = normalizeItems(items);
    pendingTimer = setTimeout(function () {
      send({ action: "cart_snapshot", items: snapshot }).catch(function (error) {
        console.warn("Luxuriosa: não foi possível sincronizar o carrinho.", error);
      });
    }, 900);
  }
  function registrarEtapa(action, items) {
    return send({ action: action, items: normalizeItems(items) });
  }
  function registrarPedido(items, customer, shippingAmount) {
    return send({
      action: "whatsapp_opened",
      items: normalizeItems(items),
      customer: customer,
      shipping_amount: shippingAmount
    });
  }

  window.LuxuriosaInteligencia = {
    registrarCarrinho: registrarCarrinho,
    registrarEtapa: registrarEtapa,
    registrarPedido: registrarPedido,
    obterSessao: getSessionKey
  };
})();