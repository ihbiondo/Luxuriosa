/* Luxuriosa — confirmação 18+ e preferências de privacidade */
(function () {
  "use strict";
  var CONSENT_KEY = "lux_cookie_consent_v1";
  var CONSENT_VERSION = 1;
  var GA_ID = "G-PP3SPL55B0";
  var consent = null;
  var gaLoaded = false;

  function readConsent() {
    try {
      var value = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
      if (!value || value.version !== CONSENT_VERSION || !value.updatedAt) return null;
      if (Date.now() - new Date(value.updatedAt).getTime() > 180 * 24 * 60 * 60 * 1000) return null;
      return value;
    } catch (e) { return null; }
  }

  function saveConsent(analytics, marketing) {
    consent = { version: CONSENT_VERSION, updatedAt: new Date().toISOString(),
      necessary: true, analytics: !!analytics, marketing: !!marketing };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(consent)); } catch (e) {}
    applyConsent();
    closeConsent();
  }

  function loadAnalytics() {
    if (gaLoaded || !consent || !consent.analytics) return;
    gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied"
    });
    window.gtag("consent", "update", {
      analytics_storage: "granted", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied"
    });
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { anonymize_ip: true });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(script);
  }

  function applyConsent() { if (consent && consent.analytics) loadAnalytics(); }

  function addStyles() {
    if (document.getElementById("lux-consent-styles")) return;
    var style = document.createElement("style");
    style.id = "lux-consent-styles";
    style.textContent = [
      "#gate.overlay{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.84);backdrop-filter:blur(5px)}#gate.overlay.open{display:flex}#gate .gate{width:min(100%,470px);max-height:90vh;overflow:auto;padding:34px 30px;border:1px solid rgba(212,175,124,.6);border-radius:18px;background:linear-gradient(145deg,#1b0b11,#090809);color:#f7f0e8;text-align:center;box-shadow:0 24px 90px #000}#gate .gate h3{color:#e5c18e;font-family:Georgia,serif;font-size:27px}#gate .gate p{color:#d0c7c5;line-height:1.6}#gate .buttons{display:flex;flex-direction:column;gap:12px;margin-top:22px}#gate .buttons .btn{width:100%;justify-content:center}#lux-cookie-overlay{position:fixed;inset:0;z-index:10001;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.82);backdrop-filter:blur(5px);font-family:Montserrat,Arial,sans-serif;color:#f7f0e8}",
      "#lux-cookie-overlay.open{display:flex}",
      "#lux-cookie-panel{width:min(100%,560px);max-height:min(90vh,780px);overflow:auto;background:linear-gradient(145deg,#1b0b11,#090809);border:1px solid rgba(212,175,124,.55);border-radius:18px;padding:30px;box-shadow:0 24px 90px #000;position:relative}",
      "#lux-cookie-panel h2{font-family:'Playfair Display',Georgia,serif;color:#e5c18e;font-size:26px;margin:0 35px 12px 0}",
      "#lux-cookie-panel p{color:#d0c7c5;font-size:14px;line-height:1.65;margin:0 0 18px}",
      ".lux-cookie-close{position:absolute;right:18px;top:14px;background:none;border:0;color:#c8bdbb;font-size:26px;cursor:pointer}",
      ".lux-cookie-option{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:17px 0;border-top:1px solid rgba(255,255,255,.1)}",
      ".lux-cookie-option strong{display:block;font-size:14px;color:#fff}.lux-cookie-option small{display:block;color:#b9aeac;font-size:12px;line-height:1.5;margin-top:5px}",
      ".lux-cookie-pill{font-size:11px;color:#d8c5a8;border:1px solid rgba(212,175,124,.3);border-radius:20px;padding:5px 9px;white-space:nowrap}",
      ".lux-switch{width:44px;height:25px;flex:0 0 44px;position:relative}.lux-switch input{position:absolute;opacity:0;width:1px;height:1px}.lux-switch span{position:absolute;inset:0;background:#555;border-radius:20px;cursor:pointer;transition:.2s}.lux-switch span:before{content:'';position:absolute;width:17px;height:17px;left:4px;top:4px;border-radius:50%;background:#fff;transition:.2s}.lux-switch input:checked+span{background:#9a7040}.lux-switch input:checked+span:before{transform:translateX(19px)}.lux-switch input:focus-visible+span{outline:2px solid #e5c18e;outline-offset:3px}",
      ".lux-cookie-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:22px}.lux-cookie-actions button{flex:1;min-width:125px;border:1px solid #8f704e;border-radius:30px;padding:13px 15px;background:transparent;color:#f5eee7;font:500 12px Montserrat,Arial;cursor:pointer}.lux-cookie-actions .lux-primary{background:linear-gradient(100deg,#d6b47e,#f0d4a2);color:#1a1010;border-color:transparent}.lux-cookie-actions button:hover{filter:brightness(1.12)}",
      "#lux-cookie-panel a{color:#d8bd91;text-decoration:underline;font-size:12px}",
      "body.lux-consent-open{overflow:hidden}",".lux-cookie-preferences-link{text-align:center;margin:14px auto;padding:8px}.lux-cookie-preferences-link a{color:#d8bd91;font-size:12px}.lux-cookie-fallback-footer{padding:16px;text-align:center;background:#10090c;border-top:1px solid rgba(212,175,124,.2)}",
      "@media(max-width:560px){#lux-cookie-panel{padding:24px 20px;border-radius:15px}.lux-cookie-actions{flex-direction:column}.lux-cookie-actions button{width:100%}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensureAgeGate() {
    var gate = document.getElementById("gate");
    if (!gate) {
      gate = document.createElement("div");
      gate.id = "gate";
      gate.className = "overlay";
      gate.setAttribute("role", "dialog");
      gate.setAttribute("aria-modal", "true");
      gate.setAttribute("aria-labelledby", "gateTitle");
      gate.innerHTML = '<div class="gate"><div class="gate-icon" aria-hidden="true">♡</div><div class="kicker">Luxuriosa</div><h3 id="gateTitle">Conteúdo para maiores de 18</h3><p>A Luxuriosa é um sexshop com produtos para intimidade e prazer, além de lingerie selecionada. Nossos produtos são destinados exclusivamente a adultos.</p><p>Você tem 18 anos ou mais?</p><div class="buttons"><button class="btn primary" id="gateYes" type="button">Sim, tenho 18+</button><a class="btn ghost" href="https://www.google.com.br">Sair</a></div></div>';
      document.body.appendChild(gate);
    }
    return gate;
  }

  function createConsentPanel() {
    if (document.getElementById("lux-cookie-overlay")) return;
    var overlay = document.createElement("div");
    overlay.id = "lux-cookie-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "luxCookieTitle");
    overlay.innerHTML = '<section id="lux-cookie-panel"><button class="lux-cookie-close" type="button" aria-label="Fechar preferências" data-cookie-close>×</button><h2 id="luxCookieTitle">Sua privacidade importa</h2><p>Utilizamos cookies para melhorar sua experiência e entender como a loja é utilizada. Você escolhe quais dados opcionais autoriza. Os cookies necessários permanecem ativos para o funcionamento e a segurança do site.</p><div class="lux-cookie-option"><div><strong>Necessários</strong><small>Funcionamento do site, carrinho e segurança.</small></div><span class="lux-cookie-pill">Sempre ativos</span></div><div class="lux-cookie-option"><div><strong>Estatísticas e análise</strong><small>Dados de navegação e desempenho, por meio do Google Analytics.</small></div><label class="lux-switch"><input id="luxAnalytics" type="checkbox"><span></span></label></div><div class="lux-cookie-option"><div><strong>Marketing</strong><small>Mensuração de campanhas e publicidade. Nenhuma ferramenta de marketing será ativada enquanto não estiver integrada.</small></div><label class="lux-switch"><input id="luxMarketing" type="checkbox"><span></span></label></div><p><a href="' + (location.pathname.indexOf("/produtos/") === 0 ? "../privacidade.html" : "privacidade.html") + '">Leia nossa Política de Privacidade</a></p><div class="lux-cookie-actions"><button type="button" data-cookie-reject>Rejeitar opcionais</button><button type="button" data-cookie-custom>Personalizar</button><button type="button" class="lux-primary" data-cookie-accept>Aceitar todos</button></div><div class="lux-cookie-actions" id="lux-cookie-save-row" hidden><button type="button" class="lux-primary" data-cookie-save>Salvar minhas preferências</button></div></section>';
    document.body.appendChild(overlay);
    overlay.querySelector("[data-cookie-reject]").addEventListener("click", function () { saveConsent(false, false); });
    overlay.querySelector("[data-cookie-accept]").addEventListener("click", function () { saveConsent(true, true); });
    overlay.querySelector("[data-cookie-custom]").addEventListener("click", function () {
      document.getElementById("lux-cookie-save-row").hidden = false;
      document.querySelector("[data-cookie-save]").focus();
    });
    overlay.querySelector("[data-cookie-save]").addEventListener("click", function () {
      saveConsent(document.getElementById("luxAnalytics").checked, document.getElementById("luxMarketing").checked);
    });
    overlay.querySelector("[data-cookie-close]").addEventListener("click", function () { saveConsent(false, false); });
    overlay.addEventListener("keydown", trapFocus);
  }

  function trapFocus(event) {
    if (event.key !== "Tab") return;
    var panel = document.getElementById("lux-cookie-panel");
    var nodes = Array.prototype.slice.call(panel.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]')).filter(function (el) { return !el.hidden; });
    if (!nodes.length) return;
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
  }

  function openConsent() {
    createConsentPanel();
    var overlay = document.getElementById("lux-cookie-overlay");
    overlay.classList.add("open");
    document.body.classList.add("lux-consent-open");
    document.getElementById("luxAnalytics").checked = !!(consent && consent.analytics);
    document.getElementById("luxMarketing").checked = !!(consent && consent.marketing);
    document.getElementById("lux-cookie-save-row").hidden = true;
    window.setTimeout(function () { overlay.querySelector("[data-cookie-reject]").focus(); }, 0);
  }

  function closeConsent() {
    var overlay = document.getElementById("lux-cookie-overlay");
    if (overlay) overlay.classList.remove("open");
    document.body.classList.remove("lux-consent-open");
  }

  function openPreferences() {
    if (document.getElementById("gate").classList.contains("open")) return;
    openConsent();
  }

  function addPreferencesLink() {
    var footer = document.querySelector("footer");
    if (!footer || footer.querySelector("[data-open-cookie-preferences]")) return;
    var p = document.createElement("p");
    p.className = "lux-cookie-preferences-link";
    p.innerHTML = '<a href="#" data-open-cookie-preferences>Preferências de cookies</a>';
    footer.appendChild(p);
    p.querySelector("a").addEventListener("click", function (event) { event.preventDefault(); openPreferences(); });
  }

  function start() {
    addStyles();
    var gate = ensureAgeGate();
    consent = readConsent();
    addPreferencesLink();
    var authorized = false;
    try { authorized = localStorage.getItem("lux18") === "1"; } catch (e) {}
    var yes = document.getElementById("gateYes");
    if (authorized) {
      gate.classList.remove("open");
      gate.setAttribute("aria-hidden", "true");
      if (consent) applyConsent(); else openConsent();
    } else {
      gate.classList.add("open");
      gate.setAttribute("aria-hidden", "false");
      document.body.classList.add("gate-open");
      window.requestAnimationFrame(function () { if (yes) yes.focus(); });
    }
    if (yes) yes.addEventListener("click", function () {
      try { localStorage.setItem("lux18", "1"); } catch (e) {}
      gate.classList.remove("open");
      gate.setAttribute("aria-hidden", "true");
      document.body.classList.remove("gate-open");
      if (consent) applyConsent(); else openConsent();
    });
    gate.addEventListener("keydown", function (event) {
      if (event.key !== "Tab" || !gate.classList.contains("open")) return;
      var items = Array.prototype.slice.call(gate.querySelectorAll('a[href],button:not([disabled])'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();