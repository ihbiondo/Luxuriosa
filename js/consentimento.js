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

  function clearOptionalAnalytics() {
    var names = document.cookie.split(";").map(function (part) {
      return part.split("=")[0].trim();
    }).filter(function (name) {
      return /^(_ga|_gid|_gat|_gac|_gcl)/i.test(name);
    });
    var domains = ["", location.hostname, ".luxuriosa.com.br"];
    var expired = "expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
    names.forEach(function (name) {
      domains.forEach(function (domain) {
        document.cookie = name + "=; " + expired + (domain ? "; domain=" + domain : "");
      });
    });
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (key && /^(_ga|_gid|_gat|_gac|_gcl)/i.test(key)) keys.push(key);
      }
      keys.forEach(function (key) { localStorage.removeItem(key); });
    } catch (_) {}
    var script = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    if (script) script.remove();
    gaLoaded = false;
    try { delete window.gtag; } catch (_) { window.gtag = undefined; }
    window.dataLayer = [];
  }

  var DATA_INVITE_KEY = "lux_autorizacoes_clube_v1";

  function dataInvitationAlreadySeen() {
    try {
      var seenAt = Number(localStorage.getItem(DATA_INVITE_KEY) || 0);
      return seenAt > 0 && Date.now() - seenAt < 30 * 24 * 60 * 60 * 1000;
    } catch (e) { return false; }
  }

  function closeDataInvitation() {
    var overlay = document.getElementById("lux-data-invite");
    if (overlay) overlay.classList.remove("open");
    try { localStorage.setItem(DATA_INVITE_KEY, String(Date.now())); } catch (e) {}
  }

  function openDataInvitation() {
    if (dataInvitationAlreadySeen() ||
        window.location.pathname.toLowerCase().endsWith("/clube.html") ||
        document.getElementById("lux-data-invite")) return;
    var clubOverlay = document.getElementById("lux-club-invite");
    if (clubOverlay && clubOverlay.classList.contains("open")) return;

    var overlay = document.createElement("div");
    overlay.id = "lux-data-invite";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "luxDataInviteTitle");
    overlay.innerHTML = '<section class="lux-data-invite-panel"><button type="button" class="lux-data-invite-close" aria-label="Fechar convite">×</button><span class="lux-club-kicker">SUA EXPERIÊNCIA, SUAS ESCOLHAS</span><h2 id="luxDataInviteTitle">Mais benefícios.<br><span>Mais cuidado.</span></h2><p>Você pode autorizar a personalização da sua experiência e o uso de estatísticas realmente anônimas para melhorar nossos serviços. Cada escolha é opcional. Seus dados pessoais identificáveis nunca serão compartilhados com parceiros.</p><a class="lux-club-invite-cta" href="/clube.html">CONFIGURAR AUTORIZAÇÕES</a><button type="button" class="lux-data-invite-later">Agora não</button><p class="lux-data-invite-privacy"><a href="/privacidade.html">Entenda como usamos seus dados</a></p></section>';
    document.body.appendChild(overlay);
    overlay.querySelector(".lux-data-invite-close").addEventListener("click", closeDataInvitation);
    overlay.querySelector(".lux-data-invite-later").addEventListener("click", closeDataInvitation);
    overlay.querySelector(".lux-club-invite-cta").addEventListener("click", closeDataInvitation);
    overlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeDataInvitation();
    });
    document.body.classList.add("lux-club-invite-open");
    overlay.classList.add("open");
    overlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeClubInvitation();
    });
    overlay.querySelector(".lux-club-invite-cta").focus();
  }

  function scheduleDataInvitation() {
    window.setTimeout(openDataInvitation, 60000);
  }

  function clubInviteAlreadySeen() {
    try {
      var seenAt = Number(localStorage.getItem(CLUB_INVITE_KEY) || 0);
      return seenAt > 0 && Date.now() - seenAt < 30 * 24 * 60 * 60 * 1000;
    } catch (e) { return false; }
  }

  function closeClubInvitation() {
    var overlay = document.getElementById("lux-club-invite");
    if (overlay) overlay.classList.remove("open");
    document.body.classList.remove("lux-club-invite-open");
    try { localStorage.setItem(CLUB_INVITE_KEY, String(Date.now())); } catch (e) {}
  }

  function openClubInvitation() {
    if (clubInviteAlreadySeen() || document.getElementById("lux-club-invite")) return;
    var overlay = document.createElement("div");
    overlay.id = "lux-club-invite";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "luxClubInviteTitle");
    overlay.setAttribute("aria-describedby", "luxClubInviteDescription");
    overlay.innerHTML = '<section class="lux-club-invite-panel"><button type="button" class="lux-club-invite-close" aria-label="Fechar convite do Clube">×</button><div class="lux-club-invite-art" aria-hidden="true"><span class="lux-club-art-overline">LUXURIOSA</span><div class="lux-club-seal"><span class="lux-club-seal-top">CLUBE DE VANTAGENS</span><strong>L</strong><span class="lux-club-seal-bottom">INTIMIDADE &amp; BEM-ESTAR</span></div><span class="lux-club-art-caption">SINTA-SE AINDA MAIS VOCÊ</span></div><div class="lux-club-invite-content"><span class="lux-club-kicker">UM CONVITE ESPECIAL</span><h2 id="luxClubInviteTitle">Mais vantagens.<br><em>Mais a sua cara.</em></h2><p id="luxClubInviteDescription">Faça parte do Clube Luxuriosa e aproveite benefícios pensados para valorizar sua experiência de compra.</p><div class="lux-club-benefit"><strong>10<span>%</span></strong><div><b>DE DESCONTO</b><small>para membros ativos em pedidos com subtotal acima de R$ 100</small></div></div><a class="lux-club-invite-cta" href="/clube.html">QUERO CONHECER O CLUBE</a><button type="button" class="lux-club-invite-later">Agora não</button><p class="lux-club-invite-note">A adesão é opcional. Marketing e autorizações de dados são escolhas independentes.</p></div></section>';
    document.body.appendChild(overlay);
    overlay.querySelector(".lux-club-invite-close").addEventListener("click", closeClubInvitation);
    overlay.querySelector(".lux-club-invite-later").addEventListener("click", closeClubInvitation);
    overlay.querySelector(".lux-club-invite-cta").addEventListener("click", closeClubInvitation);
    overlay.classList.add("open");
    overlay.querySelector(".lux-club-invite-cta").focus();
  }

  function scheduleClubInvitation() {
    if (window.location.pathname.toLowerCase().endsWith("/clube.html")) return;
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
    if (!consent.analytics) clearOptionalAnalytics();
    applyConsent();
    window.dispatchEvent(new CustomEvent("lux:consent-updated"));
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
      "#lux-data-invite{position:fixed;inset:0;z-index:10001;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.82);backdrop-filter:blur(6px);font-family:Montserrat,Arial,sans-serif;color:#f7f0e8}",
      "#lux-data-invite.open{display:flex}.lux-data-invite-panel{position:relative;width:min(100%,500px);padding:34px 28px 25px;text-align:center;border:1px solid rgba(212,175,124,.65);border-radius:19px;background:radial-gradient(ellipse at 50% 0%,#351324,#10080d 72%);box-shadow:0 24px 90px #000}",
      ".lux-data-invite-panel h2{margin:14px 0;color:#f7e8d0;font-family:'Playfair Display',Georgia,serif;font-size:clamp(30px,7vw,43px);font-weight:500;line-height:1.02}.lux-data-invite-panel h2 span{color:#ed5b9a}",
      ".lux-data-invite-panel p{max-width:390px;margin:0 auto 21px;color:#d0c7c5;font-size:12px;line-height:1.75}.lux-data-invite-close{position:absolute;right:15px;top:10px;border:0;background:none;color:#c8bdbb;font-size:27px;cursor:pointer}.lux-data-invite-later{margin-top:13px;border:0;background:transparent;color:#b9aeac;font:12px Montserrat,Arial,sans-serif;cursor:pointer}.lux-data-invite-privacy{margin:12px 0 0!important}.lux-data-invite-privacy a{color:#d8bd91;font-size:11px}",
      "#lux-club-invite{position:fixed;inset:0;z-index:10002;display:none;align-items:center;justify-content:center;overflow-y:auto;padding:18px;background:rgba(5,3,5,.88);backdrop-filter:blur(9px);font-family:Montserrat,Arial,sans-serif;color:#f7f0e8}",
      "#lux-club-invite.open{display:flex}.lux-club-invite-panel{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(205px,.82fr) minmax(0,1.18fr);width:min(100%,690px);max-height:92vh;overflow:auto;border:1px solid rgba(212,175,124,.62);border-radius:25px;background:linear-gradient(145deg,#211018 0%,#100a0e 62%,#080809 100%);box-shadow:0 32px 110px rgba(0,0,0,.72);animation:luxClubInviteIn .36s cubic-bezier(.2,.8,.2,1) both}",
      ".lux-club-invite-art{position:relative;isolation:isolate;display:flex;min-height:410px;flex-direction:column;align-items:center;justify-content:center;gap:22px;overflow:hidden;padding:30px 22px;border-right:1px solid rgba(212,175,124,.2);background:radial-gradient(ellipse at 50% 42%,rgba(173,38,89,.32),transparent 54%),linear-gradient(155deg,#3b1225,#160b12 72%)}.lux-club-invite-art:before,.lux-club-invite-art:after{position:absolute;z-index:-1;content:'';border:1px solid rgba(212,175,124,.16);border-radius:50%;pointer-events:none}.lux-club-invite-art:before{width:255px;height:255px}.lux-club-invite-art:after{width:305px;height:305px;border-color:rgba(212,175,124,.08)}.lux-club-art-overline{color:#e7d1ad;font-family:'Playfair Display',Georgia,serif;font-size:12px;letter-spacing:.42em}",
      ".lux-club-seal{position:relative;display:flex;width:174px;aspect-ratio:1;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(226,194,140,.78);border-radius:50%;box-shadow:inset 0 0 0 7px rgba(212,175,124,.06),0 0 42px rgba(207,74,129,.14)}.lux-club-seal:before{position:absolute;inset:9px;content:'';border:1px solid rgba(226,194,140,.35);border-radius:50%}.lux-club-seal strong{color:#f4dfbd;font-family:'Playfair Display',Georgia,serif;font-size:104px;font-weight:400;line-height:.9;text-shadow:0 5px 28px rgba(237,91,154,.23)}.lux-club-seal-top,.lux-club-seal-bottom{position:absolute;color:#d8bd91;font-size:7px;letter-spacing:.2em}.lux-club-seal-top{top:27px}.lux-club-seal-bottom{bottom:27px;font-size:6px;letter-spacing:.15em}.lux-club-art-caption{color:#f1d9c9;font-family:'Playfair Display',Georgia,serif;font-size:14px;font-style:italic;letter-spacing:.04em}",
      ".lux-club-invite-content{display:flex;flex-direction:column;justify-content:center;padding:43px 40px 34px}.lux-club-invite-close{position:absolute;z-index:3;top:13px;right:14px;display:grid;width:36px;height:36px;place-items:center;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:rgba(0,0,0,.28);color:#e8deda;font-size:25px;line-height:1;cursor:pointer;transition:background .2s,border-color .2s}.lux-club-invite-close:hover{border-color:rgba(212,175,124,.65);background:rgba(212,175,124,.12)}.lux-club-invite-content .lux-club-kicker{color:#d8bd91;font-size:9px;font-weight:600;letter-spacing:.25em}",
      ".lux-club-invite-content h2{margin:15px 30px 13px 0;color:#f7e8d0;font-family:'Playfair Display',Georgia,serif;font-size:clamp(33px,4.3vw,46px);font-weight:400;line-height:1.04;letter-spacing:-.015em}.lux-club-invite-content h2 em{color:#ec8bb2;font-weight:400}.lux-club-invite-content>p{margin:0 0 21px;color:#d0c7c5;font-size:12px;line-height:1.75}",
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
    var link = footer.querySelector("[data-open-cookie-preferences]");
    if (!link) {
      var p = document.createElement("p");
      p.className = "lux-cookie-preferences-link";
      p.innerHTML = '<a href="#" data-open-cookie-preferences>Preferências de cookies</a>';
      footer.appendChild(p);
      link = p.querySelector("a");
    }
    if (link.getAttribute("data-cookie-handler-bound") !== "1") {
      link.setAttribute("data-cookie-handler-bound", "1");
      link.addEventListener("click", function (event) {
        event.preventDefault();
        openPreferences();
      });
    }
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
      scheduleDataInvitation();
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
      scheduleDataInvitation();
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