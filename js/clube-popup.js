/* Luxuriosa — convite de cadastro do Clube */
(function () {
  "use strict";
  var STORAGE_KEY = "lux_club_popup_dismissed_until";
  var COOLDOWN_DAYS = 7;
  var popup = null;
  var previousFocus = null;

  function jaDispensado() {
    try {
      return Number(localStorage.getItem(STORAGE_KEY) || 0) > Date.now();
    } catch (e) { return false; }
  }

  function dispensar() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + COOLDOWN_DAYS * 86400000));
    } catch (e) {}
  }

  function montar() {
    if (popup) return popup;
    var html = '<div class="lux-club-popup" id="luxClubPopup" role="dialog" aria-modal="true" aria-labelledby="luxClubTitle" hidden>' +
      '<section class="lux-club-popup__panel">' +
      '<button class="lux-club-popup__close" type="button" aria-label="Fechar convite">×</button>' +
      '<span class="lux-club-popup__eyebrow">Clube Luxuriosa</span>' +
      '<h2 id="luxClubTitle">Faça um cadastro e ganhe descontos exclusivos</h2>' +
      '<p>Crie sua conta gratuitamente para receber condições especiais, ofertas selecionadas e novidades da Luxuriosa.</p>' +
      '<div class="lux-club-popup__actions">' +
      '<a class="btn primary" href="login.html?modo=cadastro">Quero me cadastrar</a>' +
      '<button class="btn ghost" type="button" data-club-later>Agora não</button>' +
      '</div>' +
      '<small class="lux-club-popup__fine">Cadastro gratuito. Seus dados são tratados com discrição.</small>' +
      '</section></div>';
    document.body.insertAdjacentHTML("beforeend", html);
    popup = document.getElementById("luxClubPopup");
    var close = popup.querySelector(".lux-club-popup__close");
    var later = popup.querySelector("[data-club-later]");
    function hide() {
      popup.hidden = true;
      document.body.classList.remove("modal-open");
      dispensar();
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
    }
    close.addEventListener("click", hide);
    later.addEventListener("click", hide);
    popup.addEventListener("click", function (event) {
      if (event.target === popup) hide();
    });
    popup.querySelector("a").addEventListener("click", dispensar);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !popup.hidden) hide();
    });
    popup._show = function () {
      if (!popup.hidden) return;
      previousFocus = document.activeElement;
      popup.hidden = false;
      document.body.classList.add("modal-open");
      close.focus();
    };
    return popup;
  }

  async function podeExibir() {
    if (jaDispensado()) return false;
    var gate = document.getElementById("gate");
    if (gate && gate.classList.contains("open")) return false;
    var client = window.LuxuriosaSupabase;
    if (client) {
      try {
        var result = await client.auth.getSession();
        if (result.data && result.data.session) return false;
      } catch (e) {}
    }
    return true;
  }

  function agendar() {
    window.setTimeout(async function () {
      if (await podeExibir()) montar()._show();
    }, 8500);
  }

  function iniciar() {
    if (jaDispensado()) return;
    var gateYes = document.getElementById("gateYes");
    var gate = document.getElementById("gate");
    if (gate && gate.classList.contains("open") && gateYes) {
      gateYes.addEventListener("click", agendar, { once: true });
    } else {
      agendar();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();