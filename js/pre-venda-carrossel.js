/* =========================================================
   LUXURIOSA — VITRINE DE NOVIDADES / PRÉ-VENDA
   Carrossel editorial independente do catálogo e do carrinho
========================================================= */
(function () {
  "use strict";

  var track = document.getElementById("pre-venda-track");
  if (!track) return;

  var previousButton = document.getElementById("pre-venda-prev");
  var nextButton = document.getElementById("pre-venda-next");
  var countLabel = document.getElementById("pre-venda-count");
  var whatsapp = "5514996355924";
  var total = 25;

  if (
    window.LuxuriosaCatalogo &&
    typeof window.LuxuriosaCatalogo.obterConfig === "function"
  ) {
    var config = window.LuxuriosaCatalogo.obterConfig();
    if (config && config.whatsapp) {
      whatsapp = String(config.whatsapp).replace(/\D/g, "") || whatsapp;
    }
  }

  function criarElemento(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function criarCartao(numero) {
    var numeroFormatado = String(numero).padStart(2, "0");
    var card = criarElemento("article", "pre-venda-card");

    var media = criarElemento("div", "pre-venda-card-media");
    var image = document.createElement("img");
    image.src = "img/pre-venda-carrosel/" + numero + ".jpeg";
    image.alt = "Prévia de novidade Luxuriosa, imagem " + numeroFormatado;
    image.width = 720;
    image.height = 900;
    image.loading = numero <= 3 ? "eager" : "lazy";
    image.decoding = "async";
    media.appendChild(image);
    media.appendChild(
      criarElemento("span", "pre-venda-card-number", "Lingerie")
    );

    var body = criarElemento("div", "pre-venda-card-body");
    body.appendChild(
      criarElemento("p", "pre-venda-card-eyebrow", "Coleção em preparação")
    );
    body.appendChild(
      criarElemento("h3", "pre-venda-card-title", "Uma novidade a caminho")
    );
    body.appendChild(
      criarElemento(
        "p",
        "pre-venda-card-note",
        "Ainda não disponível para compra. Manifeste seu interesse."
      )
    );

    var message =
      "Olá! Vi a imagem " + numeroFormatado +
      " no carrossel de novidades da Luxuriosa. Tenho interesse em receber informações quando essa novidade estiver disponível.";
    var action = criarElemento("a", "pre-venda-card-action", "Tenho interesse");
    action.href = "https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(message);
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.setAttribute(
      "aria-label",
      "Manifestar interesse futuro pela imagem " + numeroFormatado + " no WhatsApp"
    );

    body.appendChild(action);
    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  for (var i = 1; i <= total; i += 1) {
    track.appendChild(criarCartao(i));
  }

  function atualizarControles() {
    var maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    if (previousButton) previousButton.disabled = track.scrollLeft <= 2;
    if (nextButton) nextButton.disabled = track.scrollLeft >= maxScroll - 2;

    if (countLabel && track.firstElementChild) {
      var card = track.firstElementChild;
      var style = window.getComputedStyle(track);
      var gap = parseFloat(style.columnGap || style.gap) || 0;
      var step = card.getBoundingClientRect().width + gap;
      var first = step > 0 ? Math.round(track.scrollLeft / step) + 1 : 1;
      var visible = step > 0 ? Math.max(1, Math.round(track.clientWidth / step)) : 1;
      var last = Math.min(total, first + visible - 1);
      var format = function (value) {
        return String(value).padStart(2, "0");
      };
      countLabel.textContent = "Coleção de lingerie";
    }
  }

  function mover(direcao) {
    if (!track.firstElementChild) return;
    var style = window.getComputedStyle(track);
    var gap = parseFloat(style.columnGap || style.gap) || 0;
    var passo = track.firstElementChild.getBoundingClientRect().width + gap;
    var reduzMovimento = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    track.scrollBy({
      left: direcao * passo,
      behavior: reduzMovimento ? "auto" : "smooth"
    });
  }

  if (previousButton) {
    previousButton.addEventListener("click", function () {
      mover(-1);
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", function () {
      mover(1);
    });
  }

  track.addEventListener("scroll", atualizarControles, { passive: true });
  window.addEventListener("resize", atualizarControles);
  atualizarControles();
})();
