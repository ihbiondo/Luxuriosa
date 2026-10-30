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

  /* =======================================================
     COPIAR CUPOM
     ======================================================= */

  function configurarCupons() {

    document
      .querySelectorAll("[data-copy]")
      .forEach(function (botao) {

        var original = botao.textContent;

        botao.addEventListener(
          "click",
          function () {

            var codigo =
              botao.getAttribute("data-copy");

            function avisar() {

              botao.textContent = "Copiado!";

              setTimeout(function () {
                botao.textContent = original;
              }, 1800);
            }

            if (
              navigator.clipboard &&
              navigator.clipboard.writeText
            ) {

              navigator.clipboard
                .writeText(codigo)
                .then(avisar, function () {});

            } else {

              var campo =
                document.createElement("textarea");

              campo.value = codigo;

              document.body.appendChild(campo);

              campo.select();

              try {
                document.execCommand("copy");
                avisar();
              } catch (e) {}

              document.body.removeChild(campo);
            }
          }
        );
      });
  }


  function iniciar() {

    configurarAcessibilidade();

    configurarMenu();
configurarAno();

    configurarScroll();

    configurarCupons();

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