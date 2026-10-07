/* =========================================================
   LUXURIOSA
   CARRINHO.JS
   Carrinho local + resumo + WhatsApp
   ========================================================= */

(function () {
  "use strict";


  /* =======================================================
     CONFIGURAÇÃO
     ======================================================= */

  var STORAGE_KEY =
    "luxuriosa_carrinho";

  var FALLBACK_WHATSAPP =
    "5514996355924";

  var MAX_QUANTIDADE = 99;

  var carrinho = [];


  /* =======================================================
     UTILITÁRIOS
     ======================================================= */

  function $(id) {
    return document.getElementById(id);
  }


  function formatarPreco(valor) {

    return Number(valor).toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL"
      }
    );

  }


  function obterWhatsApp() {

    if (
      window.LuxuriosaCatalogo &&
      typeof window.LuxuriosaCatalogo.obterConfig ===
        "function"
    ) {

      var config =
        window.LuxuriosaCatalogo.obterConfig();


      if (
        config &&
        config.whatsapp
      ) {

        var numero =
          String(
            config.whatsapp
          ).replace(
            /\D/g,
            ""
          );


        if (numero) {
          return numero;
        }

      }

    }


    return FALLBACK_WHATSAPP;

  }


  function abrirWhatsApp(
    mensagem
  ) {

    var numero =
      obterWhatsApp();


    var url =
      "https://wa.me/" +
      numero +
      "?text=" +
      encodeURIComponent(
        mensagem
      );


    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

  }


  function criarElemento(
    tag,
    classe,
    texto
  ) {

    var elemento =
      document.createElement(
        tag
      );


    if (classe) {
      elemento.className =
        classe;
    }


    if (
      texto !== undefined &&
      texto !== null
    ) {

      elemento.textContent =
        texto;

    }


    return elemento;

  }


  /* =======================================================
     STORAGE
     ======================================================= */

  function salvar() {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          carrinho
        )
      );

    } catch (erro) {

      console.warn(
        "Luxuriosa: não foi possível salvar o carrinho.",
        erro
      );

    }

  }


  function normalizarItem(
    item
  ) {

    if (
      !item ||
      item.id === undefined ||
      item.id === null
    ) {
      return null;
    }


    var quantidade =
      Number(
        item.quantidade
      );


    if (
      !Number.isFinite(
        quantidade
      ) ||
      quantidade < 1
    ) {
      quantidade = 1;
    }


    quantidade =
      Math.min(
        Math.floor(
          quantidade
        ),
        MAX_QUANTIDADE
      );


    return {

      id: item.id,

      nome:
        String(
          item.nome ||
          "Produto Luxuriosa"
        ),

      preco:
        Number(
          item.preco
        ) || 0,

      imagem:
        String(
          item.imagem ||
          ""
        ),

      categoria:
        String(
          item.categoria ||
          ""
        ),

      tamanhos:
        String(
          item.tamanhos ||
          ""
        ),

      quantidade:
        quantidade

    };

  }


  function carregar() {

    try {

      var dados =
        localStorage.getItem(
          STORAGE_KEY
        );


      if (!dados) {

        carrinho = [];

        return;

      }


      var convertido =
        JSON.parse(
          dados
        );


      if (
        !Array.isArray(
          convertido
        )
      ) {

        carrinho = [];

        return;

      }


      carrinho =
        convertido
          .map(
            normalizarItem
          )
          .filter(
            function (item) {
              return item !== null;
            }
          );


    } catch (erro) {

      console.warn(
        "Luxuriosa: carrinho inválido.",
        erro
      );


      carrinho = [];

      try {

        localStorage.removeItem(
          STORAGE_KEY
        );

      } catch (erroStorage) {

        console.warn(
          "Luxuriosa: não foi possível limpar o carrinho inválido.",
          erroStorage
        );

      }

    }

  }


  /* =======================================================
     CARRINHO
     ======================================================= */

  function adicionar(
    produto,
    quantidade
  ) {

    if (
      !produto ||
      produto.esgotado
    ) {
      return;
    }


    var id =
      produto.id;


    if (
      id === undefined ||
      id === null
    ) {
      return;
    }


    quantidade =
      Number(
        quantidade
      );


    if (
      !Number.isFinite(
        quantidade
      ) ||
      quantidade < 1
    ) {

      quantidade = 1;

    }


    quantidade =
      Math.min(
        Math.floor(
          quantidade
        ),
        MAX_QUANTIDADE
      );


    var existente =
      carrinho.find(
        function (item) {

          return (
            String(
              item.id
            ) ===
            String(id)
          );

        }
      );


    if (existente) {

      existente.quantidade =
        Math.min(
          existente.quantidade +
            quantidade,
          MAX_QUANTIDADE
        );

    } else {

      carrinho.push({

        id:
          id,

        nome:
          produto.nome ||
          "Produto Luxuriosa",

        preco:
          Number(
            produto.preco
          ) || 0,

        imagem:
          produto.imagem ||
          "",

        categoria:
          produto.categoria ||
          "",

        tamanhos:
          produto.tamanhos ||
          "",

        quantidade:
          quantidade

      });

    }


    salvar();

    renderizar();

    abrirCarrinho();

  }


  function remover(
    id
  ) {

    carrinho =
      carrinho.filter(
        function (item) {

          return (
            String(
              item.id
            ) !==
            String(id)
          );

        }
      );


    salvar();

    renderizar();

  }


  function alterarQuantidade(
    id,
    quantidade
  ) {

    var item =
      carrinho.find(
        function (produto) {

          return (
            String(
              produto.id
            ) ===
            String(id)
          );

        }
      );


    if (!item) {
      return;
    }


    quantidade =
      Number(
        quantidade
      );


    if (
      !Number.isFinite(
        quantidade
      )
    ) {
      return;
    }


    quantidade =
      Math.floor(
        quantidade
      );


    if (
      quantidade <= 0
    ) {

      remover(id);

      return;

    }


    item.quantidade =
      Math.min(
        Math.max(
          1,
          quantidade
        ),
        MAX_QUANTIDADE
      );


    salvar();

    renderizar();

  }


  function limpar() {

    carrinho = [];

    salvar();

    renderizar();

  }


  /* =======================================================
     CÁLCULOS
     ======================================================= */

  function quantidadeTotal() {

    return carrinho.reduce(
      function (
        total,
        item
      ) {

        return (
          total +
          Number(
            item.quantidade
          )
        );

      },
      0
    );

  }


  function valorTotal() {

    return carrinho.reduce(
      function (
        total,
        item
      ) {

        return (
          total +
          (
            Number(
              item.preco
            ) || 0
          ) *
          (
            Number(
              item.quantidade
            ) || 0
          )
        );

      },
      0
    );

  }


  /* =======================================================
     IMAGEM DO CARRINHO
     ======================================================= */

  function preencherImagem(
    container,
    item
  ) {

    container.textContent =
      "";


    if (
      item.imagem
    ) {

      var imagem =
        criarElemento(
          "img"
        );


      imagem.src =
        item.imagem;


      imagem.alt =
        item.nome;


      imagem.loading =
        "lazy";


      imagem.onerror =
        function () {

          this.style.display =
            "none";


          if (
            container.querySelector(
              ".image-fallback"
            )
          ) {
            return;
          }


          container.appendChild(
            criarElemento(
              "span",
              "image-fallback",
              "L"
            )
          );

        };


      container.appendChild(
        imagem
      );


      return;

    }


    container.appendChild(
      criarElemento(
        "span",
        "image-fallback",
        "L"
      )
    );

  }


  /* =======================================================
     RENDERIZAÇÃO
     ======================================================= */

  function renderizar() {

    var lista =
      $("cartItems");

    var vazio =
      $("cartEmpty");

    var rodape =
      $("cartFooter");

    var contador =
      $("cartCount");

    var total =
      $("cartTotal");


    atualizarContador();


    if (!lista) {
      return;
    }


    lista.textContent =
      "";


    if (
      !carrinho.length
    ) {

      if (vazio) {
        vazio.hidden =
          false;
      }


      if (rodape) {
        rodape.hidden =
          true;
      }


      return;

    }


    if (vazio) {
      vazio.hidden =
        true;
    }


    if (rodape) {
      rodape.hidden =
        false;
    }


    carrinho.forEach(
      function (item) {

        var linha =
          criarElemento(
            "article",
            "cart-item"
          );


        linha.setAttribute(
          "data-product-id",
          String(
            item.id
          )
        );


        /* =================================================
           IMAGEM
           ================================================= */

        var imagem =
          criarElemento(
            "div",
            "cart-item-img"
          );


        preencherImagem(
          imagem,
          item
        );


        /* =================================================
           INFORMAÇÕES
           ================================================= */

        var info =
          criarElemento(
            "div",
            "cart-item-info"
          );


        if (
          item.categoria
        ) {

          info.appendChild(
            criarElemento(
              "span",
              "cart-item-category",
              item.categoria
            )
          );

        }


        info.appendChild(
          criarElemento(
            "strong",
            "cart-item-name",
            item.nome
          )
        );


        info.appendChild(
          criarElemento(
            "span",
            "cart-item-price",
            formatarPreco(
              item.preco
            )
          )
        );


        /* =================================================
           CONTROLES
           ================================================= */

        var controles =
          criarElemento(
            "div",
            "cart-item-controls"
          );


        var diminuir =
          criarElemento(
            "button",
            "cart-qty-btn",
            "−"
          );


        diminuir.type =
          "button";


        diminuir.setAttribute(
          "aria-label",
          "Diminuir quantidade de " +
          item.nome
        );


        diminuir.disabled =
          item.quantidade <= 1;


        diminuir.addEventListener(
          "click",
          function () {

            alterarQuantidade(
              item.id,
              item.quantidade - 1
            );

          }
        );


        var quantidade =
          criarElemento(
            "span",
            "cart-qty",
            String(
              item.quantidade
            )
          );


        quantidade.setAttribute(
          "aria-label",
          "Quantidade: " +
          item.quantidade
        );


        var aumentar =
          criarElemento(
            "button",
            "cart-qty-btn",
            "+"
          );


        aumentar.type =
          "button";


        aumentar.setAttribute(
          "aria-label",
          "Aumentar quantidade de " +
          item.nome
        );


        aumentar.disabled =
          item.quantidade >=
          MAX_QUANTIDADE;


        aumentar.addEventListener(
          "click",
          function () {

            alterarQuantidade(
              item.id,
              item.quantidade + 1
            );

          }
        );


        controles.appendChild(
          diminuir
        );


        controles.appendChild(
          quantidade
        );


        controles.appendChild(
          aumentar
        );


        /* =================================================
           REMOVER
           ================================================= */

        var removerBotao =
          criarElemento(
            "button",
            "cart-remove",
            "Remover"
          );


        removerBotao.type =
          "button";


        removerBotao.setAttribute(
          "aria-label",
          "Remover " +
          item.nome +
          " do carrinho"
        );


        removerBotao.addEventListener(
          "click",
          function () {

            remover(
              item.id
            );

          }
        );


        /* =================================================
           LINHA
           ================================================= */

        linha.appendChild(
          imagem
        );


        linha.appendChild(
          info
        );


        linha.appendChild(
          controles
        );


        linha.appendChild(
          removerBotao
        );


        lista.appendChild(
          linha
        );

      }
    );


    if (total) {

      total.textContent =
        formatarPreco(
          valorTotal()
        );

    }


    if (contador) {

      contador.textContent =
        String(
          quantidadeTotal()
        );


      contador.hidden =
        false;

    }

  }


  function atualizarContador() {

    var contador =
      $("cartCount");


    if (!contador) {
      return;
    }


    var quantidade =
      quantidadeTotal();


    contador.textContent =
      String(
        quantidade
      );


    contador.hidden =
      quantidade === 0;

  }


  /* =======================================================
     ABRIR / FECHAR
     ======================================================= */

  function abrirCarrinho() {

    var elemento =
      $("cart");

    var overlay =
      $("cartOverlay");


    if (!elemento) {
      return;
    }


    elemento.classList.add(
      "open"
    );


    if (overlay) {

      overlay.classList.add(
        "open"
      );

      overlay.setAttribute(
        "aria-hidden",
        "false"
      );

    }


    elemento.setAttribute(
      "aria-hidden",
      "false"
    );


    document.body.classList.add(
      "cart-open"
    );


    /*
     * Mantém o foco no carrinho
     * para navegação por teclado.
     */

    var fechar =
      $("cartClose");


    if (fechar) {

      setTimeout(
        function () {
          fechar.focus();
        },
        50
      );

    }

  }


  function fecharCarrinho() {

    var elemento =
      $("cart");

    var overlay =
      $("cartOverlay");


    if (!elemento) {
      return;
    }


    elemento.classList.remove(
      "open"
    );


    if (overlay) {

      overlay.classList.remove(
        "open"
      );

      overlay.setAttribute(
        "aria-hidden",
        "true"
      );

    }


    elemento.setAttribute(
      "aria-hidden",
      "true"
    );


    document.body.classList.remove(
      "cart-open"
    );

  }


  /* =======================================================
     WHATSAPP / PEDIDO
     ======================================================= */

  function montarMensagemPedido() {

    var mensagem =
      "Olá! Quero fazer um pedido na Luxuriosa:\n\n";


    carrinho.forEach(
      function (item) {

        mensagem +=
          "• " +
          item.nome +
          " — " +
          item.quantidade +
          "x — " +
          formatarPreco(
            item.preco *
            item.quantidade
          ) +
          "\n";

      }
    );


    mensagem +=
      "\nTotal: " +
      formatarPreco(
        valorTotal()
      );


    mensagem +=
      "\n\nGostaria de confirmar disponibilidade, tamanhos e entrega.";


    return mensagem;

  }


  function finalizarPedido() {

    if (
      !carrinho.length
    ) {
      return;
    }


    var mensagem =
      montarMensagemPedido();


    abrirWhatsApp(
      mensagem
    );

  }


  /* =======================================================
     EVENTOS
     ======================================================= */

  function configurarEventos() {

    var abrir =
      $("cartOpen");

    var fechar =
      $("cartClose");

    var overlay =
      $("cartOverlay");

    var finalizar =
      $("cartCheckout");

    var limparCarrinho =
      $("cartClear");


    if (abrir) {

      abrir.addEventListener(
        "click",
        abrirCarrinho
      );

    }


    if (fechar) {

      fechar.addEventListener(
        "click",
        fecharCarrinho
      );

    }


    if (overlay) {

      overlay.addEventListener(
        "click",
        fecharCarrinho
      );

    }


    if (finalizar) {

      finalizar.addEventListener(
        "click",
        finalizarPedido
      );

    }


    if (limparCarrinho) {

      limparCarrinho.addEventListener(
        "click",
        function () {

          if (
            !carrinho.length
          ) {
            return;
          }


          if (
            window.confirm(
              "Deseja limpar o carrinho?"
            )
          ) {

            limpar();

          }

        }
      );

    }


    document.addEventListener(
      "keydown",
      function (evento) {

        if (
          evento.key ===
          "Escape"
        ) {

          fecharCarrinho();

        }

      }
    );

  }


  /* =======================================================
     EXPOSIÇÃO PÚBLICA
     ======================================================= */

  window.LuxuriosaCarrinho = {

    adicionar:
      adicionar,

    remover:
      remover,

    alterarQuantidade:
      alterarQuantidade,

    abrir:
      abrirCarrinho,

    fechar:
      fecharCarrinho,

    limpar:
      limpar,

    obterItens:
      function () {

        return carrinho.slice();

      },

    obterTotal:
      valorTotal,

    obterQuantidade:
      quantidadeTotal

  };


  /* =======================================================
     INICIALIZAÇÃO
     ======================================================= */

  function iniciar() {

    carregar();

    configurarEventos();

    renderizar();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      iniciar
    );

  } else {

    iniciar();

  }

})();