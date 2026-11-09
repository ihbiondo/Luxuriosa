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
     MENU MOBILE
     ======================================================= */

  function configurarMenu() {

    var botao = $("burger");
    var menu = $("navlinks");

    if (!botao || !menu) {
      return;
    }


    function fecharMenu() {

      menu.classList.remove("open");

      botao.classList.remove("open");

      botao.setAttribute(
        "aria-expanded",
        "false"
      );

      botao.setAttribute("aria-label", "Abrir menu");

    }


    function abrirOuFecharMenu() {

      var aberto =
        menu.classList.toggle("open");

      botao.classList.toggle(
        "open",
        aberto
      );

      botao.setAttribute(
        "aria-expanded",
        aberto ? "true" : "false"
      );

      botao.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");

    }


    /* Clique no botão */

    botao.addEventListener(
      "click",
      function (evento) {

        evento.stopPropagation();

        abrirOuFecharMenu();

      }
    );


    /* Clique nos links */

    menu
      .querySelectorAll("a")
      .forEach(function (link) {

        link.addEventListener(
          "click",
          fecharMenu
        );

      });


    /* Clique fora */

    document.addEventListener(
      "click",
      function (evento) {

        if (!menu.classList.contains("open")) {
          return;
        }

        if (
          !menu.contains(evento.target) &&
          !botao.contains(evento.target)
        ) {

          fecharMenu();

        }

      }
    );


    /* Tecla Escape */

    document.addEventListener(
      "keydown",
      function (evento) {

        if (evento.key === "Escape") {
          fecharMenu();
        }

      }
    );

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
      timer = window.setTimeout(abrir, 10000);
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

    configurarMenu();
    configurarAno();
    configurarScroll();
    configurarConviteCadastro();
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