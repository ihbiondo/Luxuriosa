/* Luxuriosa — confirmação 18+ e preferências de privacidade */
(function () {
  "use strict";
  var CONSENT_KEY = "lux_cookie_consent_v1";
  var CONSENT_VERSION = 2;
  var GA_ID = "G-PP3SPL55B0";
  var consent = null;
  var gaLoaded = false;
  var CLUB_INVITE_KEY = "lux_clube_convite_v1";
  var clubInviteScheduled = false;

  function clubInviteAlreadySeen() {
    try {
      var seenAt = Number(localStorage.getItem(CLUB_INVITE_KEY) || 0);
      return seenAt > 0 && Date.now() - seenAt < 30 * 24 * 60 * 60 * 1000;
    } catch (e) { return false; }
  }

  function closeClubInvitation() {
    var overlay = document.getElementById("lux-club-invite");
    if (overlay) overlay.classList.remove("open");
    try { localStorage.setItem(CLUB_INVITE_KEY, String(Date.now())); } catch (e) {}
  }

  function openClubInvitation() {
    if (clubInviteAlreadySeen() || document.getElementById("lux-club-invite")) return;
    var overlay = document.createElement("div");
    overlay.id = "lux-club-invite";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "luxClubInviteTitle");
    overlay.innerHTML = '<section class="lux-club-invite-panel"><button type="button" class="lux-club-invite-close" aria-label="Fechar convite">×</button><span class="lux-club-kicker">LUXURIOSA CONVIDA</span><h2 id="luxClubInviteTitle">VANTAGENS <span>&amp;</span><br>BENEFÍCIOS</h2><p>Descubra benefícios, atendimento e uma experiência ainda mais especial. Faça sua adesão pelo site e escolha suas preferências.</p><a class="lux-club-invite-cta" href="/clube.html">QUERO ENTRAR NO CLUBE</a><button type="button" class="lux-club-invite-later">Agora não</button></section>';
    document.body.appendChild(overlay);
    overlay.querySelector(".lux-club-invite-close").addEventListener("click", closeClubInvitation);
    overlay.querySelector(".lux-club-invite-later").addEventListener("click", closeClubInvitation);
    overlay.querySelector(".lux-club-invite-cta").addEventListener("click", closeClubInvitation);
    overlay.classList.add("open");
    overlay.querySelector(".lux-club-invite-cta").focus();
  }

  function scheduleClubInvitation() {
    if (clubInviteScheduled || clubInviteAlreadySeen()) return;
    clubInviteScheduled = true;
    window.setTimeout(openClubInvitation, 15000);
  }

  function readConsent() {
    try {
      var value = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
      if (!value || value.version !== CONSENT_VERSION || !value.updatedAt) return null;
      var updatedAt = new Date(value.updatedAt).getTime();
      if (!Number.isFinite(updatedAt) || updatedAt > Date.now() || Date.now() - updatedAt > 180 * 24 * 60 * 60 * 1000) return null;
      if (typeof value.analytics !== "boolean" || value.necessary !== true) return null;
      return value;
    } catch (e) { return null; }
  }

  function saveConsent(analytics) {
    consent = { version: CONSENT_VERSION, updatedAt: new Date().toISOString(),
      necessary: true, analytics: !!analytics };
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
    /* Evita enviar URLs, títulos e referências que possam revelar produtos íntimos. */
    window.gtag("config", GA_ID, {
      anonymize_ip: true,
      send_page_view: false,
      page_location: window.location.origin + "/navegacao",
      page_title: "Luxuriosa - Navegação",
      page_referrer: ""
    });
    /* Visualização genérica: não envia slug, título, query string ou nome de produto. */
    var path = window.location.pathname || "/";
    var pageType = path.indexOf("/produtos/") !== -1 ? "produto"
      : (path === "/" || path.toLowerCase().endsWith("/index.html")) ? "inicio"
      : path.indexOf("catalogo") !== -1 ? "catalogo" : "institucional";
    window.gtag("event", "page_view", {
      page_title: "Luxuriosa - " + pageType,
      page_location: window.location.origin + "/navegacao/" + pageType,
      page_path: "/navegacao/" + pageType
    });
    /* API interna para eventos comerciais sem parâmetros identificáveis. */
    window.LuxuriosaMedicao = window.LuxuriosaMedicao || {};
    window.LuxuriosaMedicao.registrar = function (nome, parametros) {
      if (!consent || !consent.analytics || !/^[a-z][a-z0-9_]{1,39}$/.test(nome)) return;
      var seguros = {};
      var permitidos = ["page_type", "method", "step", "quantity"];
      permitidos.forEach(function (chave) {
        var valor = parametros && parametros[chave];
        if ((typeof valor === "string" && /^[a-z0-9_-]{1,30}$/i.test(valor)) ||
            (chave === "quantity" && Number.isInteger(valor) && valor >= 1 && valor <= 99)) {
          seguros[chave] = valor;
        }
      });
      window.gtag("event", nome, seguros);
    };
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
      "#lux-club-invite{position:fixed;inset:0;z-index:10002;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.84);backdrop-filter:blur(6px);font-family:Montserrat,Arial,sans-serif;color:#f7f0e8}",
      "#lux-club-invite.open{display:flex}.lux-club-invite-panel{position:relative;width:min(100%,520px);padding:38px 30px 28px;text-align:center;border:1px solid rgba(212,175,124,.65);border-radius:20px;background:radial-gradient(ellipse at 50% 0,rgba(160,31,78,.34),transparent 58%),linear-gradient(145deg,#211018,#090809);box-shadow:0 24px 90px #000}",
      ".lux-club-invite-close{position:absolute;right:16px;top:10px;border:0;background:none;color:#c8bdbb;font-size:28px;cursor:pointer}.lux-club-kicker{color:#d8bd91;font-size:10px;letter-spacing:.24em}",
      ".lux-club-invite-panel h2{margin:15px 0 14px;color:#f7e8d0;font-family:'Playfair Display',Georgia,serif;font-size:clamp(34px,8vw,52px);font-weight:500;line-height:.98;letter-spacing:.015em}.lux-club-invite-panel h2 span{color:#ed5b9a}",
      ".lux-club-invite-panel p{max-width:390px;margin:0 auto 24px;color:#d0c7c5;font-size:13px;line-height:1.7}.lux-club-invite-cta{display:block;padding:15px 18px;border-radius:30px;background:linear-gradient(100deg,#d6b47e,#f0d4a2);color:#1a1010!important;font-size:11px;font-weight:700;letter-spacing:.08em;text-decoration:none!important}",
      ".lux-club-invite-later{margin-top:14px;border:0;background:transparent;color:#b9aeac;font:12px Montserrat,Arial,sans-serif;cursor:pointer}@media(max-width:560px){.lux-club-invite-panel{padding:34px 22px 24px}}",
      "#lux-cookie-overlay{z-index:10003}",
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
    overlay.innerHTML = '<section id="lux-cookie-panel"><button class="lux-cookie-close" type="button" aria-label="Fechar preferências e rejeitar estatísticas opcionais" data-cookie-close>×</button><h2 id="luxCookieTitle">Sua privacidade importa</h2><p>Usamos armazenamento local para recursos essenciais, como carrinho e confirmação de maioridade. Estatísticas opcionais só são ativadas com sua autorização. Marketing e autorizações do Clube são tratados separadamente.</p><div class="lux-cookie-option"><div><strong>Tecnologias necessárias</strong><small>Armazenamento local para carrinho, confirmação de maioridade e registro das preferências.</small></div><span class="lux-cookie-pill">Sempre ativas</span></div><div class="lux-cookie-option"><div><strong>Estatísticas e análise</strong><small>Medição de navegação por meio do Google Analytics 4. Só é ativada com sua autorização.</small></div><label class="lux-switch"><input id="luxAnalytics" type="checkbox" aria-label="Autorizar estatísticas e análise"><span></span></label></div><p><a href="' + (location.pathname.indexOf("/produtos/") !== -1 ? "../privacidade.html" : "privacidade.html") + '">Leia nossa Política de Privacidade</a></p><div class="lux-cookie-actions"><button type="button" class="lux-primary" data-cookie-accept>Aceitar estatísticas</button><button type="button" data-cookie-reject>Rejeitar opcionais</button><button type="button" data-cookie-custom>Personalizar</button></div><div class="lux-cookie-actions" id="lux-cookie-save-row" hidden><button type="button" class="lux-primary" data-cookie-save>Salvar minhas preferências</button></div></section>';
    document.body.appendChild(overlay);
    overlay.querySelector("[data-cookie-reject]").addEventListener("click", function () { saveConsent(false); });
    overlay.querySelector("[data-cookie-accept]").addEventListener("click", function () { saveConsent(true); });
    overlay.querySelector("[data-cookie-custom]").addEventListener("click", function () {
      document.getElementById("lux-cookie-save-row").hidden = false;
      document.querySelector("[data-cookie-save]").focus();
    });
    overlay.querySelector("[data-cookie-save]").addEventListener("click", function () {
      saveConsent(document.getElementById("luxAnalytics").checked);
    });
    overlay.querySelector("[data-cookie-close]").addEventListener("click", function () { saveConsent(false); });
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
    document.getElementById("lux-cookie-save-row").hidden = true;
    window.setTimeout(function () { overlay.querySelector("[data-cookie-accept]").focus(); }, 0);
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
    if (!footer) { footer = document.createElement("footer"); footer.className = "lux-cookie-fallback-footer"; document.body.appendChild(footer); }
    if (footer.querySelector("[data-open-cookie-preferences]")) return;
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
      document.body.classList.remove("gate-open");
      gate.classList.remove("open");
      gate.setAttribute("aria-hidden", "true");
      if (consent) applyConsent();
      scheduleClubInvitation();
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
      if (consent) applyConsent();
      scheduleClubInvitation();
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