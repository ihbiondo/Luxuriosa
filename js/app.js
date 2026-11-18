/* =========================================================
   LUXURIOSA
   APP.JS
   Comportamento geral da aplicação
   ========================================================= */

(function () {
  "use strict";


  /* =======================================================
     UTILITÁRIOS
     ======================================================= */

  function $(id) {
    return document.getElementById(id);
  }


  /* =======================================================
     CONTATO VIA WHATSAPP
     ======================================================= */

  function configurarWhatsApp() {
    var numeroWhatsApp = "5514996355924";
    var mensagemPadrao = "Olá! Conheci a Luxuriosa pelo site e gostaria de saber mais.";

    document.querySelectorAll("[data-wa]").forEach(function (elemento) {
      if (elemento.dataset.whatsappConfigured === "true") return;
      elemento.dataset.whatsappConfigured = "true";

      elemento.addEventListener("click", function () {
        var mensagem = elemento.dataset.waMsg || mensagemPadrao;
        var numero = String(numeroWhatsApp).replace(/[^0-9]/g, "");
        var url = "https://wa.me/" + numero + "?text=" + encodeURIComponent(mensagem);

        if (window.LuxuriosaMedicao && typeof window.LuxuriosaMedicao.registrar === "function") {
          window.LuxuriosaMedicao.registrar("whatsapp_contact", { method: "whatsapp" });
        }

        window.open(url, "_blank", "noopener,noreferrer");
      });
    });
  }


  /* =======================================================
     NAVEGAÇÃO DA CONTA — SESSÃO AUTENTICADA
     ======================================================= */

  function configurarNavegacaoDaConta() {
    var accountLink = document.querySelector("[data-nav-account]");
    var accountHint = document.querySelector("[data-nav-account-hint]");
    var ordersLink = document.querySelector("[data-nav-orders]");
    if (!accountLink || !ordersLink) return;

    function atualizarNavegacao(session) {
      var authenticated = !!(session && session.user && session.user.id);
      accountLink.href = authenticated ? "/minha-conta/" : "/login.html";
      accountLink.setAttribute(
        "aria-label",
        authenticated ? "Minha conta — acessar meu perfil" : "Minha conta — entrar ou criar conta"
      );
      if (accountHint) {
        accountHint.textContent = authenticated
          ? "Acesse seus dados e preferências"
          : "Entre ou crie sua conta";
      }
      ordersLink.hidden = !authenticated;
      ordersLink.setAttribute("aria-hidden", authenticated ? "false" : "true");
    }

    /* O estado inicial é fechado por segurança até o Supabase confirmar a sessão. */
    atualizarNavegacao(null);

    import("https://esm.sh/@supabase/supabase-js@2")
      .then(function (mod) {
        var supabase = mod.createClient(
          "https://byiykxfugvxuowueuxca.supabase.co",
          "sb_publishable_LaMBeWQ1PNANEQ85SD_35Q_wDzswy8y",
          { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
        );

        supabase.auth.onAuthStateChange(function (_event, session) {
          atualizarNavegacao(session);
        });

        return supabase.auth.getSession();
      })
      .then(function (result) {
        if (result && result.data) atualizarNavegacao(result.data.session);
      })
      .catch(function () {
        /* Sem confirmação da sessão, mantém Meus pedidos oculto e a conta direcionada ao login. */
        atualizarNavegacao(null);
      });
  }


  /* =======================================================
     MENU MOBILE
     ======================================================= */

  function configurarMenu() {
    var botao = $("burger");
    var menu = $("navlinks");
    if (!botao || !menu) return;

    var header = botao.closest("header");
    var closeButton = menu.querySelector(".nav-drawer-close");
    if (!header) return;

    var backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "nav-drawer-backdrop";
    backdrop.setAttribute("aria-label", "Fechar menu");
    backdrop.tabIndex = -1;
    header.appendChild(backdrop);

    var mobileQuery = window.matchMedia("(max-width: 1199px)");

    function estaAberto() {
      return menu.classList.contains("open");
    }

    function sincronizarViewport() {
      if (mobileQuery.matches) {
        if (!estaAberto()) {
          menu.setAttribute("aria-hidden", "true");
          menu.setAttribute("inert", "");
        }
      } else {
        menu.classList.remove("open");
        menu.removeAttribute("aria-hidden");
        menu.removeAttribute("inert");
        backdrop.classList.remove("open");
        header.classList.remove("mobile-menu-active");
        document.body.classList.remove("mobile-menu-open");
        botao.classList.remove("open");
        botao.setAttribute("aria-expanded", "false");
        botao.setAttribute("aria-label", "Abrir menu");
      }
    }

    function fecharMenu(devolverFoco) {
      var estavaAberto = estaAberto();
      menu.classList.remove("open");
      backdrop.classList.remove("open");
      header.classList.remove("mobile-menu-active");
      document.body.classList.remove("mobile-menu-open");
      botao.classList.remove("open");
      botao.setAttribute("aria-expanded", "false");
      botao.setAttribute("aria-label", "Abrir menu");
      menu.setAttribute("aria-hidden", "true");
      menu.setAttribute("inert", "");

      if (devolverFoco !== false && estavaAberto) botao.focus();
    }

    function abrirMenu() {
      if (!mobileQuery.matches) return;
      menu.removeAttribute("inert");
      menu.setAttribute("aria-hidden", "false");
      menu.classList.add("open");
      backdrop.classList.add("open");
      header.classList.add("mobile-menu-active");
      document.body.classList.add("mobile-menu-open");
      botao.classList.add("open");
      botao.setAttribute("aria-expanded", "true");
      botao.setAttribute("aria-label", "Menu aberto");

      window.requestAnimationFrame(function () {
        if (closeButton) closeButton.focus();
        else {
          var first = menu.querySelector("a[href], button:not([disabled])");
          if (first) first.focus();
        }
      });
    }

    botao.addEventListener("click", function (evento) {
      evento.stopPropagation();
      if (estaAberto()) fecharMenu(false);
      else abrirMenu();
    });

    if (closeButton) closeButton.addEventListener("click", function () {
      fecharMenu(true);
    });

    backdrop.addEventListener("click", function () {
      fecharMenu(true);
    });

    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        fecharMenu(false);
      });
    });

    menu.addEventListener("keydown", function (evento) {
      if (!estaAberto()) return;
      if (evento.key === "Escape") {
        evento.preventDefault();
        fecharMenu(true);
        return;
      }
      if (evento.key !== "Tab") return;

      var focaveis = Array.prototype.slice.call(
        menu.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(function (elemento) {
        return elemento.offsetParent !== null;
      });

      if (!focaveis.length) {
        evento.preventDefault();
        if (closeButton) closeButton.focus();
        return;
      }

      var primeiro = focaveis[0];
      var ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    });

    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", sincronizarViewport);
    } else if (typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(sincronizarViewport);
    }
    sincronizarViewport();
  }

  /* =======================================================
     CONTROLE DE IDADE +18
     ======================================================= */

  function configurarAgeGate() {

    var gate = $("gate");
    var botaoSim = $("gateYes");

    if (!gate || !botaoSim) {
      return;
    }


    var autorizado = false;


    try {

      autorizado =
        localStorage.getItem("lux18") === "1";

    } catch (erro) {

      console.warn(
        "Luxuriosa: localStorage indisponível.",
        erro
      );

    }


    if (autorizado) {

      gate.classList.remove("open");
      gate.setAttribute("aria-hidden", "true");

    } else {

      gate.classList.add("open");
      gate.setAttribute("aria-hidden", "false");

      /* Mantém o foco dentro da confirmação de idade enquanto estiver aberta. */
      window.requestAnimationFrame(function () {
        botaoSim.focus();
      });

    }

    gate.addEventListener("keydown", function (evento) {
      if (evento.key !== "Tab" || !gate.classList.contains("open")) return;

      var focaveis = Array.prototype.slice.call(
        gate.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(function (elemento) {
        return !elemento.hidden && elemento.offsetParent !== null;
      });

      if (!focaveis.length) {
        evento.preventDefault();
        return;
      }

      var primeiro = focaveis[0];
      var ultimo = focaveis[focaveis.length - 1];

      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    });

    botaoSim.addEventListener(
      "click",
      function () {

        try {

          localStorage.setItem(
            "lux18",
            "1"
          );

        } catch (erro) {

          console.warn(
            "Luxuriosa: não foi possível salvar a confirmação de idade.",
            erro
          );

        }

        gate.classList.remove("open");
        gate.setAttribute("aria-hidden", "true");

      }
    );

  }



  /* =======================================================
     CONVITE DE CADASTRO
     ======================================================= */

  function configurarConviteCadastro() {
    var overlay = $("accountPromo");
    var dialog = overlay && overlay.querySelector(".account-promo");
    var fechar = $("accountPromoClose");
    var depois = $("accountPromoLater");
    var gate = $("gate");
    var botaoIdade = $("gateYes");

    if (!overlay || !dialog || !fechar || !depois) return;

    var storageKey = "luxuriosa_signup_popup_last_seen";
    var intervalo = 7 * 24 * 60 * 60 * 1000;
    var timer = null;
    var focoAnterior = null;

    function jaFoiExibidoRecentemente() {
      try {
        var ultimaExibicao = Number(localStorage.getItem(storageKey) || 0);
        return ultimaExibicao > 0 && Date.now() - ultimaExibicao < intervalo;
      } catch (erro) {
        return false;
      }
    }

    function abrir() {
      if (jaFoiExibidoRecentemente()) return;

      /* Não empilha o convite de cadastro sobre as preferências de cookies. */
      var consentOverlay = $("lux-cookie-overlay");
      if (document.body.classList.contains("lux-consent-open") ||
          (consentOverlay && consentOverlay.classList.contains("open"))) {
        window.addEventListener("lux:consent-updated", function () {
          timer = window.setTimeout(abrir, 5000);
        }, { once: true });
        return;
      }

      focoAnterior = document.activeElement;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("account-promo-open");
      try {
        localStorage.setItem(storageKey, String(Date.now()));
      } catch (erro) {
        /* O convite continua funcional mesmo sem armazenamento local. */
      }
      window.requestAnimationFrame(function () {
        var acao = dialog.querySelector("a[href]");
        if (acao) acao.focus();
        else dialog.focus();
      });
    }

    function fecharConvite() {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("account-promo-open");
      if (focoAnterior && typeof focoAnterior.focus === "function") focoAnterior.focus();
    }

    function agendar() {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(abrir, 12000);
    }

    if (gate && gate.classList.contains("open")) {
      if (botaoIdade) botaoIdade.addEventListener("click", agendar, { once: true });
    } else {
      agendar();
    }

    fechar.addEventListener("click", fecharConvite);
    depois.addEventListener("click", fecharConvite);
    overlay.addEventListener("click", function (evento) {
      if (evento.target === overlay) fecharConvite();
    });
    document.addEventListener("keydown", function (evento) {
      if (!overlay.classList.contains("open")) return;
      if (evento.key === "Escape") {
        fecharConvite();
        return;
      }
      if (evento.key !== "Tab") return;
      var focaveis = Array.prototype.slice.call(
        dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(function (elemento) { return elemento.offsetParent !== null; });
      if (!focaveis.length) {
        evento.preventDefault();
        dialog.focus();
        return;
      }
      var primeiro = focaveis[0];
      var ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    });
  }

  /* =======================================================
     ANO AUTOMÁTICO DO FOOTER
     ======================================================= */

  function configurarAno() {

    var ano = $("anoAtual");

    if (!ano) {
      return;
    }


    ano.textContent =
      new Date().getFullYear();

  }


  /* =======================================================
     ACESSIBILIDADE
     ======================================================= */

  function configurarAcessibilidade() {

    var botao = $("burger");

    if (!botao) {
      return;
    }


    botao.setAttribute(
      "aria-label",
      "Abrir menu"
    );


    botao.setAttribute(
      "aria-expanded",
      "false"
    );


    botao.setAttribute(
      "aria-controls",
      "navlinks"
    );

  }


  /* =======================================================
     ROLAGEM SUAVE
     ======================================================= */

  function configurarScroll() {

    document
      .querySelectorAll('a[href^="#"]')
      .forEach(function (link) {

        link.addEventListener(
          "click",
          function (evento) {

            var destinoId =
              link.getAttribute("href");


            if (
              !destinoId ||
              destinoId === "#"
            ) {
              return;
            }


            var destino;


            try {

              destino =
                document.querySelector(destinoId);

            } catch (erro) {

              return;

            }


            if (!destino) {
              return;
            }


            evento.preventDefault();


            var reduzirMovimento =
              window.matchMedia &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches;

            destino.scrollIntoView({
              behavior: reduzirMovimento ? "auto" : "smooth",
              block: "start"
            });

          }
        );

      });

  }


  /* =======================================================
     INICIALIZAÇÃO
     ======================================================= */

  function iniciar() {

    configurarAcessibilidade();
    configurarWhatsApp();

    configurarMenu();
    configurarNavegacaoDaConta();
    configurarAno();
    configurarScroll();
}


  /* =======================================================
     DOM READY
     ======================================================= */

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      iniciar
    );

  } else {

    iniciar();

  }

})();