/* Luxuriosa — confirmação 18+ e preferências de privacidade */
(function () {
  "use strict";
  var CONSENT_KEY = "lux_cookie_consent_v1";
  var CONSENT_VERSION = 2;
  var GA_ID = "G-YHDETK6FPS";
  var consent = null;
  var gaLoaded = false;
  var CLUB_INVITE_KEY = "lux_clube_convite_v1";
  var clubInviteScheduled = false;
  var clubInvitePreviousFocus = null;
  var dataInvitePreviousFocus = null;

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
        if (key && (/^(_ga|_gid|_gat|_gac|_gcl)/i.test(key) || key === "luxuriosa_traffic_context_v1")) keys.push(key);
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
    if (overlay) {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("lux-club-invite-open");
    try { localStorage.setItem(DATA_INVITE_KEY, String(Date.now())); } catch (e) {}

    var previousFocus = dataInvitePreviousFocus;
    dataInvitePreviousFocus = null;
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === "function") {
      window.requestAnimationFrame(function () { previousFocus.focus(); });
    }
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
    overlay.setAttribute("aria-hidden", "false");
    overlay.innerHTML = '<section class="lux-data-invite-panel"><button type="button" class="lux-data-invite-close" aria-label="Fechar convite">×</button><span class="lux-club-kicker">SUA EXPERIÊNCIA, SUAS ESCOLHAS</span><h2 id="luxDataInviteTitle">Mais benefícios.<br><span>Mais cuidado.</span></h2><p>Você pode autorizar a personalização da sua experiência e o uso de estatísticas realmente anônimas para melhorar nossos serviços. Cada escolha é opcional. Seus dados pessoais identificáveis nunca serão compartilhados com parceiros.</p><a class="lux-club-invite-cta" href="/clube.html">CONFIGURAR AUTORIZAÇÕES</a><button type="button" class="lux-data-invite-later">Agora não</button><p class="lux-data-invite-privacy"><a href="/privacidade.html">Entenda como usamos seus dados</a></p></section>';
    dataInvitePreviousFocus = document.activeElement;
    document.body.appendChild(overlay);
    overlay.querySelector(".lux-data-invite-close").addEventListener("click", closeDataInvitation);
    overlay.querySelector(".lux-data-invite-later").addEventListener("click", closeDataInvitation);
    overlay.querySelector(".lux-club-invite-cta").addEventListener("click", closeDataInvitation);
    overlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDataInvitation();
        return;
      }
      if (event.key !== "Tab") return;

      var focusable = Array.prototype.slice.call(
        overlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(function (element) { return element.offsetParent !== null; });
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    document.body.classList.add("lux-club-invite-open");
    overlay.classList.add("open");
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
    if (!overlay) return;

    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lux-club-invite-open");
    try { localStorage.setItem(CLUB_INVITE_KEY, String(Date.now())); } catch (e) {}

    var previousFocus = clubInvitePreviousFocus;
    clubInvitePreviousFocus = null;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === "function") {
      window.requestAnimationFrame(function () { previousFocus.focus(); });
    }
  }

  function openClubInvitation() {
    if (clubInviteAlreadySeen() ||
        window.location.pathname.toLowerCase().endsWith("/clube.html") ||
        document.getElementById("lux-club-invite")) return;

    /* Não empilha o convite do Clube sobre o convite separado de privacidade. */
    var dataOverlay = document.getElementById("lux-data-invite");
    if (dataOverlay && dataOverlay.classList.contains("open")) {
      window.setTimeout(openClubInvitation, 5000);
      return;
    }

    clubInvitePreviousFocus = document.activeElement;

    var overlay = document.createElement("div");
    overlay.id = "lux-club-invite";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-labelledby", "luxClubInviteTitle");
    overlay.setAttribute("aria-describedby", "luxClubInviteDescription");
    overlay.innerHTML = '<section class="lux-club-invite-panel"><button type="button" class="lux-club-invite-close" aria-label="Fechar convite do Clube">×</button><div class="lux-club-invite-art" aria-hidden="true"><span class="lux-club-art-overline">CLUBE DE VANTAGENS</span><img class="lux-club-logo" src="/img/site/logo-luxuriosa.webp" alt=""><span class="lux-club-art-caption">SINTA-SE AINDA MAIS VOCÊ</span></div><div class="lux-club-invite-content"><span class="lux-club-kicker">UM CONVITE ESPECIAL</span><h2 id="luxClubInviteTitle">Sua experiência<br><em>com mais vantagens.</em></h2><p id="luxClubInviteDescription">Conheça o Clube Luxuriosa e descubra benefícios pensados para tornar suas compras e entregas ainda mais especiais.</p><ul class="lux-club-invite-benefits" aria-label="Vantagens do Clube"><li><span class="lux-club-benefit-mark" aria-hidden="true">✓</span><span><b>Condições especiais</b><small>Vantagens em compras e no catálogo, conforme as regras do Clube.</small></span></li><li><span class="lux-club-benefit-mark" aria-hidden="true">✓</span><span><b>Mais conveniência</b><small>Conheça as opções e benefícios de entrega para Bauru e região.</small></span></li><li><span class="lux-club-benefit-mark" aria-hidden="true">✓</span><span><b>Novidades e oportunidades</b><small>Fique por dentro das novidades e vantagens disponíveis aos membros.</small></span></li></ul><a class="lux-club-invite-cta" href="/clube.html#participar">QUERO CONHECER E ENTRAR NO CLUBE</a><p class="lux-club-invite-note">A adesão ao Clube é independente das autorizações opcionais. Você não precisa autorizar marketing ou personalização para participar.</p><button type="button" class="lux-club-invite-later">Agora não</button></div></section>';

    document.body.appendChild(overlay);
    document.body.classList.add("lux-club-invite-open");
    overlay.classList.add("open");

    overlay.querySelector(".lux-club-invite-close").addEventListener("click", closeClubInvitation);
    overlay.querySelector(".lux-club-invite-later").addEventListener("click", closeClubInvitation);
    overlay.querySelector(".lux-club-invite-cta").addEventListener("click", closeClubInvitation);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeClubInvitation();
    });
    overlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeClubInvitation();
        return;
      }
      if (event.key !== "Tab") return;

      var focusable = Array.prototype.slice.call(
        overlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(function (element) { return element.offsetParent !== null; });
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    var closeButton = overlay.querySelector(".lux-club-invite-close");
    if (closeButton) closeButton.focus();
  }

  function scheduleClubInvitation() {
    if (window.location.pathname.toLowerCase().endsWith("/clube.html")) return;
    if (clubInviteScheduled || clubInviteAlreadySeen()) return;
    clubInviteScheduled = true;
    window.setTimeout(openClubInvitation, 120000);
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
    var safeReferrer = "";
    try {
      if (document.referrer) {
        var referrerUrl = new URL(document.referrer);
        if (referrerUrl.origin !== window.location.origin) safeReferrer = referrerUrl.origin + "/";
      }
    } catch (_) {}
    /* URLs e títulos são genéricos; a referência externa é limitada ao domínio de origem. */
    window.gtag("config", GA_ID, {
      anonymize_ip: true,
      send_page_view: false,
      page_location: window.location.origin + "/navegacao",
      page_title: "Luxuriosa - Navegação",
      page_referrer: safeReferrer
    });
    /* Visualização genérica: não envia slug, título, query string ou nome de produto. */
    var path = window.location.pathname || "/";
    var pageType = path.indexOf("/produtos/") !== -1 ? "produto"
      : (path === "/" || path.toLowerCase().endsWith("/index.html")) ? "inicio"
      : path.indexOf("catalogo") !== -1 ? "catalogo" : "institucional";
    window.gtag("event", "page_view", {
      page_title: "Luxuriosa - " + pageType,
      page_location: window.location.origin + "/navegacao/" + pageType,
      page_path: "/navegacao/" + pageType,
      page_referrer: safeReferrer
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
      "#lux-club-invite{position:fixed;inset:0;z-index:10002;display:none;align-items:center;justify-content:center;overflow-y:auto;overscroll-behavior:contain;padding:24px;background:rgba(4,2,4,.9);backdrop-filter:blur(10px);font-family:Montserrat,Arial,sans-serif;color:#f7f0e8}",
      "#lux-club-invite.open{display:flex}.lux-club-invite-panel{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(245px,.88fr) minmax(0,1.12fr);width:min(100%,790px);max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);overflow:auto;border:1px solid rgba(212,175,124,.66);border-radius:26px;background:linear-gradient(145deg,#241019 0%,#120a0f 58%,#080809 100%);box-shadow:0 32px 110px rgba(0,0,0,.76);animation:luxClubInviteIn .38s cubic-bezier(.2,.8,.2,1) both}",
      ".lux-club-invite-art{position:relative;isolation:isolate;display:flex;min-height:490px;flex-direction:column;align-items:center;justify-content:center;gap:28px;overflow:hidden;padding:38px 26px;border-right:1px solid rgba(212,175,124,.2);background:radial-gradient(ellipse at 50% 42%,rgba(237,91,154,.22),transparent 55%),linear-gradient(155deg,#45142a,#190b13 72%)}.lux-club-invite-art:before,.lux-club-invite-art:after{position:absolute;z-index:-1;content:'';border:1px solid rgba(212,175,124,.18);border-radius:50%;pointer-events:none}.lux-club-invite-art:before{width:290px;height:290px}.lux-club-invite-art:after{width:350px;height:350px;border-color:rgba(212,175,124,.09)}.lux-club-art-overline{color:#e7d1ad;font-family:Montserrat,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:.28em;text-align:center}",
      ".lux-club-logo{display:block;width:min(100%,270px);height:auto;max-height:270px;object-fit:contain;border:1px solid rgba(212,175,124,.24);border-radius:20px;box-shadow:0 18px 55px rgba(0,0,0,.3)}.lux-club-art-caption{color:#f1d9c9;font-family:'Playfair Display',Georgia,serif;font-size:16px;font-style:italic;letter-spacing:.04em;text-align:center}",
      ".lux-club-invite-content{display:flex;flex-direction:column;justify-content:center;padding:48px 46px 34px}.lux-club-invite-close{position:absolute;z-index:3;top:14px;right:14px;display:grid;width:42px;height:42px;place-items:center;border:1px solid rgba(255,255,255,.16);border-radius:50%;background:rgba(0,0,0,.34);color:#f4e8e5;font-size:28px;line-height:1;cursor:pointer;transition:background .2s,border-color .2s}.lux-club-invite-close:hover{border-color:rgba(212,175,124,.75);background:rgba(212,175,124,.14)}.lux-club-invite-close:focus-visible,.lux-club-invite-cta:focus-visible,.lux-club-invite-later:focus-visible{outline:2px solid #f2d7a9;outline-offset:4px}.lux-club-invite-content .lux-club-kicker{color:#e0c18f;font-size:10px;font-weight:700;letter-spacing:.24em}",
      ".lux-club-invite-content h2{margin:16px 40px 14px 0;color:#fff0dc;font-family:'Playfair Display',Georgia,serif;font-size:clamp(36px,4.8vw,52px);font-weight:400;line-height:1.03;letter-spacing:-.02em}.lux-club-invite-content h2 em{color:#f18ab7;font-weight:400}.lux-club-invite-content>p{margin:0 0 20px;color:#ded1d2;font-size:13px;line-height:1.7}",
      ".lux-club-invite-benefits{display:grid;gap:12px;list-style:none;margin:0 0 24px;padding:0}.lux-club-invite-benefits li{display:grid;grid-template-columns:27px minmax(0,1fr);align-items:start;gap:11px}.lux-club-benefit-mark{display:grid;width:25px;height:25px;place-items:center;border:1px solid rgba(212,175,124,.58);border-radius:50%;background:rgba(212,175,124,.1);color:#e8cb9c;font-size:13px;font-weight:700}.lux-club-invite-benefits b{display:block;margin:0 0 3px;color:#f5dfbe;font-size:12px;letter-spacing:.03em}.lux-club-invite-benefits small{display:block;color:#cfc0c2;font-size:11px;line-height:1.5}",
      "#lux-club-invite .lux-club-invite-cta{display:flex;min-height:62px;align-items:center;justify-content:center;padding:18px 22px;border:1px solid rgba(255,239,208,.76);border-radius:16px;background:linear-gradient(105deg,#d6b47e,#f4d9aa 55%,#e4c18a);box-shadow:0 12px 30px rgba(212,175,124,.18);color:#21120f!important;text-align:center;font-size:12px;font-weight:800;line-height:1.35;letter-spacing:.1em;text-decoration:none!important;transition:transform .2s,filter .2s,box-shadow .2s}#lux-club-invite .lux-club-invite-cta:hover{filter:brightness(1.08);transform:translateY(-2px);box-shadow:0 16px 34px rgba(212,175,124,.25)}",
      ".lux-club-invite-note{margin:12px 0 0!important;color:#bcaeb2!important;font-size:10px!important;line-height:1.55!important;text-align:center}.lux-club-invite-later{align-self:center;margin-top:12px;padding:9px 14px;border:0;background:transparent;color:#c3b7ba;font:500 12px Montserrat,Arial,sans-serif;cursor:pointer}.lux-club-invite-later:hover{color:#fff}",
      "body.lux-club-invite-open{overflow:hidden}@keyframes luxClubInviteIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@media(max-width:680px){#lux-club-invite{align-items:center;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));backdrop-filter:blur(5px)}.lux-club-invite-panel{display:block;width:100%;max-width:440px;max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);border-radius:20px}.lux-club-invite-art{min-height:132px;gap:9px;padding:15px 22px 13px;border-right:0;border-bottom:1px solid rgba(212,175,124,.2)}.lux-club-logo{width:116px;max-height:68px;border-radius:10px}.lux-club-art-overline{font-size:8px;letter-spacing:.2em}.lux-club-art-caption{font-size:12px}.lux-club-invite-content{padding:23px 22px 17px;text-align:left}.lux-club-invite-close{top:9px;right:9px;width:35px;height:35px;font-size:23px}.lux-club-invite-content .lux-club-kicker{font-size:8px;letter-spacing:.19em}.lux-club-invite-content h2{margin:10px 30px 9px 0;font-size:clamp(30px,8vw,38px)}.lux-club-invite-content>p{margin-bottom:13px;font-size:11px;line-height:1.55}.lux-club-invite-benefits{gap:9px;margin-bottom:15px}.lux-club-invite-benefits li{grid-template-columns:23px minmax(0,1fr);gap:9px}.lux-club-benefit-mark{width:22px;height:22px;font-size:11px}.lux-club-invite-benefits b{font-size:11px}.lux-club-invite-benefits small{font-size:10px;line-height:1.4}#lux-club-invite .lux-club-invite-cta{min-height:58px;padding:16px 15px;font-size:11px;letter-spacing:.07em}.lux-club-invite-note{font-size:9px!important}.lux-club-invite-later{margin-top:6px;font-size:11px}}",
      "@media(max-width:370px){.lux-club-invite-art{min-height:115px}.lux-club-logo{width:98px;max-height:58px}.lux-club-invite-content{padding:20px 17px 14px}.lux-club-invite-content h2{font-size:29px}.lux-club-invite-content>p{font-size:10px}.lux-club-invite-benefits{gap:8px}.lux-club-invite-benefits small{font-size:9px}#lux-club-invite .lux-club-invite-cta{font-size:10px}}",
      "@media(max-height:700px) and (max-width:680px){#lux-club-invite{align-items:flex-start}.lux-club-invite-panel{margin:auto 0}.lux-club-invite-art{min-height:105px}.lux-club-logo{width:92px;max-height:53px}.lux-club-invite-content{padding-top:18px;padding-bottom:12px}.lux-club-invite-content h2{font-size:28px;margin-top:8px}.lux-club-invite-content>p{margin-bottom:9px}.lux-club-invite-benefits{gap:7px;margin-bottom:11px}}",
      "#lux-cookie-overlay{z-index:10003}",
      "body.lux-consent-open{overflow:hidden}",".lux-cookie-preferences-link{text-align:center;margin:14px auto;padding:8px}.lux-cookie-preferences-link a{color:#d8bd91;font-size:12px}.lux-cookie-fallback-footer{padding:16px;text-align:center;background:#10090c;border-top:1px solid rgba(212,175,124,.2)}",
      "@media(max-width:560px){#lux-cookie-panel{padding:24px 20px;border-radius:15px}.lux-cookie-actions{flex-direction:column}.lux-cookie-actions button{width:100%}}",
      /* Convite de privacidade — composição editorial premium, distinta dos modais de cookies */
      "#lux-data-invite{padding:24px;background:rgba(5,3,5,.88);backdrop-filter:blur(12px)}",
      ".lux-data-invite-panel{isolation:isolate;display:flex;flex-direction:column;align-items:flex-start;width:min(100%,760px);min-height:390px;padding:58px 64px 38px 42%;overflow:hidden;text-align:left;border:1px solid rgba(216,183,127,.52);border-radius:25px;background:linear-gradient(115deg,#24101a 0%,#1b0d13 38%,#10090d 100%);box-shadow:0 34px 110px rgba(0,0,0,.78);animation:luxDataInviteIn .42s cubic-bezier(.2,.8,.2,1) both}",
      ".lux-data-invite-panel:before{position:absolute;z-index:-1;inset:0 auto 0 0;width:34%;content:'';background:radial-gradient(circle at 50% 48%,rgba(237,91,154,.22),transparent 42%),linear-gradient(155deg,#51172f 0%,#2a101d 56%,#160b11 100%);border-right:1px solid rgba(216,183,127,.2)}",
      ".lux-data-invite-panel:after{position:absolute;z-index:-1;left:5.5%;top:50%;width:23%;aspect-ratio:1;content:'✦';display:grid;place-items:center;transform:translateY(-50%);border:1px solid rgba(216,183,127,.28);border-radius:50%;outline:1px solid rgba(216,183,127,.12);outline-offset:13px;color:#e7c995;font-family:'Playfair Display',Georgia,serif;font-size:clamp(65px,10vw,112px);font-weight:400;text-shadow:0 0 45px rgba(237,91,154,.25)}",
      ".lux-data-invite-panel .lux-club-kicker{display:inline-flex;align-items:center;gap:10px;color:#d9b77f;font-size:9px;font-weight:700;letter-spacing:.24em;line-height:1.5}.lux-data-invite-panel .lux-club-kicker:before{width:24px;height:1px;content:'';background:#d9b77f}",
      ".lux-data-invite-panel h2{margin:18px 0 15px;color:#fff0df;font-size:clamp(36px,5vw,51px);line-height:1.04;letter-spacing:-.025em}.lux-data-invite-panel h2 span{color:#ed8db5}",
      ".lux-data-invite-panel>p:not(.lux-data-invite-privacy){max-width:430px;margin:0 0 24px;color:#d8c9cd;font-size:13px;line-height:1.8}",
      "#lux-data-invite .lux-club-invite-cta{display:flex;width:min(100%,360px);min-height:54px;align-items:center;justify-content:center;padding:15px 20px;border:1px solid rgba(255,239,208,.7);border-radius:10px;background:linear-gradient(105deg,#d6b47e,#f1d7aa 55%,#e4c18a);box-shadow:0 12px 28px rgba(212,175,124,.15);color:#21120f!important;text-align:center;font-size:10px;font-weight:800;line-height:1.4;letter-spacing:.1em;text-decoration:none!important;transition:transform .2s,filter .2s}",
      "#lux-data-invite .lux-club-invite-cta:hover{transform:translateY(-2px);filter:brightness(1.08)}",
      ".lux-data-invite-close{position:absolute;z-index:2;right:16px;top:14px;display:grid;width:38px;height:38px;place-items:center;border:1px solid rgba(255,255,255,.14);border-radius:50%;background:rgba(0,0,0,.2);color:#eadde0;font-size:25px;cursor:pointer}",
      ".lux-data-invite-close:hover{border-color:rgba(216,183,127,.6);background:rgba(216,183,127,.1)}",
      ".lux-data-invite-later{align-self:flex-start;margin:13px 0 0;padding:8px 0;border:0;background:transparent;color:#c6b7bb;font:500 11px Montserrat,Arial,sans-serif;cursor:pointer}.lux-data-invite-later:hover{color:#fff}",
      ".lux-data-invite-privacy{margin:16px 0 0!important;color:#bcaeb2!important;font-size:10px!important;line-height:1.5!important}.lux-data-invite-privacy a{color:#d9bd91;font-size:10px;text-decoration:underline;text-underline-offset:3px}",
      ".lux-data-invite-close:focus-visible,.lux-data-invite-later:focus-visible,#lux-data-invite .lux-club-invite-cta:focus-visible{outline:2px solid #f2d7a9;outline-offset:4px}",
      "@keyframes luxDataInviteIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@media(max-width:680px){#lux-data-invite{align-items:center;padding:max(14px,env(safe-area-inset-top)) 14px max(14px,env(safe-area-inset-bottom))}.lux-data-invite-panel{width:min(100%,430px);min-height:0;padding:132px 23px 23px;border-radius:19px}.lux-data-invite-panel:before{inset:0 0 auto;width:100%;height:105px;border-right:0;border-bottom:1px solid rgba(216,183,127,.2);background:radial-gradient(ellipse at 50% 60%,rgba(237,91,154,.2),transparent 42%),linear-gradient(110deg,#51172f,#24101a)}.lux-data-invite-panel:after{left:50%;top:12px;width:76px;transform:translateX(-50%);outline-offset:6px;font-size:38px}.lux-data-invite-panel .lux-club-kicker{font-size:8px;letter-spacing:.2em}.lux-data-invite-panel h2{margin:12px 0 11px;font-size:clamp(33px,9vw,41px)}.lux-data-invite-panel>p:not(.lux-data-invite-privacy){margin-bottom:18px;font-size:12px;line-height:1.7}#lux-data-invite .lux-club-invite-cta{width:100%;min-height:52px;font-size:9px;letter-spacing:.08em}.lux-data-invite-close{right:10px;top:10px;width:34px;height:34px;font-size:22px}.lux-data-invite-later{align-self:center;margin-top:10px}.lux-data-invite-privacy{align-self:center;margin-top:12px!important;text-align:center}}",
      "@media(max-width:370px){.lux-data-invite-panel{padding:122px 18px 19px}.lux-data-invite-panel:before{height:96px}.lux-data-invite-panel:after{width:67px;font-size:33px}.lux-data-invite-panel h2{font-size:31px}.lux-data-invite-panel>p:not(.lux-data-invite-privacy){font-size:11px}}",
      "@media(prefers-reduced-motion:reduce){.lux-data-invite-panel{animation:none!important}}"
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