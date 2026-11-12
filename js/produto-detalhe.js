/* =========================================================
   LUXURIOSA — COMPRA NA PÁGINA DE PRODUTO
   Usa o catálogo e o carrinho oficiais do site.
   ========================================================= */
(function () {
  "use strict";

  var botao = document.querySelector("[data-add-to-cart]");
  if (!botao) return;

  var id = String(botao.getAttribute("data-product-id") || "");
  var status = document.getElementById("productCartStatus");
  var KITS_COM_DADO_A_ESCOLHER = ["22", "23", "24", "27", "28", "29"];
  var OPCOES_DADO = {
    "1": "Dado do Prazer — Gay",
    "2": "Dado do Prazer — Hétero",
    "3": "Dado do Prazer — Lésbico"
  };
  var escolhaDado = null;

  function prepararEscolhaDado(produto) {
    if (KITS_COM_DADO_A_ESCOLHER.indexOf(String(produto.id)) === -1) return;
    var container = botao.closest(".product-detail-copy") || botao.parentElement;
    if (!container) return;
    var wrap = document.createElement("div");
    wrap.id = "kitDiceChoiceWrap";
    wrap.style.cssText = "margin:18px 0;padding:14px 15px;border:1px solid #d9c3cb;border-radius:10px;background:#fbf7f8;max-width:460px";
    var label = document.createElement("label");
    label.htmlFor = "kitDiceChoice";
    label.textContent = "Escolha a versão do Dado do Prazer";
    label.style.cssText = "display:block;font-weight:700;margin-bottom:7px;color:var(--text,#241d21)";
    escolhaDado = document.createElement("select");
    escolhaDado.id = "kitDiceChoice";
    escolhaDado.required = true;
    escolhaDado.style.cssText = "width:100%;min-height:42px;padding:9px 11px;border:1px solid #cdb7c0;border-radius:7px;background:#fff;color:#241d21";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione: Hétero, Gay ou Lésbico";
    escolhaDado.appendChild(placeholder);
    Object.keys(OPCOES_DADO).forEach(function (optionId) {
      var option = document.createElement("option");
      option.value = optionId;
      option.textContent = OPCOES_DADO[optionId];
      escolhaDado.appendChild(option);
    });
    var hint = document.createElement("small");
    hint.textContent = "A escolha será registrada no pedido para separar o item correto.";
    hint.style.cssText = "display:block;margin-top:6px;color:var(--muted,#766b72);font-size:.82rem";
    wrap.append(label, escolhaDado, hint);
    var actions = container.querySelector(".product-detail-actions");
    if (actions) container.insertBefore(wrap, actions);
    else container.insertBefore(wrap, botao);
  }


  function informar(mensagem) {
    if (status) status.textContent = mensagem;
  }

  function bloquear(mensagem) {
    botao.disabled = true;
    botao.textContent = mensagem;
    botao.setAttribute("aria-disabled", "true");
  }

  if (!id) {
    bloquear("Compra indisponível");
    informar("Não foi possível identificar este produto. Entre em contato pelo WhatsApp.");
    return;
  }

  if (!window.LuxuriosaCarrinho ||
      typeof window.LuxuriosaCarrinho.adicionar !== "function") {
    bloquear("Carrinho indisponível");
    informar("Não foi possível carregar o carrinho. Atualize a página ou fale com a Luxuriosa.");
    return;
  }

  fetch("../data/produtos.json", { cache: "no-cache" })
    .then(function (resposta) {
      if (!resposta.ok) throw new Error("Não foi possível consultar o catálogo.");
      return resposta.json();
    })
    .then(function (dados) {
      if (!dados || !Array.isArray(dados.produtos)) {
        throw new Error("O catálogo retornou dados inválidos.");
      }

      var produto = dados.produtos.find(function (item) {
        return item && String(item.id) === id;
      });

      if (!produto) throw new Error("Este produto não foi encontrado no catálogo.");

      window.LuxuriosaCarrinho.sincronizarCatalogo(dados.produtos);

      if (produto.esgotado) {
        bloquear("Produto esgotado");
        informar("Este produto está temporariamente indisponível.");
        return;
      }

      if (produto.sobConsulta) {
        bloquear("Consulte pelo WhatsApp");
        informar("Este produto está disponível somente sob consulta.");
        return;
      }

      if (typeof produto.preco !== "number" || !Number.isFinite(produto.preco) || produto.preco <= 0) {
        bloquear("Consulte pelo WhatsApp");
        informar("Não foi possível confirmar o preço para compra online.");
        return;
      }

      prepararEscolhaDado(produto);

      botao.disabled = false;
      botao.textContent = "Adicionar ao carrinho";
      botao.setAttribute("aria-disabled", "false");

      botao.addEventListener("click", function () {
        if (botao.disabled) return;
        var options = {};
        if (escolhaDado) {
          var selectedId = String(escolhaDado.value || "");
          if (!Object.prototype.hasOwnProperty.call(OPCOES_DADO, selectedId)) {
            informar("Selecione uma versão do Dado do Prazer antes de adicionar o kit.");
            escolhaDado.focus();
            return;
          }
          options.selected_components = [{
            product_id: selectedId,
            product_name: OPCOES_DADO[selectedId],
            quantity: 1
          }];
        }
        botao.disabled = true;
        botao.textContent = "Adicionando…";

        try {
          window.LuxuriosaCarrinho.adicionar(produto, 1, options);
          botao.textContent = "Adicionado!";
          informar("Produto adicionado. Abrindo seu carrinho…");
          window.location.href = "../loja.html?abrirCarrinho=1#catalogo";
        } catch (erro) {
          botao.disabled = false;
          botao.textContent = "Tentar novamente";
          informar("Não foi possível adicionar o produto. Tente novamente.");
          console.error("Luxuriosa: falha ao adicionar produto ao carrinho.", erro);
        }
      });
    })
    .catch(function (erro) {
      bloquear("Não foi possível carregar");
      informar("Não conseguimos confirmar preço e disponibilidade. Atualize a página ou consulte o atendimento.");
      console.error("Luxuriosa: falha ao preparar compra na página do produto.", erro);
    });
})();
