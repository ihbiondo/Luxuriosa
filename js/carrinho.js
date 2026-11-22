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
  var VARIABLE_DICE_KIT_IDS = new Set(["22","23","24","27","28","29"]);
  var DICE_VARIANTS = {
    "2": { id: "2", name: "Hétero" },
    "1": { id: "1", name: "Gay" },
    "3": { id: "3", name: "Lésbico" }
  };
  var DICE_CHOICE_IDS = { "1": "2", "2": "1", "3": "3" };

  /* Tarifas públicas de entrega em Bauru e região, em centavos. */
  var DELIVERY_RATES = {
    bauru: { label: "Bauru (exceto Tibiriçá)", standard: 1500, member: 1000, minimum: 2000 },
    tibirica: { label: "Tibiriçá", standard: 2000, member: 1500, minimum: 5000 },
    agudos: { label: "Agudos", standard: 2500, member: 2000, minimum: 5000 },
    piratininga: { label: "Piratininga", standard: 2500, member: 2000, minimum: 5000 },
    pederneiras: { label: "Pederneiras", standard: 2500, member: 2000, minimum: 5000 },
    lencois: { label: "Lençóis Paulista", standard: 5000, member: 4000, minimum: 5000 },
    borebi: { label: "Borebi", standard: 5000, member: 4000, minimum: 5000 }
  };

  var carrinho = [];
  var catalogoSincronizado = false;
  var catalogoAtual = [];
  var membroClubeAtivo = false;
  var focoAnteriorCarrinho = null;


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


  function precoDoCliente(produto) {
    if (window.LuxuriosaClubePrecos &&
        typeof window.LuxuriosaClubePrecos.precoParaCliente === "function") {
      return window.LuxuriosaClubePrecos.precoParaCliente(produto);
    }
    var precoClube = Number(produto && produto.preco);
    var precoRegular = Number(produto && produto.precoAntigo);
    var temPromocaoClube = Number.isFinite(precoRegular) &&
      Number.isFinite(precoClube) && precoRegular > precoClube;
    return temPromocaoClube && !membroClubeAtivo ? precoRegular : precoClube;
  }

  function atualizarControlesClube() {
    var controle = $("cartClubMember");
    var texto = document.querySelector(".cart-club-row span");
    if (controle) {
      controle.checked = membroClubeVerificado && membroClubeAtivo;
      controle.disabled = true;
      controle.setAttribute("aria-disabled", "true");
    }
    if (texto) {
      texto.textContent = !membroClubeVerificado
        ? "Verificando sua participação no Clube…"
        : membroClubeAtivo
          ? "Tarifa especial do Clube aplicada automaticamente"
          : "Entre no Clube gratuitamente para acessar a tarifa especial";
    }
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
      if (window.LuxuriosaInteligencia && typeof window.LuxuriosaInteligencia.registrarCarrinho === "function") {
        window.LuxuriosaInteligencia.registrarCarrinho(carrinho);
      }

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
      (typeof item.id !== "string" && typeof item.id !== "number") ||
      String(item.id).trim() === ""
    ) {
      return null;
    }

    var idNormalizado = String(item.id).trim();
    var precoNormalizado = Number(item.preco);
    if (!Number.isFinite(precoNormalizado) || precoNormalizado <= 0) {
      precoNormalizado = 0;
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

      id: idNormalizado,

      nome:
        String(
          item.nome ||
          "Produto Luxuriosa"
        ),

      preco:
        precoNormalizado,

      precoClube:
        Number.isFinite(Number(item.precoClube)) && Number(item.precoClube) > 0
          ? Number(item.precoClube)
          : null,

      precoRegular:
        Number.isFinite(Number(item.precoRegular)) && Number(item.precoRegular) > 0
          ? Number(item.precoRegular)
          : null,

      promocaoClube:
        item.promocaoClube === true,

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
        quantidade,

      kit_variant_id:
        VARIABLE_DICE_KIT_IDS.has(idNormalizado) && DICE_VARIANTS[String(item.kit_variant_id)]
          ? String(item.kit_variant_id)
          : null,

      kit_variant_name:
        VARIABLE_DICE_KIT_IDS.has(idNormalizado) && DICE_VARIANTS[String(item.kit_variant_id)]
          ? DICE_VARIANTS[String(item.kit_variant_id)].name
          : "",

      indisponivel:
        Boolean(item.indisponivel) ||
        (VARIABLE_DICE_KIT_IDS.has(idNormalizado) && !DICE_VARIANTS[String(item.kit_variant_id)]),

      motivoIndisponibilidade:
        String(item.motivoIndisponibilidade || (
          VARIABLE_DICE_KIT_IDS.has(idNormalizado) && !DICE_VARIANTS[String(item.kit_variant_id)]
            ? "Escolha novamente o Dado do Prazer incluído neste kit antes de finalizar."
            : ""
        )),

      avisoPrecoAlterado:
        Boolean(item.avisoPrecoAlterado),

      precoAnteriorCatalogo:
        Number.isFinite(Number(item.precoAnteriorCatalogo)) &&
        Number(item.precoAnteriorCatalogo) > 0
          ? Number(item.precoAnteriorCatalogo)
          : null

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


      var itensNormalizados = convertido
        .map(normalizarItem)
        .filter(function (item) {
          return item !== null;
        });

      /* Consolida IDs repetidos em carrinhos antigos e limita a quantidade total por produto. */
      carrinho = [];
      itensNormalizados.forEach(function (item) {
        var existente = carrinho.find(function (atual) {
          return atual.id === item.id;
        });
        if (!existente) {
          carrinho.push(item);
          return;
        }

        existente.quantidade = Math.min(
          existente.quantidade + item.quantidade,
          MAX_QUANTIDADE
        );
        if (item.indisponivel) {
          existente.indisponivel = true;
          existente.motivoIndisponibilidade = item.motivoIndisponibilidade ||
            existente.motivoIndisponibilidade;
        }
      });

      salvar();

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
      produto.esgotado ||
      produto.sobConsulta
    ) {
      return;
    }

    var precoOriginal = precoDoCliente(produto);
    var precoProduto = Number(precoOriginal);
    if (
      precoOriginal === null ||
      precoOriginal === undefined ||
      precoOriginal === "" ||
      !Number.isFinite(precoProduto) ||
      precoProduto <= 0
    ) {
      window.alert("Não foi possível confirmar o preço deste produto. Atualize a página ou consulte o atendimento antes de adicioná-lo ao carrinho.");
      return;
    }


    var idOriginal = produto.id;
    if (
      (typeof idOriginal !== "string" && typeof idOriginal !== "number") ||
      String(idOriginal).trim() === "" ||
      (typeof idOriginal === "number" && !Number.isFinite(idOriginal))
    ) {
      window.alert("Não foi possível identificar este produto com segurança. Atualize a página e tente novamente.");
      return;
    }

    /* Mantém os IDs consistentes entre catálogo, carrinho e armazenamento local. */
    var id = String(idOriginal).trim();
    var kitVariantId = null;
    var kitVariantName = "";

    if (VARIABLE_DICE_KIT_IDS.has(id)) {
      var choice = window.prompt(
        "Escolha o Dado do Prazer incluído neste kit:\n1 — Hétero\n2 — Gay\n3 — Lésbico\n\nO dado é gratuito e acompanha o kit.",
        "1"
      );
      if (choice === null) return;
      var variantId = DICE_CHOICE_IDS[String(choice).trim()];
      var variant = DICE_VARIANTS[variantId];
      if (!variant) {
        window.alert("Escolha inválida. Informe 1, 2 ou 3.");
        return;
      }
      kitVariantId = variant.id;
      kitVariantName = variant.name;
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

          return String(item.id) === String(id);

        }
      );


    if (existente) {
      if (VARIABLE_DICE_KIT_IDS.has(id) && String(existente.kit_variant_id || "") !== kitVariantId) {
        window.alert("Este kit já está no carrinho com o Dado do Prazer — " +
          (existente.kit_variant_name || "ainda não escolhido") +
          ". Remova o kit antes de escolher outra variante.");
        return;
      }

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
          Number(precoProduto) || 0,

        precoClube:
          Number(produto.preco) || null,

        precoRegular:
          Number(produto.precoAntigo) || null,

        promocaoClube:
          Number.isFinite(Number(produto.precoAntigo)) &&
          Number(produto.precoAntigo) > Number(produto.preco),

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
          quantidade,

        kit_variant_id:
          kitVariantId,

        kit_variant_name:
          kitVariantName

      });

    }


    salvar();

    renderizar();

    if (window.LuxuriosaMedicao && typeof window.LuxuriosaMedicao.registrar === "function") {
      window.LuxuriosaMedicao.registrar("add_to_cart", { quantity: quantidade });
    }
    if (window.LuxuriosaInteligencia && typeof window.LuxuriosaInteligencia.registrarEvento === "function") {
      window.LuxuriosaInteligencia.registrarEvento("add_to_cart", { product_id: id, quantity: quantidade });
    }

    abrirCarrinho();

  }


  function focarAposRemocao(indiceAnterior) {
    var botoesRemover = $("cartItems")
      ? $("cartItems").querySelectorAll(".cart-remove")
      : [];

    if (botoesRemover.length) {
      botoesRemover[Math.min(indiceAnterior, botoesRemover.length - 1)].focus();
      return;
    }

    var tituloVazio = $("cartEmpty") ? $("cartEmpty").querySelector("h3") : null;
    if (tituloVazio) tituloVazio.focus();
  }


  function remover(
    id
  ) {

    var indiceAnterior = carrinho.findIndex(function (item) {
      return String(item.id) === String(id);
    });

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
    focarAposRemocao(Math.max(0, indiceAnterior));

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


    var quantidadeAnterior = item.quantidade;
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

    /* A lista é reconstruída a cada alteração; devolve o foco ao controle
       equivalente para que a navegação por teclado não se perca. */
    var linhaAtualizada = $("cartItems")
      ? $("cartItems").querySelector('[data-product-id="' + String(id).replace(/"/g, '\\"') + '"]')
      : null;
    if (linhaAtualizada) {
      var botoesQuantidade = linhaAtualizada.querySelectorAll(".cart-qty-btn");
      var diminuirAtual = botoesQuantidade[0];
      var aumentarAtual = botoesQuantidade[1];
      var controlePreferido = item.quantidade > quantidadeAnterior
        ? aumentarAtual
        : diminuirAtual;
      var controleAlternativo = item.quantidade > quantidadeAnterior
        ? diminuirAtual
        : aumentarAtual;
      if (controlePreferido && !controlePreferido.disabled) {
        controlePreferido.focus();
      } else if (controleAlternativo && !controleAlternativo.disabled) {
        controleAlternativo.focus();
      }
    }

  }


  function limpar() {

    carrinho = [];

    salvar();

    renderizar();

    var tituloVazio = $("cartEmpty") ? $("cartEmpty").querySelector("h3") : null;
    if (tituloVazio) tituloVazio.focus();

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

        if (item.promocaoClube && Number(item.precoClube) > 0) {
          var avisoPrecoClube = criarElemento(
            "a",
            "cart-item-club-promo",
            membroClubeAtivo
              ? "🏷️ Preço exclusivo para membros do Clube"
              : "🏷️ Cadastre-se grátis no Clube e aproveite " + formatarPreco(item.precoClube)
          );
          avisoPrecoClube.href = "/clube/";
          avisoPrecoClube.style.display = "block";
          avisoPrecoClube.style.marginTop = "4px";
          avisoPrecoClube.style.color = "#D4AF7C";
          avisoPrecoClube.style.fontSize = "11px";
          avisoPrecoClube.style.fontWeight = "600";
          avisoPrecoClube.style.lineHeight = "1.4";
          info.appendChild(avisoPrecoClube);
        }

        if (item.kit_variant_name) {
          info.appendChild(
            criarElemento(
              "span",
              "cart-item-category",
              "Dado incluído: " + item.kit_variant_name
            )
          );
        }

        if (item.avisoPrecoAlterado && Number(item.precoAnteriorCatalogo) > 0) {
          info.appendChild(
            criarElemento(
              "span",
              "cart-item-price-changed",
              "Preço atualizado de " + formatarPreco(item.precoAnteriorCatalogo) +
                " para " + formatarPreco(item.preco) + "."
            )
          );
        }

        if (item.indisponivel) {
          info.appendChild(
            criarElemento(
              "span",
              "cart-item-unavailable",
              item.motivoIndisponibilidade || "Confirme a disponibilidade com o atendimento."
            )
          );
        }


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
        quantidade.setAttribute("aria-live", "polite");
        quantidade.setAttribute("aria-atomic", "true");


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

    var finalizar = $("cartCheckout");
    var resumoRecebimento = atualizarResumoRecebimento();

    if (finalizar) {
      finalizar.disabled = carrinho.length === 0 || !resumoRecebimento.valid;
      finalizar.setAttribute("aria-disabled", finalizar.disabled ? "true" : "false");
      finalizar.title = finalizar.disabled
        ? "Adicione produtos e escolha a forma de recebimento para continuar."
        : "Enviar o resumo do carrinho, frete e total estimado pelo WhatsApp.";
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


    if (!elemento.classList.contains("open")) {
      focoAnteriorCarrinho = document.activeElement;
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

    if (focoAnteriorCarrinho && typeof focoAnteriorCarrinho.focus === "function") {
      focoAnteriorCarrinho.focus();
    }
    focoAnteriorCarrinho = null;

  }


  /* =======================================================
     WHATSAPP / PEDIDO
     ======================================================= */

  function obterResumoRecebimento() {
    var metodo = $("cartFulfillmentMethod") ? $("cartFulfillmentMethod").value : "";
    var subtotal = valorTotal();

    if (metodo === "pickup") {
      return {
        valid: true, method: "pickup", city: "", cityLabel: "",
        clubMember: false, freight: 0, total: subtotal,
        minimum: 0, minimumMet: true
      };
    }

    if (metodo !== "delivery") {
      return { valid: false, method: "", freight: null, total: null };
    }

    var cidade = $("cartDeliveryCity") ? $("cartDeliveryCity").value : "";
    if (!cidade) {
      return { valid: false, method: "delivery", city: "", freight: null, total: null };
    }

    var membroClube = membroClubeVerificado && membroClubeAtivo;
    if (cidade === "other") {
      return {
        valid: true, method: "delivery", city: "other",
        cityLabel: "Outra localidade", clubMember: membroClube,
        freight: null, total: null, minimum: null, minimumMet: null
      };
    }

    var tarifa = DELIVERY_RATES[cidade];
    if (!tarifa) {
      return { valid: false, method: "delivery", city: cidade, freight: null, total: null };
    }

    var freteCentavos = membroClube ? tarifa.member : tarifa.standard;
    var minimo = tarifa.minimum;

    return {
      valid: true,
      method: "delivery",
      city: cidade,
      cityLabel: tarifa.label,
      clubMember: membroClube,
      freight: freteCentavos / 100,
      total: subtotal + (freteCentavos / 100),
      minimum: minimo / 100,
      minimumMet: Math.round(subtotal * 100) >= minimo,
      tollIncluded: cidade === "lencois" || cidade === "borebi"
    };
  }

  function atualizarResumoRecebimento() {
    var metodo = $("cartFulfillmentMethod") ? $("cartFulfillmentMethod").value : "";
    var camposEntrega = $("cartDeliveryFields");
    var valorFrete = $("cartFreightValue");
    var valorTotalGeral = $("cartGrandTotal");
    var nota = $("cartFulfillmentNote");
    var resumo = obterResumoRecebimento();

    if (camposEntrega) camposEntrega.hidden = metodo !== "delivery";
    if (valorFrete) valorFrete.textContent = "—";
    if (valorTotalGeral) valorTotalGeral.textContent = "—";
    if (!nota) return resumo;

    if (metodo === "pickup") {
      if (valorFrete) valorFrete.textContent = formatarPreco(0);
      if (valorTotalGeral) valorTotalGeral.textContent = formatarPreco(valorTotal());
      nota.textContent = "📍 Retirada gratuita em Bauru, mediante agendamento. Local e horário combinados pelo WhatsApp.";
      return resumo;
    }

    if (metodo !== "delivery") {
      nota.textContent = "Escolha entrega ou retirada para calcular o valor final estimado.";
      return resumo;
    }

    if (!resumo.city) {
      nota.textContent = "Selecione a cidade ou região para calcular o frete.";
      return resumo;
    }

    if (resumo.freight === null) {
      if (valorFrete) valorFrete.textContent = "A confirmar";
      if (valorTotalGeral) valorTotalGeral.textContent = "A confirmar";
      nota.textContent = "📍 Informe sua cidade e CEP no WhatsApp. A equipe confirmará a disponibilidade e o valor da entrega.";
      return resumo;
    }

    if (valorFrete) valorFrete.textContent = formatarPreco(resumo.freight);
    if (valorTotalGeral) valorTotalGeral.textContent = formatarPreco(resumo.total);

    var notas = [];
    if (resumo.clubMember) {
      notas.push("🏷️ Tarifa de membro do Clube selecionada; o cadastro ativo será conferido pela equipe.");
    }
    if (resumo.minimumMet === false) {
      notas.push("⚠️ Pedido mínimo nesta localidade: " + formatarPreco(resumo.minimum) + " em produtos.");
    } else {
      notas.push("Pedido mínimo: " + formatarPreco(resumo.minimum) + " em produtos.");
    }
    if (resumo.tollIncluded) notas.push("🛣️ Pedágio já incluído no valor do frete.");
    nota.textContent = notas.join(" ");
    return resumo;
  }

  function montarMensagemPedido(resumo) {
    var linhas = [
      "Olá! Quero concluir meu pedido na *Luxuriosa*. 💗",
      "",
      "🛍️ *RESUMO DO CARRINHO*"
    ];

    carrinho.forEach(function (item) {
      var variacaoKit = item.kit_variant_name ? " (Dado: " + item.kit_variant_name + ")" : "";
      var observacao = item.indisponivel ? " — *consultar disponibilidade*" : "";
      linhas.push(
        "• " + item.nome + variacaoKit + " — " + item.quantidade + "x — " +
        formatarPreco(item.preco * item.quantidade) + observacao
      );
    });

    linhas.push("", "💰 *RESUMO DOS VALORES*", "• Subtotal estimado dos produtos: " + formatarPreco(valorTotal()));

    if (resumo.method === "pickup") {
      linhas.push(
        "• Frete para retirada: " + formatarPreco(0),
        "• *Total estimado: " + formatarPreco(valorTotal()) + "*",
        "",
        "📍 *RETIRADA AGENDADA EM BAURU*",
        "• Sem cobrança de frete. Local e horário serão combinados com a equipe pelo WhatsApp."
      );
    } else {
      linhas.push("🚚 *ENTREGA*", "• Localidade: " + (resumo.cityLabel || "A confirmar"));

      if (resumo.freight === null) {
        linhas.push(
          "• Frete: *a confirmar com a equipe*",
          "• Total geral: *será informado após consulta da localidade*",
          "• Informe sua cidade e CEP para verificarmos o atendimento."
        );
      } else {
        linhas.push(
          "• Frete: " + formatarPreco(resumo.freight),
          "• *Total estimado: " + formatarPreco(resumo.total) + "*"
        );
      }

      if (resumo.clubMember) {
        linhas.push("🏷️ Tarifa de membro do Clube solicitada (cadastro ativo sujeito à conferência).");
      }
      if (resumo.minimumMet === false) {
        linhas.push("⚠️ Pedido mínimo para esta localidade: " + formatarPreco(resumo.minimum) + " em produtos. O subtotal atual está abaixo desse valor.");
      } else if (resumo.minimum) {
        linhas.push("• Pedido mínimo nesta localidade: " + formatarPreco(resumo.minimum) + " em produtos.");
      }
      if (resumo.tollIncluded) linhas.push("🛣️ O pedágio já está incluído no frete.");
    }

    linhas.push(
      "",
      "💳 *PAGAMENTO*",
      "• Após a confirmação dos itens, valores e recebimento, a equipe enviará um link de pagamento ou a chave PIX.",
      "",
      "🔒 _Disponibilidade, prazo e condições finais serão confirmados pela equipe. O pedido só será confirmado após a identificação do pagamento._"
    );

    return linhas.join("\n");
  }


  function finalizarPedido() {

    if (!carrinho.length) {
      return;
    }

    var resumoRecebimento = obterResumoRecebimento();
    if (!resumoRecebimento.valid) {
      window.alert("Selecione a forma de recebimento e, para entrega, a localidade antes de continuar.");
      return;
    }

    if (window.LuxuriosaMedicao && typeof window.LuxuriosaMedicao.registrar === "function") {
      window.LuxuriosaMedicao.registrar("begin_checkout", {
        quantity: quantidadeTotal(),
        method: "whatsapp",
        fulfillment_method: resumoRecebimento.method,
        delivery_city: resumoRecebimento.city || null,
        delivery_fee: resumoRecebimento.freight,
        club_member_rate: resumoRecebimento.clubMember === true
      });
    }

    /* Registra o avanço no funil sem criar pedido nem afirmar que houve venda. */
    if (window.LuxuriosaInteligencia) {
      if (typeof window.LuxuriosaInteligencia.registrarEtapa === "function") {
        window.LuxuriosaInteligencia.registrarEtapa("checkout_started", carrinho)
          .catch(function (erro) {
            console.warn("Luxuriosa: não foi possível registrar o início da finalização.", erro);
          });
      }
      if (typeof window.LuxuriosaInteligencia.registrarEvento === "function") {
        window.LuxuriosaInteligencia.registrarEvento("whatsapp_opened")
          .catch(function (erro) {
            console.warn("Luxuriosa: não foi possível registrar a abertura do WhatsApp.", erro);
          });
      }
    }

    abrirWhatsApp(montarMensagemPedido(resumoRecebimento));

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


    var painelCarrinho = $("cart");
    if (painelCarrinho) {
      painelCarrinho.addEventListener("keydown", function (event) {
        if (!painelCarrinho.classList.contains("open")) return;

        if (event.key === "Escape") {
          event.preventDefault();
          fecharCarrinho();
          return;
        }

        if (event.key !== "Tab") return;

        var focaveis = Array.prototype.slice.call(
          painelCarrinho.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(function (el) {
          return !el.hidden && el.getAttribute("aria-hidden") !== "true" && el.offsetParent !== null;
        });

        if (!focaveis.length) {
          event.preventDefault();
          painelCarrinho.setAttribute("tabindex", "-1");
          painelCarrinho.focus();
          return;
        }

        var primeiro = focaveis[0];
        var ultimo = focaveis[focaveis.length - 1];

        if (event.shiftKey && (document.activeElement === primeiro || !painelCarrinho.contains(document.activeElement))) {
          event.preventDefault();
          ultimo.focus();
        } else if (!event.shiftKey && (document.activeElement === ultimo || !painelCarrinho.contains(document.activeElement))) {
          event.preventDefault();
          primeiro.focus();
        }
      });
    }

    if (overlay) {

      overlay.addEventListener(
        "click",
        fecharCarrinho
      );

    }


    var metodoRecebimento = $("cartFulfillmentMethod");
    var cidadeEntrega = $("cartDeliveryCity");
    var membroClube = $("cartClubMember");
    [metodoRecebimento, cidadeEntrega, membroClube].forEach(function (controle) {
      if (controle) controle.addEventListener("change", renderizar);
    });

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
        if (evento.key !== "Escape") return;

        /* Se a revisão do pedido estiver aberta, o Esc pertence a ela.
           Não fecha também o carrinho que está por trás do diálogo. */
        var cadastroAberto = $("customerOverlay") &&
          !$("customerOverlay").hidden;

        var carrinhoAberto = $("cart") &&
          $("cart").classList.contains("open");

        if (carrinhoAberto && !cadastroAberto) {
          fecharCarrinho();
        }
      }
    );

  }


  /* =======================================================
     SINCRONIZAÇÃO COM O CATÁLOGO ATUAL
     Atualiza preços e nomes de itens persistidos no navegador.
     ======================================================= */

  function sincronizarCatalogo(listaProdutos) {
    if (!Array.isArray(listaProdutos)) {
      return;
    }

    catalogoSincronizado = true;
    catalogoAtual = listaProdutos.slice();

    if (!carrinho.length) {
      return;
    }

    var alterado = false;

    carrinho.forEach(function (item) {
      if (!listaProdutos.length) {
        var motivoCatalogoIndisponivel = "Não foi possível confirmar a disponibilidade no catálogo. Recarregue a página antes de continuar.";
        if (!item.indisponivel || item.motivoIndisponibilidade !== motivoCatalogoIndisponivel) {
          item.indisponivel = true;
          item.motivoIndisponibilidade = motivoCatalogoIndisponivel;
          alterado = true;
        }
        return;
      }

      var produtoAtual = listaProdutos.find(function (produto) {
        return produto && String(produto.id) === String(item.id);
      });

      if (!produtoAtual) {
        if (!item.indisponivel || item.motivoIndisponibilidade !== "Este produto não está mais no catálogo. Remova-o para continuar.") {
          item.indisponivel = true;
          item.motivoIndisponibilidade = "Este produto não está mais no catálogo. Remova-o para continuar.";
          alterado = true;
        }
        return;
      }

      if (VARIABLE_DICE_KIT_IDS.has(String(item.id)) && !DICE_VARIANTS[String(item.kit_variant_id || "")]) {
        var motivoVariante = "Escolha novamente o Dado do Prazer incluído neste kit antes de finalizar.";
        if (!item.indisponivel || item.motivoIndisponibilidade !== motivoVariante) {
          item.indisponivel = true;
          item.motivoIndisponibilidade = motivoVariante;
          alterado = true;
        }
        return;
      }

      if (produtoAtual.esgotado || produtoAtual.sobConsulta) {
        var motivo = produtoAtual.esgotado
          ? "Produto marcado como esgotado. Remova-o ou confirme a reposição no WhatsApp."
          : "Produto disponível somente sob consulta. Remova-o e consulte pelo botão do catálogo.";

        if (!item.indisponivel || item.motivoIndisponibilidade !== motivo) {
          item.indisponivel = true;
          item.motivoIndisponibilidade = motivo;
          alterado = true;
        }
        return;
      }

      var precoAtual = precoDoCliente(produtoAtual);
      var precoValido = Number.isFinite(precoAtual) && precoAtual > 0;

      if (!precoValido) {
        var motivoPrecoInvalido = "Não foi possível confirmar o preço deste produto. Remova-o e consulte o atendimento antes de continuar.";
        if (!item.indisponivel || item.motivoIndisponibilidade !== motivoPrecoInvalido) {
          item.indisponivel = true;
          item.motivoIndisponibilidade = motivoPrecoInvalido;
          alterado = true;
        }
        return;
      }

      if (item.indisponivel || item.motivoIndisponibilidade) alterado = true;
      item.indisponivel = false;
      item.motivoIndisponibilidade = "";

      var precoClubeAtual = Number(produtoAtual.preco) || null;
      var precoRegularAtual = Number(produtoAtual.precoAntigo) || null;
      var promocaoClubeAtual = Number.isFinite(precoRegularAtual) &&
        Number.isFinite(precoClubeAtual) && precoRegularAtual > precoClubeAtual;
      var nomeAtual = String(produtoAtual.nome || item.nome);
      var imagemAtual = String(produtoAtual.imagem || item.imagem || "");
      var categoriaAtual = String(produtoAtual.categoria || item.categoria || "");
      var tamanhosAtual = String(produtoAtual.tamanhos || "");

      if (item.preco !== precoAtual &&
          Number.isFinite(Number(item.preco)) &&
          Number(item.preco) > 0) {
        item.precoAnteriorCatalogo = Number(item.preco);
        item.avisoPrecoAlterado = true;
        alterado = true;
      }

      if (item.nome !== nomeAtual ||
          item.preco !== precoAtual ||
          item.precoClube !== precoClubeAtual ||
          item.precoRegular !== precoRegularAtual ||
          item.promocaoClube !== promocaoClubeAtual ||
          item.imagem !== imagemAtual ||
          item.categoria !== categoriaAtual ||
          item.tamanhos !== tamanhosAtual) {
        item.nome = nomeAtual;
        item.preco = precoAtual;
        item.precoClube = precoClubeAtual;
        item.precoRegular = precoRegularAtual;
        item.promocaoClube = promocaoClubeAtual;
        item.imagem = imagemAtual;
        item.categoria = categoriaAtual;
        item.tamanhos = tamanhosAtual;
        alterado = true;
      }
    });

    if (alterado) {
      salvar();
    }

    /* Atualiza o botão mesmo quando os dados do carrinho já estavam corretos. */
    renderizar();
  }


  function aplicarEstadoClubeNoCarrinho(detail) {
    if (!detail) return;
    membroClubeVerificado = detail.loaded === true;
    membroClubeAtivo = membroClubeVerificado &&
      detail.isMember === true && detail.profileComplete === true;
    atualizarControlesClube();
    if (catalogoAtual.length) sincronizarCatalogo(catalogoAtual);
    else renderizar();
  }

  window.addEventListener("luxuriosa:club-state-changed", function (event) {
    aplicarEstadoClubeNoCarrinho(event && event.detail);
  });
  if (window.LuxuriosaClubePrecos &&
      typeof window.LuxuriosaClubePrecos.obterEstado === "function") {
    aplicarEstadoClubeNoCarrinho(window.LuxuriosaClubePrecos.obterEstado());
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
      quantidadeTotal,

    sincronizarCatalogo:
      sincronizarCatalogo

  };


  /* =======================================================
     INICIALIZAÇÃO
     ======================================================= */

  function iniciar() {

    carregar();

    configurarEventos();
    atualizarControlesClube();

    renderizar();
    if (window.LuxuriosaInteligencia && typeof window.LuxuriosaInteligencia.registrarCarrinho === "function") {
      window.LuxuriosaInteligencia.registrarCarrinho(carrinho);
    }

    /* Abre o carrinho quando o cliente chega de uma página de produto. */
    try {
      if (new URLSearchParams(window.location.search).get("abrirCarrinho") === "1") {
        abrirCarrinho();
      }
    } catch (erro) {
      console.warn("Luxuriosa: não foi possível interpretar a abertura automática do carrinho.", erro);
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