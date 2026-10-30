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

      botao.disabled = false;
      botao.textContent = "Adicionar ao carrinho";
      botao.setAttribute("aria-disabled", "false");

      botao.addEventListener("click", function () {
        if (botao.disabled) return;
        botao.disabled = true;
        botao.textContent = "Adicionando…";

        try {
          window.LuxuriosaCarrinho.adicionar(produto, 1);
          botao.textContent = "Adicionado!";
          informar("Produto adicionado. Abrindo seu carrinho…");
          window.location.href = "../index.html?abrirCarrinho=1#catalogo";
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
