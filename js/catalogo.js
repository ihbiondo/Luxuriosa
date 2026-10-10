/* =========================================================
   LUXURIOSA
   CATALOGO.JS
   Catálogo, filtros, produtos, modal e WhatsApp
   Integração com carrinho
   ========================================================= */

(function () {
  "use strict";


  /* =======================================================
     CONFIGURAÇÃO
     ======================================================= */

  var FALLBACK_WHATSAPP = "5514996355924";

  var CATEGORIAS = [
    "Todos",
    "Lingerie",
    "Intimidade",
    "Kits",
    "Ofertas"
  ];

  var config = {
    whatsapp: FALLBACK_WHATSAPP
  };

  var produtos = [];

  var filtroAtual = "Todos";


  /* =======================================================
     UTILITÁRIOS
     ======================================================= */

  function $(id) {
    return document.getElementById(id);
  }


  function criarElemento(tag, classe, texto) {
    var elemento = document.createElement(tag);

    if (classe) {
      elemento.className = classe;
    }

    if (
      texto !== undefined &&
      texto !== null
    ) {
      elemento.textContent = texto;
    }

    return elemento;
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


  function produtoEmOferta(produto) {
    return (
      typeof produto.precoAntigo === "number" &&
      typeof produto.preco === "number" &&
      produto.precoAntigo > produto.preco
    );
  }


  function numeroWhatsApp() {
    return String(
      config.whatsapp || FALLBACK_WHATSAPP
    ).replace(/\D/g, "");
  }


  function abrirWhatsApp(mensagem) {
    var numero = numeroWhatsApp();

    var texto =
      mensagem ||
      "Olá! Conheci a Luxuriosa pelo site e gostaria de saber mais.";

    var url =
      "https://wa.me/" +
      numero +
      "?text=" +
      encodeURIComponent(texto);

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }


  function mensagemProduto(produto) {

    var mensagem =
      "Olá! Tenho interesse em: " +
      produto.nome;

    if (
      typeof produto.preco === "number"
    ) {
      mensagem +=
        " (" +
        formatarPreco(produto.preco) +
        ")";
    }

    return mensagem;
  }


  /* =======================================================
     CARRINHO
     ======================================================= */

  function adicionarAoCarrinho(produto) {

    if (!produto || produto.esgotado) {
      return;
    }

    /*
     * O carrinho é carregado depois deste arquivo.
     *
     * Por isso verificamos se a API já está disponível
     * antes de tentar utilizá-la.
     */

    if (
      window.LuxuriosaCarrinho &&
      typeof window.LuxuriosaCarrinho.adicionar === "function"
    ) {

      window.LuxuriosaCarrinho.adicionar(
        produto,
        1
      );

      return;
    }


    /*
     * Fallback de segurança.
     *
     * Caso o carrinho ainda não esteja disponível,
     * não quebramos o catálogo.
     */

    abrirWhatsApp(
      mensagemProduto(produto)
    );
  }


  /* =======================================================
     IMAGEM
     ======================================================= */

  function preencherImagem(
    container,
    produto
  ) {

    if (!container) {
      return;
    }

    container.textContent = "";


    if (produto.imagem) {

      var imagem =
        criarElemento("img");

      imagem.src =
        produto.imagem;

      imagem.alt =
        produto.nome ||
        "Produto Luxuriosa";

      imagem.loading =
        "lazy";


      imagem.onerror =
        function () {

          this.style.display =
            "none";


          /*
           * Evita criar vários fallbacks
           * caso o navegador dispare
           * o evento mais de uma vez.
           */

          if (
            container.querySelector(
              ".image-fallback"
            )
          ) {
            return;
          }


          var fallback =
            criarElemento(
              "span",
              "image-fallback",
              obterSimboloProduto(
                produto
              )
            );


          container.appendChild(
            fallback
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
        obterSimboloProduto(
          produto
        )
      )
    );
  }


  function obterSimboloProduto(
    produto
  ) {

    if (
      produto.categoria ===
      "Intimidade"
    ) {
      return "♡";
    }


    if (
      produto.categoria ===
      "Kits"
    ) {
      return "✦";
    }


    return "L";
  }


  /* =======================================================
     PREÇO
     ======================================================= */

  function preencherPreco(
    container,
    produto
  ) {

    if (!container) {
      return;
    }

    container.textContent = "";


    if (
      typeof produto.preco ===
      "number"
    ) {

      container.appendChild(
        document.createTextNode(
          formatarPreco(
            produto.preco
          )
        )
      );


      if (
        produtoEmOferta(
          produto
        )
      ) {

        var antigo =
          criarElemento(
            "s",
            null,
            formatarPreco(
              produto.precoAntigo
            )
          );


        container.appendChild(
          antigo
        );
      }


      return;
    }


    container.textContent =
      "Consulte valores";
  }


  /* =======================================================
     FILTRAGEM
     ======================================================= */

  function obterProdutosFiltrados() {

    var lista =
      produtos.filter(
        function (produto) {

          if (
            filtroAtual ===
            "Todos"
          ) {
            return true;
          }


          if (
            filtroAtual ===
            "Ofertas"
          ) {

            return (
              produtoEmOferta(
                produto
              ) ||
              produto.categoria ===
              "Ofertas"
            );
          }


          return (
            produto.categoria ===
            filtroAtual
          );
        }
      );


    /*
     * Produtos em destaque
     * aparecem primeiro.
     *
     * Mantemos a ordem original
     * dos demais produtos.
     */

    return lista

      .map(
        function (
          produto,
          indice
        ) {

          return {
            produto:
              produto,

            indice:
              indice
          };
        }
      )

      .sort(
        function (a, b) {

          var destaqueA =
            a.produto.destaque
              ? 1
              : 0;

          var destaqueB =
            b.produto.destaque
              ? 1
              : 0;


          return (
            destaqueB -
            destaqueA ||
            a.indice -
            b.indice
          );
        }
      )

      .map(
        function (item) {
          return item.produto;
        }
      );
  }


  /* =======================================================
     FILTROS
     ======================================================= */

  function renderizarFiltros() {

    var container =
      $("chips");


    if (!container) {
      return;
    }


    container.textContent =
      "";


    CATEGORIAS.forEach(
      function (categoria) {

        var botao =
          criarElemento(
            "button",
            "chip" +
              (
                categoria ===
                filtroAtual
                  ? " active"
                  : ""
              ),
            categoria
          );


        botao.type =
          "button";


        botao.setAttribute(
          "role",
          "tab"
        );


        botao.setAttribute(
          "aria-selected",
          categoria ===
          filtroAtual
            ? "true"
            : "false"
        );


        botao.addEventListener(
          "click",
          function () {

            filtroAtual =
              categoria;


            renderizarFiltros();

            renderizarProdutos();
          }
        );


        container.appendChild(
          botao
        );
      }
    );
  }


  /* =======================================================
     BADGES
     ======================================================= */

  function criarBadges(
    produto,
    imagemContainer
  ) {

    var badges =
      criarElemento(
        "div",
        "badges"
      );


    if (
      produto.esgotado
    ) {

      badges.appendChild(
        criarElemento(
          "span",
          "badge sold",
          "Esgotado"
        )
      );

    } else {

      if (
        produto.novo
      ) {

        badges.appendChild(
          criarElemento(
            "span",
            "badge",
            "Novo"
          )
        );
      }


      if (
        produtoEmOferta(
          produto
        )
      ) {

        badges.appendChild(
          criarElemento(
            "span",
            "badge",
            "Oferta"
          )
        );
      }
    }


    if (
      badges.children.length
    ) {

      imagemContainer.appendChild(
        badges
      );
    }
  }


  /* =======================================================
     CARD DO PRODUTO
     ======================================================= */

  function criarCardProduto(
    produto
  ) {

    var card =
      criarElemento(
        "article",
        "product" +
          (
            produto.esgotado
              ? " out"
              : ""
          )
      );


    card.tabIndex =
      0;


    card.setAttribute(
      "role",
      "button"
    );


    card.setAttribute(
      "aria-label",
      "Ver detalhes de " +
      (
        produto.nome ||
        "produto Luxuriosa"
      )
    );


    /* =====================================================
       IMAGEM
       ===================================================== */

    var imagem =
      criarElemento(
        "div",
        "product-img"
      );


    preencherImagem(
      imagem,
      produto
    );


    criarBadges(
      produto,
      imagem
    );


    /* =====================================================
       CORPO
       ===================================================== */

    var corpo =
      criarElemento(
        "div",
        "product-body"
      );


    /* CATEGORIA */

    corpo.appendChild(
      criarElemento(
        "span",
        "tag",
        produto.categoria ||
        "Produto"
      )
    );


    /* NOME */

    corpo.appendChild(
      criarElemento(
        "h3",
        null,
        produto.nome ||
        "Produto Luxuriosa"
      )
    );


    /* PREÇO */

    var preco =
      criarElemento(
        "div",
        "price"
      );


    preencherPreco(
      preco,
      produto
    );


    corpo.appendChild(
      preco
    );


    /* =====================================================
       BOTÃO
       ===================================================== */

    var textoBotao =
      produto.esgotado
        ? "Avise-me quando voltar"
        : "Adicionar ao carrinho";


    var botao =
      criarElemento(
        "button",
        "btn ghost small",
        textoBotao
      );


    botao.type =
      "button";


    botao.setAttribute(
      "aria-label",
      produto.esgotado
        ? "Avise-me quando " +
          "voltar: " +
          produto.nome
        : "Adicionar " +
          produto.nome +
          " ao carrinho"
    );


    botao.addEventListener(
      "click",
      function (evento) {

        evento.stopPropagation();


        /*
         * Produto esgotado:
         * continua usando WhatsApp
         * para aviso de reposição.
         */

        if (
          produto.esgotado
        ) {

          abrirWhatsApp(
            "Olá! Quero ser avisada quando voltar: " +
            produto.nome
          );

          return;
        }


        /*
         * Produto disponível:
         * adiciona ao carrinho.
         */

        adicionarAoCarrinho(
          produto
        );
      }
    );


    corpo.appendChild(
      botao
    );


    /* =====================================================
       MONTA CARD
       ===================================================== */

    card.appendChild(
      imagem
    );

    card.appendChild(
      corpo
    );


    /* =====================================================
       ABRIR MODAL
       ===================================================== */

    function abrir() {
      abrirModalProduto(
        produto
      );
    }


    card.addEventListener(
      "click",
      abrir
    );


    card.addEventListener(
      "keydown",
      function (evento) {

        if (
          evento.key ===
            "Enter" ||
          evento.key ===
            " "
        ) {

          evento.preventDefault();

          abrir();
        }
      }
    );


    return card;
  }


  /* =======================================================
     RENDERIZAÇÃO DO CATÁLOGO
     ======================================================= */

  function renderizarProdutos() {

    var grid =
      $("grid");


    if (!grid) {
      return;
    }


    grid.textContent =
      "";


    var lista =
      obterProdutosFiltrados();


    /* =====================================================
       NENHUM PRODUTO
       ===================================================== */

    if (
      !lista.length
    ) {

      var vazio =
        criarElemento(
          "div",
          "empty"
        );


      var mensagem =
        produtos.length
          ? "Nenhum produto nesta categoria por enquanto."
          : "Catálogo em montagem.";


      vazio.appendChild(
        document.createTextNode(
          mensagem + " "
        )
      );


      vazio.appendChild(
        document.createElement(
          "br"
        )
      );


      var botao =
        criarElemento(
          "button",
          "btn ghost small",
          "Perguntar no WhatsApp"
        );


      botao.type =
        "button";


      botao.addEventListener(
        "click",
        function () {
          abrirWhatsApp();
        }
      );


      vazio.appendChild(
        botao
      );


      grid.appendChild(
        vazio
      );


      return;
    }


    /* =====================================================
       PRODUTOS
       ===================================================== */

    lista.forEach(
      function (produto) {

        grid.appendChild(
          criarCardProduto(
            produto
          )
        );
      }
    );
  }


  /* =======================================================
     MODAL
     ======================================================= */

  function abrirModalProduto(
    produto
  ) {

    var modal =
      $("modal");


    if (!modal) {
      return;
    }


    /* =====================================================
       IMAGEM
       ===================================================== */

    preencherImagem(
      $("mImg"),
      produto
    );


    /* =====================================================
       INFORMAÇÕES
       ===================================================== */

    var categoria =
      $("mCat");

    if (categoria) {

      categoria.textContent =
        produto.subcategoria ||
        produto.categoria ||
        "Produto";
    }


    var nome =
      $("mNome");

    if (nome) {

      nome.textContent =
        produto.nome ||
        "Produto Luxuriosa";
    }


    preencherPreco(
      $("mPreco"),
      produto
    );


    var descricao =
      $("mDesc");

    if (descricao) {

      descricao.textContent =
        produto.descricao ||
        "";
    }


    var tamanhos =
      $("mSizes");


    if (tamanhos) {

      if (
        produto.tamanhos
      ) {

        tamanhos.textContent =
          "Tamanhos/opções: " +
          produto.tamanhos;

      } else {

        tamanhos.textContent =
          "";
      }
    }


    /* =====================================================
       BOTÃO DO MODAL
       ===================================================== */

    var botao =
      $("mBtn");


    if (botao) {

      botao.textContent =
        produto.esgotado
          ? "Avise-me quando voltar"
          : "Adicionar ao carrinho";


      botao.onclick =
        function () {

          if (
            produto.esgotado
          ) {

            abrirWhatsApp(
              "Olá! Quero ser avisada quando voltar: " +
              produto.nome
            );

            return;
          }


          /*
           * Fecha o modal antes de
           * abrir o carrinho.
           */

          fecharModal();


          adicionarAoCarrinho(
            produto
          );
        };
    }


    /* =====================================================
       ABRE MODAL
       ===================================================== */

    modal.classList.add(
      "open"
    );


    modal.setAttribute(
      "aria-hidden",
      "false"
    );


    document.body.classList.add(
      "modal-open"
    );
  }


  function fecharModal() {

    var modal =
      $("modal");


    if (!modal) {
      return;
    }


    modal.classList.remove(
      "open"
    );


    modal.setAttribute(
      "aria-hidden",
      "true"
    );


    document.body.classList.remove(
      "modal-open"
    );
  }


  /* =======================================================
     LINKS / BOTÕES WHATSAPP
     ======================================================= */

  function configurarWhatsApp() {

    document
      .querySelectorAll(
        "[data-wa]"
      )
      .forEach(
        function (elemento) {

          /*
           * Evita que o mesmo elemento
           * receba o evento duas vezes.
           */

          if (
            elemento.dataset
              .whatsappConfigured ===
            "true"
          ) {
            return;
          }


          elemento.dataset
            .whatsappConfigured =
            "true";


          elemento.addEventListener(
            "click",
            function () {

              abrirWhatsApp(
                elemento.dataset.waMsg
              );
            }
          );
        }
      );
  }


  /* =======================================================
     FILTROS EXTERNOS
     ======================================================= */

  function configurarFiltrosExternos() {

    document
      .querySelectorAll(
        "[data-filtro]"
      )
      .forEach(
        function (botao) {

          /*
           * Evita configuração duplicada.
           */

          if (
            botao.dataset
              .filtroConfigured ===
            "true"
          ) {
            return;
          }


          botao.dataset
            .filtroConfigured =
            "true";


          botao.addEventListener(
            "click",
            function () {

              var filtro =
                botao.getAttribute(
                  "data-filtro"
                );


              if (
                CATEGORIAS.indexOf(
                  filtro
                ) === -1
              ) {
                return;
              }


              filtroAtual =
                filtro;


              renderizarFiltros();

              renderizarProdutos();


              var catalogo =
                $("catalogo");


              if (catalogo) {

                catalogo.scrollIntoView({
                  behavior:
                    "smooth",
                  block:
                    "start"
                });
              }
            }
          );
        }
      );
  }


  /* =======================================================
     EVENTOS DO MODAL
     ======================================================= */

  function configurarModal() {

    var modal =
      $("modal");


    var fechar =
      $("mClose");


    if (fechar) {

      fechar.addEventListener(
        "click",
        fecharModal
      );
    }


    if (modal) {

      modal.addEventListener(
        "click",
        function (evento) {

          if (
            evento.target ===
            modal
          ) {

            fecharModal();
          }
        }
      );
    }


    /*
     * Escape é tratado aqui.
     * O app.js não precisa duplicar
     * essa responsabilidade.
     */

    document.addEventListener(
      "keydown",
      function (evento) {

        if (
          evento.key ===
          "Escape"
        ) {

          fecharModal();
        }
      }
    );
  }


  /* =======================================================
     CARREGAR PRODUTOS
     ======================================================= */

  function carregarCatalogo() {

    /*
     * Caminho relativo ao index.html:
     *
     * index.html
     * └── data/
     *     └── produtos.json
     */

    fetch(
      "data/produtos.json",
      {
        cache:
          "no-cache"
      }
    )

      .then(
        function (resposta) {

          if (
            !resposta.ok
          ) {

            throw new Error(
              "Erro HTTP " +
              resposta.status
            );
          }


          return resposta.json();
        }
      )


      .then(
        function (dados) {

          /*
           * Configuração
           */

          if (
            dados &&
            dados.config &&
            dados.config.whatsapp
          ) {

            config.whatsapp =
              dados.config.whatsapp;
          }


          /*
           * Produtos
           */

          if (
            dados &&
            Array.isArray(
              dados.produtos
            )
          ) {

            produtos =
              dados.produtos;

          } else {

            produtos = [];
          }


          renderizarProdutos();
        }
      )


      .catch(
        function (erro) {

          console.error(
            "Luxuriosa: erro ao carregar catálogo.",
            erro
          );


          var grid =
            $("grid");


          if (!grid) {
            return;
          }


          grid.textContent =
            "";


          var erroBox =
            criarElemento(
              "div",
              "empty"
            );


          erroBox.appendChild(
            document.createTextNode(
              "Não foi possível carregar o catálogo agora. "
            )
          );


          erroBox.appendChild(
            document.createElement(
              "br"
            )
          );


          var botao =
            criarElemento(
              "button",
              "btn ghost small",
              "Chamar no WhatsApp"
            );


          botao.type =
            "button";


          botao.addEventListener(
            "click",
            function () {

              abrirWhatsApp();
            }
          );


          erroBox.appendChild(
            botao
          );


          grid.appendChild(
            erroBox
          );
        }
      );
  }


  /* =======================================================
     EXPÕE FUNÇÕES
     ======================================================= */

  window.LuxuriosaCatalogo = {

    abrirWhatsApp:
      abrirWhatsApp,

    abrirModalProduto:
      abrirModalProduto,

    fecharModal:
      fecharModal,

    renderizarProdutos:
      renderizarProdutos,

    obterProdutos:
      function () {
        return produtos;
      },

    obterConfig:
      function () {
        return config;
      }

  };


  /* =======================================================
     INICIALIZAÇÃO
     ======================================================= */

  function iniciar() {

    renderizarFiltros();

    configurarWhatsApp();

    configurarFiltrosExternos();

    configurarModal();

    carregarCatalogo();
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