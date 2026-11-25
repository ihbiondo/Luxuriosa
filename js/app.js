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
    /* A loja não exige conta: remove atalhos antigos de login e área de membro. */
    document.querySelectorAll(
      ".account-trigger, [data-nav-account], [data-nav-auth-only-group], [data-nav-auth-only]"
    ).forEach(function (element) {
      element.remove();
    });
  }

  /* =======================================================
     MENU PÚBLICO UNIFICADO
     Um único componente para home, loja, serviços e páginas de produto.
     ======================================================= */
  function aplicarMenuUnificado() {
    var header = document.querySelector("header");
    var menu = header && header.querySelector(".navlinks");
    if (!header || !menu) return Promise.resolve();

    var cssHref = "/css/navigation.css?v=20261120-desktop-backdrop-v1";
    var cssLink = document.querySelector('link[rel="stylesheet"][href*="navigation.css"]');
    var cssTarget = new URL(cssHref, window.location.href).href;
    var cssReady = new Promise(function (resolve, reject) {
      if (cssLink && cssLink.href === cssTarget && cssLink.sheet) {
        resolve();
        return;
      }

      if (!cssLink) {
        cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
      }

      cssLink.addEventListener("load", resolve, { once: true });
      cssLink.addEventListener("error", function () {
        reject(new Error("Falha ao carregar css/navigation.css."));
      }, { once: true });

      if (cssLink.href !== cssTarget || !cssLink.sheet) {
        cssLink.href = cssHref;
      }
      if (!cssLink.isConnected) document.head.appendChild(cssLink);
    });

    var caminho = window.location.pathname || "/";
    var produto = caminho.indexOf("/produtos/") === 0;
    var loja = caminho === "/loja.html" || produto;
    var lingerie = caminho.indexOf("/loja/lingerie") === 0;
    var atendimento = caminho === "/atendimento.html";
    var entregas = caminho.indexOf("/entregas") === 0;

    var menuHtml = [
      '<div class="nav-drawer-top">',
        '<div class="nav-drawer-brand">',
          '<span class="nav-drawer-title">LUXURIOSA</span>',
          '<span class="nav-drawer-subtitle">Sinta-se ainda mais você</span>',
        '</div>',
        '<button class="nav-drawer-close" type="button" aria-label="Fechar menu">×</button>',
      '</div>',
      '<a class="nav-primary-link nav-link-shop" href="/loja.html"' + (loja ? ' aria-current="page"' : '') + '>',
        '<span class="nav-link-icon" aria-hidden="true">',
          '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 8h14l1 13H4L5 8Z"></path><path d="M9 9V6a3 3 0 0 1 6 0v3"></path></svg>',
        '</span><span>Loja</span>',
      '</a>',
      '<details class="nav-submenu nav-store-submenu" open>',
        '<summary>Categorias da loja</summary>',
        '<div class="nav-store-grid">',
        '<a href="/loja.html?categoria=G%C3%A9is%20e%20estimulantes">Géis e estimulantes</a>',
        '<a href="/loja.html?categoria=Vibradores%20e%20masturbadores">Vibradores e masturbadores</a>',
        '<a href="/loja.html?categoria=Jogos%20e%20acess%C3%B3rios">Jogos e acessórios</a>',
        '<a href="/loja.html?categoria=Perfumes%20e%20higiene">Perfumes e higiene</a>',
        '<a href="/loja.html?categoria=%C3%93leos%20para%20massagem">Óleos para massagem</a>',
        '<a href="/loja.html?categoria=Kits">Kits</a>',
        '<a href="/loja/lingerie/"' + (lingerie ? ' aria-current="page"' : '') + '>Lingerie</a>',
        '<a class="nav-submenu-all" href="/loja.html">Ver todo catálogo</a>',
        '</div>',
      '</details>',
      '<div class="nav-menu-group nav-menu-group--help" role="group" aria-label="Atendimento e Ajuda">',
        '<span class="nav-menu-group-title">Atendimento e Ajuda</span>',
        '<a href="/atendimento.html"' + (atendimento ? ' aria-current="page"' : '') + '>',
          '<span class="nav-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 13v-2a8 8 0 0 1 16 0v2"></path><rect x="3" y="12" width="4" height="7" rx="2"></rect><rect x="17" y="12" width="4" height="7" rx="2"></rect><path d="M19 19a3 3 0 0 1-3 3h-2"></path></svg></span><span>Atendimento</span>',
        '</a>',
        '<a href="/entregas/"' + (entregas ? ' aria-current="page"' : '') + '>',
          '<span class="nav-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="6" cy="17" r="2.5"></circle><circle cx="18" cy="17" r="2.5"></circle><path d="M8.5 17h4l2-6h3l2 6M12.5 17l-3-7H6M14.5 11H11"></path></svg></span><span>Entregas</span>',
        '</a>',
        '<a href="/faq.html">',
          '<span class="nav-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9"></circle><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1 1-1.8 1.3-1.8 2.7M12 17.2v.1"></path></svg></span><span>Dúvidas frequentes</span>',
        '</a>',
        '<div class="nav-submenu nav-help-submenu">',
          '<a href="/faq.html#faq-pedidos">Pedidos e produtos</a>',
          '<a href="/faq.html#faq-entrega">Frete e entrega</a>',
          '<a href="/faq.html#faq-pagamento">Pagamento</a>',
          '<a href="/faq.html#faq-devolucoes">Trocas e devoluções</a>',
          '<a href="/privacidade.html">Privacidade</a>',
        '</div>',
      '</div>',
      '<div class="nav-menu-group nav-menu-group--discover" role="group" aria-label="Conhecer">',
        '<span class="nav-menu-group-title">Conhecer</span>',
        '<a href="/educacao/">',
          '<span class="nav-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H21v17H5.5A2.5 2.5 0 0 0 3 22V5.5Z"></path><path d="M3 6h14M8 7v10"></path></svg></span><span>Educação</span>',
        '</a>',
        '<div class="nav-submenu">',
          '<a href="/educacao/temas/">Temas educativos</a>',
          '<a href="/educacao/enciclopedia/">Enciclopédia</a>',
          '<a href="/educacao/curiosidades/">Curiosidades</a>',
          '<a href="/educacao/guias/">Guias</a>',
          '<a href="/educacao/interatividade/">Interatividade</a>',
          '<a href="/educacao/duvidas-frequentes/">Dúvidas frequentes</a>',
        '</div>',
        '<a href="/experiencias/">',
          '<span class="nav-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"></path></svg></span><span>Experiências</span>',
        '</a>',
        '<div class="nav-submenu">',
          '<a href="/experiencias/?tipo=couple#experienceGrid">Conexão a dois</a>',
          '<a href="/experiencias/?tipo=astrology#experienceGrid">Astrologia</a>',
          '<a href="/experiencias/?tipo=quiz#experienceGrid">Quizzes</a>',
          '<a href="/experiencias/?tipo=challenge#experienceGrid">Desafios</a>',
        '</div>',
      '</div>',
      '<div class="nav-drawer-footer"><p>ATENDIMENTO DISCRETO <span aria-hidden="true">·</span> BAURU E REGIÃO</p></div>'
    ].join("");

    menu.id = "navlinks";
    menu.className = "navlinks";
    menu.setAttribute("aria-label", "Menu principal");
    menu.innerHTML = menuHtml;

    var logo = header.querySelector(".logo");
    if (logo) logo.setAttribute("href", "/");

    var container = menu.parentElement || header;
    var navRight = container.querySelector(":scope > .nav-right");
    if (!navRight) {
      navRight = document.createElement("div");
      navRight.className = "nav-right";
      menu.insertAdjacentElement("afterend", navRight);
    }

    if (!navRight.querySelector("[data-wa], a[href*='wa.me'], .btn.ghost.small")) {
      var whatsapp = document.createElement("button");
      whatsapp.type = "button";
      whatsapp.className = "btn ghost small";
      whatsapp.setAttribute("data-wa", "");
      whatsapp.textContent = "WhatsApp";
      navRight.appendChild(whatsapp);
    }

    var burger = navRight.querySelector("#burger") || header.querySelector("#burger");
    if (!burger) {
      burger = document.createElement("button");
      burger.type = "button";
      burger.className = "burger";
      burger.id = "burger";
      burger.textContent = "☰";
      navRight.appendChild(burger);
    }
    burger.classList.add("burger");
    burger.id = "burger";
    burger.type = "button";
    burger.setAttribute("aria-label", "Abrir menu");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-controls", "navlinks");
    burger.disabled = true;

    return cssReady;
  }

  /* =======================================================
     MENU MOBILE
     ======================================================= */

  function configurarMenu() {
    var botao = $("burger");
    var menu = $("navlinks");
    if (!botao || !menu) return;
    botao.disabled = false;

    var header = botao.closest("header");
    function obterBotaoFechar() { return menu.querySelector(".nav-drawer-close"); }
    if (!header) return;

    /* O menu mobile é uma lista plana: sem acordeões ou submenus. */

    var backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "nav-drawer-backdrop";
    backdrop.setAttribute("aria-label", "Fechar menu");
    backdrop.tabIndex = -1;
    /* O fundo e o painel precisam compartilhar o mesmo contexto de empilhamento. */
    (menu.parentElement || header).appendChild(backdrop);

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

      function focarFechar() {
        var currentTarget = obterBotaoFechar();
        if (currentTarget && !currentTarget.disabled) currentTarget.focus();
      }
      if (obterBotaoFechar()) {
        focarFechar();
      } else {
        var first = menu.querySelector("a[href], button:not([disabled])");
        if (first) first.focus();
      }
    }

    botao.addEventListener("click", function (evento) {
      evento.stopPropagation();
      if (estaAberto()) fecharMenu(false);
      else abrirMenu();
    });

    menu.addEventListener("click", function (evento) {
      var target = evento.target;
      var closeButton = target && typeof target.closest === "function"
        ? target.closest(".nav-drawer-close")
        : null;
      if (closeButton && menu.contains(closeButton)) {
        evento.preventDefault();
        fecharMenu(true);
      }
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
        var closeButton = obterBotaoFechar();
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
    var main = document.querySelector("main");
    if (main) {
      if (!main.id) main.id = "conteudo-principal";
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      var skipLink = document.querySelector("a.skip-link");
      if (!skipLink) {
        skipLink = document.createElement("a");
        skipLink.className = "skip-link";
        skipLink.href = "#" + main.id;
        skipLink.textContent = "Pular para o conteúdo";
        document.body.insertBefore(skipLink, document.body.firstChild);
      } else {
        skipLink.href = "#" + main.id;
      }
    }

    var botao = $("burger");
    if (!botao) return;
    botao.setAttribute("aria-label", "Abrir menu");
    botao.setAttribute("aria-expanded", "false");
    botao.setAttribute("aria-controls", "navlinks");
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

    var menuStyleReady = aplicarMenuUnificado();
    configurarAcessibilidade();
    configurarWhatsApp();
    configurarNavegacaoDaConta();
    configurarAno();
    configurarScroll();

    Promise.resolve(menuStyleReady).then(function () {
      configurarMenu();
    }).catch(function (erro) {
      console.error("Luxuriosa: não foi possível carregar o CSS da navegação.", erro);
      configurarMenu();
    });
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