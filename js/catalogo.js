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
    "Géis e estimulantes",
    "Vibradores e masturbadores",
    "Jogos e acessórios",
    "Perfumes e higiene",
    "Óleos para massagem",
    "Kits",
    "Ofertas"
  ];

  var GRUPOS_CATEGORIAS = {
    "Óleos para massagem": ["Óleos para massagem"],
    "Géis e estimulantes": [
      "Géis e estimulantes íntimos",
      "Géis e lubrificantes íntimos",
      "Estimulantes",
      "Géis e cremes íntimos"
    ],
    "Vibradores e masturbadores": [
      "Vibradores",
      "Anéis penianos",
      "Plugs anais",
      "Próteses",
      "Masturbadores"
    ],
    "Jogos e acessórios": [
      "Jogos eróticos",
      "Acessórios"
    ],
    "Perfumes e higiene": [
      "Perfumes sensuais",
      "Higiene íntima",
    ]
  };

  function produtoPertenceCategoria(produto, categoria) {
    if (produto.preVenda && config.preVendaVisivel !== true) return false;
    if (categoria === "Todos") return true;
    if (categoria === "Ofertas") {
      return produtoEmOferta(produto) || produto.categoria === "Ofertas";
    }
    var subcategorias = GRUPOS_CATEGORIAS[categoria];
    if (subcategorias) {
      return subcategorias.indexOf(produto.tipoProduto) !== -1 ||
        subcategorias.indexOf(produto.categoria) !== -1;
    }
    return produto.categoria === categoria || produto.tipoProduto === categoria;
  }

  var config = {
    whatsapp: FALLBACK_WHATSAPP,
    preVendaVisivel: false
  };

  var produtos = [];

  var filtroAtual = "Todos";
  var termoPesquisa = "";
  var ordenarAtual = "relevancia";
  var elementoQueAbriuModal = null;


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

    if (window.LuxuriosaMedicao && typeof window.LuxuriosaMedicao.registrar === "function") {
      window.LuxuriosaMedicao.registrar("whatsapp_contact", { method: "whatsapp" });
    }

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


  function mensagemConsulta(produto) {
    if (produto.preVenda) {
      return "Olá! Tenho interesse neste item da pré-venda Luxuriosa: " +
        produto.nome +
        ". Poderiam me informar as condições e a disponibilidade?";
    }

    return "Olá! Tenho interesse em " +
      produto.nome +
      ". Poderiam me informar a composição, o preço e a disponibilidade?";
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
    produto,
    permitirGaleria
  ) {
    if (!container) return;
    container.textContent = "";

    var imagens = [];
    if (Array.isArray(produto.imagens)) {
      imagens = produto.imagens.filter(function (caminho) {
        return typeof caminho === "string" && caminho.trim();
      });
    }
    if (produto.imagem && imagens.indexOf(produto.imagem) === -1) {
      imagens.unshift(produto.imagem);
    }
    if (!imagens.length && produto.imagem) imagens = [produto.imagem];

    if (!imagens.length) {
      container.appendChild(criarElemento("span", "image-fallback", obterSimboloProduto(produto)));
      return;
    }

    var imagemCard = !permitirGaleria &&
      typeof produto.imagemCard === "string" &&
      produto.imagemCard.trim();
    var caminhoPrincipal = imagemCard ? produto.imagemCard : imagens[0];
    var imagemPrincipal = criarElemento("img");
    imagemPrincipal.className = permitirGaleria
      ? "product-detail-main-image"
      : "product-card-main-image";
    imagemPrincipal.src = caminhoPrincipal;
    imagemPrincipal.alt = produto.nome || "Produto Luxuriosa";
    imagemPrincipal.loading = "lazy";
    imagemPrincipal.decoding = "async";

    if (!permitirGaleria) {
      imagemPrincipal.style.width = "100%";
      imagemPrincipal.style.maxWidth = "100%";
      imagemPrincipal.style.height = "100%";
      var produtoEhLingerie = produto.categoria === "Lingerie" ||
        produto.tipoProduto === "Lingerie";
      /*
       * Na vitrine, a imagem deve ocupar todo o quadro do card.
       * O object-fit: cover elimina as faixas vazias; a foto original
       * permanece intacta e pode receber foco personalizado pelo JSON.
       */
      imagemPrincipal.style.objectFit = "cover";
      imagemPrincipal.style.objectPosition =
        produto.imagemCardPosicao || (produtoEhLingerie ? "center center" : "50% 66%");
      container.appendChild(imagemPrincipal);
      imagemPrincipal.onerror = function () {
        this.style.display = "none";
        if (!container.querySelector(".image-fallback")) {
          container.appendChild(criarElemento("span", "image-fallback", obterSimboloProduto(produto)));
        }
      };
      return;
    }

    /*
     * No modal, a imagem principal tem seu próprio quadro.
     * A galeria fica fora dele para não disputar altura com fotos verticais.
     */
    var quadroImagem = criarElemento("div", "product-detail-image-frame");
    quadroImagem.appendChild(imagemPrincipal);
    container.appendChild(quadroImagem);

    imagemPrincipal.onerror = function () {
      this.style.display = "none";
      if (!quadroImagem.querySelector(".image-fallback")) {
        quadroImagem.appendChild(criarElemento("span", "image-fallback", obterSimboloProduto(produto)));
      }
    };

    if (imagens.length < 2) return;

    var miniaturas = criarElemento("div", "product-gallery-thumbnails");
    imagens.forEach(function (caminho, indice) {
      var botaoMiniatura = criarElemento("button", "product-gallery-thumb");
      botaoMiniatura.type = "button";
      botaoMiniatura.setAttribute(
        "aria-label",
        "Ver imagem " + (indice + 1) + " de " + (produto.nome || "produto")
      );
      botaoMiniatura.setAttribute("aria-pressed", indice === 0 ? "true" : "false");

      var miniatura = criarElemento("img");
      miniatura.src = caminho;
      miniatura.alt = "";
      miniatura.loading = "lazy";
      miniatura.decoding = "async";
      botaoMiniatura.appendChild(miniatura);

      miniatura.onerror = function () {
        botaoMiniatura.remove();
      };

      botaoMiniatura.addEventListener("click", function (evento) {
        evento.stopPropagation();
        imagemPrincipal.src = caminho;
        imagemPrincipal.alt = (produto.nome || "Produto Luxuriosa") +
          " — imagem " + (indice + 1);

        Array.prototype.forEach.call(
          miniaturas.querySelectorAll("button"),
          function (outroBotao) {
            outroBotao.setAttribute("aria-pressed", "false");
          }
        );
        botaoMiniatura.setAttribute("aria-pressed", "true");
      });

      miniaturas.appendChild(botaoMiniatura);
    });
    container.appendChild(miniaturas);
  }

  function obterSimboloProduto(
    produto
  ) {
    var categoria = produto.tipoProduto || produto.categoria || "";

    if (categoria === "Kits") {
      return "✦";
    }

    if (categoria === "Lingerie") {
      return "♛";
    }

    if (categoria && categoria !== "Ofertas") {
      return "♡";
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

      var precoAtual = criarElemento(
        "span",
        "price-current",
        formatarPreco(produto.preco)
      );

      container.appendChild(precoAtual);


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


    container.textContent = produto.preVenda
      ? "Disponibilidade sob consulta"
      : "Consulte valores";
  }


  /* =======================================================
     FILTRAGEM
     ======================================================= */

  function normalizarTexto(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim();
  }

  function produtoCombinaPesquisa(produto, termo) {
    if (!termo) return true;
    var campos = [
      produto.nome,
      produto.tipoProduto,
      produto.categoria,
      produto.descricao,
      produto.marca,
      produto.subtitulo,
      Array.isArray(produto.tags) ? produto.tags.join(" ") : ""
    ];
    var texto = normalizarTexto(campos.filter(Boolean).join(" "));
    return termo.split(/\s+/).every(function (palavra) {
      return texto.indexOf(palavra) !== -1;
    });
  }

  function obterProdutosFiltrados() {

    var lista =
      produtos.filter(
        function (produto) {

          return produtoPertenceCategoria(produto, filtroAtual) &&
            produtoCombinaPesquisa(produto, termoPesquisa);
        }
      );


    /*
     * "Mais relevantes" preserva a curadoria atual:
     * destaques primeiro e, depois, a ordem do catálogo.
     * Os modos de preço mantêm a ordem original em caso de empate
     * e deixam itens sem preço ao final.
     */
    var itensOrdenados = lista.map(function (produto, indice) {
      return { produto: produto, indice: indice };
    });

    itensOrdenados.sort(function (a, b) {
      if (ordenarAtual === "menor-preco" || ordenarAtual === "maior-preco") {
        var precoA = typeof a.produto.preco === "number" ? a.produto.preco : null;
        var precoB = typeof b.produto.preco === "number" ? b.produto.preco : null;

        if (precoA === null && precoB !== null) return 1;
        if (precoB === null && precoA !== null) return -1;
        if (precoA !== null && precoB !== null && precoA !== precoB) {
          return ordenarAtual === "menor-preco" ? precoA - precoB : precoB - precoA;
        }
      }

      var destaqueA = a.produto.destaque ? 1 : 0;
      var destaqueB = b.produto.destaque ? 1 : 0;
      return ordenarAtual === "relevancia"
        ? (destaqueB - destaqueA || a.indice - b.indice)
        : a.indice - b.indice;
    });

    return itensOrdenados.map(function (item) {
      return item.produto;
    });
  }


  /* =======================================================
     FILTROS
     ======================================================= */

  function categoriaTemProdutos(categoria) {
    return produtos.some(function (produto) {
      return produtoPertenceCategoria(produto, categoria);
    });
  }

  function obterCategoriasDisponiveis() {
    return CATEGORIAS.filter(function (categoria) {
      return categoria === "Todos" || categoriaTemProdutos(categoria);
    });
  }

  function atualizarCategoriasVisiveis() {
    document.querySelectorAll(".categories [data-filtro]").forEach(function (botao) {
      var categoria = botao.getAttribute("data-filtro");
      botao.style.display = categoriaTemProdutos(categoria) ? "" : "none";
    });
  }

  function renderizarFiltros() {

    var container =
      $("chips");


    if (!container) {
      return;
    }


    container.textContent =
      "";


    obterCategoriasDisponiveis().forEach(
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
        botao.setAttribute("data-categoria", categoria);
        botao.setAttribute("aria-pressed", categoria === filtroAtual ? "true" : "false");
        botao.setAttribute("aria-controls", "grid");


        botao.addEventListener(
          "click",
          function () {

            filtroAtual =
              categoria;


            renderizarFiltros();

            renderizarProdutos();

            var opcoesFiltros = $("chips");
            var botaoFiltros = $("toggleCatalogFilters");
            var recolheuFiltrosMobile = false;
            if (opcoesFiltros && botaoFiltros && window.matchMedia && window.matchMedia("(max-width: 600px)").matches) {
              opcoesFiltros.classList.remove("is-open");
              botaoFiltros.setAttribute("aria-expanded", "false");
              var textoBotao = botaoFiltros.querySelector(".catalog-filter-toggle-text");
              if (textoBotao) textoBotao.textContent = "Filtrar categorias";
              var marcaBotao = botaoFiltros.querySelector(".catalog-filter-toggle-mark");
              if (marcaBotao) marcaBotao.textContent = "+";
              botaoFiltros.focus();
              recolheuFiltrosMobile = true;
            }

            /* Recriar os filtros não deve perder o foco do teclado. */
            var filtrosAtualizados = $("chips");
            if (!recolheuFiltrosMobile && filtrosAtualizados) {
              var botoes = filtrosAtualizados.querySelectorAll("button[data-categoria]");
              for (var i = 0; i < botoes.length; i++) {
                if (botoes[i].getAttribute("data-categoria") === categoria) {
                  botoes[i].focus();
                  break;
                }
              }
            }
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

      if (produto.preVenda) {
        badges.appendChild(
          criarElemento(
            "span",
            "badge",
            "Pré-venda"
          )
        );
      } else if (produto.novo) {
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
          ) +
          (produto.preVenda ? " product-pre-venda" : "")
      );


    card.tabIndex =
      0;


    /* O card abre o modal, mas links e botões internos continuam independentes. */


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

    if (produto.pagina) {
      var linkDetalhes = criarElemento("a", "btn ghost small product-detail-link", "Mais detalhes");
      linkDetalhes.href = produto.pagina;
      linkDetalhes.setAttribute("aria-label", "Ver detalhes de " + (produto.nome || "produto"));
      linkDetalhes.addEventListener("click", function (evento) {
        evento.stopPropagation();
      });
      corpo.appendChild(linkDetalhes);
    }


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


    /* A linha de compra mantém preço e ação visualmente juntos. */
    var linhaCompra = criarElemento("div", "product-purchase-row");
    linhaCompra.appendChild(preco);


    /* =====================================================
       BOTÃO
       ===================================================== */

    var textoBotao =
      produto.esgotado
        ? "Avise-me quando voltar"
        : produto.preVenda
          ? "Consultar disponibilidade"
          : produto.sobConsulta
            ? "Consultar no WhatsApp"
            : "Adicionar ao carrinho";


    var botao = criarElemento(
      "button",
      "btn ghost small" + (!produto.esgotado && !produto.sobConsulta ? " product-cart-button" : ""),
      !produto.esgotado && !produto.sobConsulta ? "" : textoBotao
    );

    botao.type = "button";

    /* Ícone compacto para adicionar ao carrinho; outros estados mantêm texto. */
    if (!produto.esgotado && !produto.sobConsulta) {
      var iconeCarrinho = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      iconeCarrinho.setAttribute("viewBox", "0 0 24 24");
      iconeCarrinho.setAttribute("width", "22");
      iconeCarrinho.setAttribute("height", "22");
      iconeCarrinho.setAttribute("aria-hidden", "true");
      iconeCarrinho.setAttribute("focusable", "false");
      iconeCarrinho.setAttribute("fill", "none");
      iconeCarrinho.setAttribute("stroke", "currentColor");
      iconeCarrinho.setAttribute("stroke-width", "1.7");
      iconeCarrinho.setAttribute("stroke-linecap", "round");
      iconeCarrinho.setAttribute("stroke-linejoin", "round");

      [
        { tag: "circle", attrs: { cx: "9", cy: "21", r: "1" } },
        { tag: "circle", attrs: { cx: "20", cy: "21", r: "1" } },
        { tag: "path", attrs: { d: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" } }
      ].forEach(function (item) {
        var forma = document.createElementNS("http://www.w3.org/2000/svg", item.tag);
        Object.keys(item.attrs).forEach(function (chave) {
          forma.setAttribute(chave, item.attrs[chave]);
        });
        iconeCarrinho.appendChild(forma);
      });

      botao.appendChild(iconeCarrinho);
    }


    botao.setAttribute(
      "aria-label",
      produto.esgotado
        ? "Avise-me quando voltar: " + produto.nome
        : produto.preVenda
          ? "Consultar disponibilidade de " + produto.nome
          : produto.sobConsulta
            ? "Consultar no WhatsApp sobre " + produto.nome
            : "Adicionar " + produto.nome + " ao carrinho"
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


        if (produto.sobConsulta || produto.preVenda) {
          abrirWhatsApp(mensagemConsulta(produto));
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


    linhaCompra.appendChild(botao);
    corpo.appendChild(linhaCompra);


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
      elementoQueAbriuModal = card;
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

        if (evento.target !== card) {
          return;
        }

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

  function renderizarColecao(idGrid, propriedade) {

    var grid = $(idGrid);

    if (!grid) {
      return;
    }

    grid.textContent = "";

    var lista = produtos.filter(function (produto) {
      return produto[propriedade] === true;
    });

    if (!lista.length) {
      var mensagemVazia = propriedade === "preVenda"
        ? "Estamos preparando novidades especiais para a pré-venda."
        : propriedade === "destaque"
          ? "Estamos preparando nossa seleção especial."
          : "Nossa seleção de mais vendidos será atualizada em breve.";
      var vazio = criarElemento("div", "empty", mensagemVazia);

      grid.appendChild(vazio);
      return;
    }

    lista.forEach(function (produto) {
      grid.appendChild(criarCardProduto(produto));
    });
  }

  function renderizarColecaoPorIds(idGrid, ids) {
    var grid = $(idGrid);

    if (!grid) {
      return;
    }

    grid.textContent = "";

    var lista = (Array.isArray(ids) ? ids : []).map(function (id) {
      return produtos.find(function (produto) {
        return String(produto.id) === String(id);
      });
    }).filter(Boolean);

    if (!lista.length) {
      grid.appendChild(criarElemento("div", "empty", "Estamos preparando nossa seleção de kits especiais."));
      return;
    }

    lista.forEach(function (produto) {
      grid.appendChild(criarCardProduto(produto));
    });
  }

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

    var statusCatalogo = $("catalogoStatus");
    if (statusCatalogo) {
      statusCatalogo.textContent = lista.length
        ? lista.length + (lista.length === 1 ? " produto encontrado." : " produtos encontrados.") +
          (termoPesquisa ? " Pesquisa: " + termoPesquisa + "." : "")
        : (termoPesquisa
          ? "Nenhum produto encontrado para \"" + termoPesquisa + "\"."
          : "Nenhum produto encontrado.");
    }
    atualizarControlesPesquisa();


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


      var mensagem = termoPesquisa
        ? "Tente outro termo ou limpe a pesquisa para ver todos os produtos."
        : produtos.length
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

    if (window.LuxuriosaInteligencia && typeof window.LuxuriosaInteligencia.registrarEvento === "function") {
      window.LuxuriosaInteligencia.registrarEvento("product_view", { product_id: produto.id });
    }

    /* =====================================================
       IMAGEM
       ===================================================== */

    preencherImagem(
      $("mImg"),
      produto,
      true
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

      descricao.textContent = "";
      descricao.style.whiteSpace = "normal";

      // Renderiza **negrito** e quebras de linha sem interpretar HTML.
      // Limita sequências de linhas vazias a um único espaço entre parágrafos.
      String(produto.descricao || "").replace(/\n{3,}/g, "\n\n").split("\n").forEach(function (linha, indiceLinha) {
        if (indiceLinha > 0) {
          descricao.appendChild(document.createElement("br"));
        }

        if (linha === "") return;

        linha.split("**").forEach(function (parte, indiceParte) {
          if (!parte) return;
          if (indiceParte % 2 === 1) {
            var forte = document.createElement("strong");
            forte.textContent = parte;
            descricao.appendChild(forte);
          } else {
            descricao.appendChild(document.createTextNode(parte));
          }
        });
      });
    }


    var tamanhos =
      $("mSizes");


    if (tamanhos) {
      tamanhos.hidden = produto.preVenda === true;

      if (produto.preVenda) {
        tamanhos.textContent = "";
        tamanhos.style.whiteSpace = "";
        tamanhos.style.textAlign = "";
      } else if (Array.isArray(produto.itens) && produto.itens.length) {

        tamanhos.textContent =
          "Itens incluídos:\n" +
          produto.itens.map(function (item) {
            return "• " + item;
          }).join("\n");

        tamanhos.style.whiteSpace = "pre-line";
        tamanhos.style.textAlign = "left";

      } else if (produto.tamanhos) {

        tamanhos.textContent =
          "Tamanhos/opções: " +
          produto.tamanhos;

        tamanhos.style.whiteSpace = "";
        tamanhos.style.textAlign = "";

      } else {

        tamanhos.textContent = "";
        tamanhos.style.whiteSpace = "";
        tamanhos.style.textAlign = "";
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
          : produto.preVenda
            ? "Consultar disponibilidade"
            : produto.sobConsulta
              ? "Consultar no WhatsApp"
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

          if (produto.sobConsulta || produto.preVenda) {
            fecharModal();
            abrirWhatsApp(mensagemConsulta(produto));
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

    /* Leva o teclado para dentro do modal ao abrir. */
    var botaoFechar = $("mClose");
    if (botaoFechar) {
      botaoFechar.focus();
    }
  }


  function fecharModal() {

    var modal =
      $("modal");


    if (!modal) {
      return;
    }


    var estavaAberto = modal.classList.contains("open");

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

    /* Devolve a navegação ao produto que abriu o modal. */
    if (estavaAberto && elementoQueAbriuModal && document.contains(elementoQueAbriuModal)) {
      elementoQueAbriuModal.focus();
    }
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
                obterCategoriasDisponiveis().indexOf(
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
            "Escape" &&
          $("modal") &&
          $("modal").classList.contains("open")
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
          if (!dados || !Array.isArray(dados.produtos) || dados.produtos.length === 0) {
            throw new Error("O arquivo do catálogo não contém uma lista válida de produtos.");
          }

          /*
           * Configuração
           */

          if (dados && dados.config) {
            if (dados.config.whatsapp) {
              config.whatsapp = dados.config.whatsapp;
            }
            config.preVendaVisivel = dados.config.preVendaVisivel === true;
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
              dados.produtos.filter(function (produto) {
                return !produto.preVenda || config.preVendaVisivel === true;
              });

          } else {

            produtos = [];
          }


          /* Permite abrir a loja já com uma categoria ou busca selecionada. */
          var parametrosLoja = new URLSearchParams(window.location.search);
          var caminhoLoja = window.location.pathname.replace(/\/+$/, "") || "/";
          var categoriasPorRota = {
            "/loja/lingerie": "Lingerie"
          };
          var categoriaSolicitada = parametrosLoja.get("categoria") ||
            categoriasPorRota[caminhoLoja];
          if (categoriaSolicitada && CATEGORIAS.indexOf(categoriaSolicitada) !== -1 &&
              categoriaTemProdutos(categoriaSolicitada)) {
            filtroAtual = categoriaSolicitada;
          }

          var buscaSolicitada = parametrosLoja.get("q");
          if (buscaSolicitada) {
            termoPesquisa = normalizarTexto(buscaSolicitada);
            var campoPesquisa = $("catalogSearch");
            if (campoPesquisa) campoPesquisa.value = buscaSolicitada;
          }

          if (window.LuxuriosaCarrinho && typeof window.LuxuriosaCarrinho.sincronizarCatalogo === "function") {
            window.LuxuriosaCarrinho.sincronizarCatalogo(produtos);
          }

          atualizarCategoriasVisiveis();
          renderizarFiltros();
          renderizarProdutos();
          renderizarColecaoPorIds("destaques-grid", [25, 26, 24, 27]);
          renderizarColecao("mais-vendidos-grid", "maisVendido");
          var secaoPreVenda = $("pre-venda");
          if (config.preVendaVisivel === true) {
            renderizarColecao("pre-venda-grid", "preVenda");
          } else {
            var gradePreVenda = $("pre-venda-grid");
            if (gradePreVenda) gradePreVenda.textContent = "";
          }
          if (secaoPreVenda) {
            secaoPreVenda.hidden = config.preVendaVisivel !== true ||
              !produtos.some(function (produto) { return produto.preVenda === true; });
          }
        }
      )


      .catch(
        function (erro) {

          console.error(
            "Luxuriosa: erro ao carregar catálogo.",
            erro
          );

          /* Sem catálogo confirmado, não permitimos finalizar com preços antigos. */
          if (window.LuxuriosaCarrinho && typeof window.LuxuriosaCarrinho.sincronizarCatalogo === "function") {
            window.LuxuriosaCarrinho.sincronizarCatalogo([]);
          }

          var grid =
            $("grid");

          ["destaques-grid", "mais-vendidos-grid"].forEach(function (id) {
            var colecao = $(id);
            if (colecao) {
              colecao.textContent = "";
              colecao.appendChild(criarElemento("div", "empty", "Não foi possível carregar esta seleção."));
            }
          });

          if (!grid) {
            return;
          }

          grid.textContent = "";

          var erroBox =
            criarElemento(
              "div",
              "empty"
            );


          erroBox.appendChild(
            document.createTextNode(
              "Não foi possível carregar o catálogo agora. Tente novamente ou fale com a Luxuriosa. "
            )
          );

          erroBox.appendChild(document.createElement("br"));

          var tentarNovamente = criarElemento("button", "btn ghost small", "Tentar novamente");
          tentarNovamente.type = "button";
          tentarNovamente.addEventListener("click", function () {
            tentarNovamente.disabled = true;
            tentarNovamente.textContent = "Carregando…";
            carregarCatalogo();
          });
          erroBox.appendChild(tentarNovamente);

          var botao = criarElemento("button", "btn ghost small", "Chamar no WhatsApp");
          botao.type = "button";
          botao.style.marginLeft = "8px";
          botao.addEventListener("click", function () {
            abrirWhatsApp();
          });
          erroBox.appendChild(botao);


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

  function configurarPesquisaCatalogo() {
    var campo = $("catalogSearch");
    var formulario = $("catalogSearchForm");
    var limpar = $("clearCatalogSearch");
    if (!campo || !formulario || !limpar) return;

    campo.addEventListener("input", function () {
      termoPesquisa = normalizarTexto(campo.value);
      renderizarProdutos();
    });

    formulario.addEventListener("submit", function (evento) {
      evento.preventDefault();
      termoPesquisa = normalizarTexto(campo.value);
      renderizarProdutos();
      var catalogo = $("catalogo");
      if (catalogo) catalogo.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    limpar.addEventListener("click", function () {
      campo.value = "";
      termoPesquisa = "";
      renderizarProdutos();
      campo.focus();
    });
  }

  function atualizarControlesPesquisa() {
    var campo = $("catalogSearch");
    var limpar = $("clearCatalogSearch");
    if (campo && limpar) {
      limpar.hidden = !campo.value;
    }
  }

  function configurarOrdenacaoCatalogo() {
    var seletor = $("catalogSort");
    if (!seletor) return;

    seletor.value = ordenarAtual;
    seletor.addEventListener("change", function () {
      ordenarAtual = seletor.value;
      renderizarProdutos();
    });
  }

  function configurarToggleFiltros() {
    var botao = $("toggleCatalogFilters");
    var opcoes = $("chips");
    if (!botao || !opcoes) return;

    botao.addEventListener("click", function () {
      var aberto = opcoes.classList.toggle("is-open");
      botao.setAttribute("aria-expanded", aberto ? "true" : "false");
      var texto = botao.querySelector(".catalog-filter-toggle-text");
      var marca = botao.querySelector(".catalog-filter-toggle-mark");
      if (texto) texto.textContent = aberto ? "Fechar categorias" : "Filtrar categorias";
      if (marca) marca.textContent = aberto ? "−" : "+";
    });
  }

  function iniciar() {

    configurarPesquisaCatalogo();
    configurarOrdenacaoCatalogo();
    configurarToggleFiltros();
    renderizarFiltros();

    configurarWhatsApp();

    configurarFiltrosExternos();

    configurarModal();

    /*
     * A página inicial e as páginas institucionais não possuem a grade
     * dinâmica do catálogo. Nelas, baixar todos os produtos é desnecessário.
     * A loja mantém o carregamento normal porque possui o elemento #grid.
     */
    if ($("grid")) {
      carregarCatalogo();
    }
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