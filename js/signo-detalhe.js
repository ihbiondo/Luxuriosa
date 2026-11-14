(function () {
  "use strict";

  const DATA_URL = "/data/astrologia.json";
  const AGE_KEY = "lux18";
  const signId = document.body.dataset.signId;
  const root = document.getElementById("signDetailMain");

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function fillList(id, values) {
    const list = document.getElementById(id);
    list.replaceChildren();
    values.forEach(function (value) {
      list.append(el("li", "", value));
    });
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setupAgeGate() {
    let approved = false;
    try { approved = localStorage.getItem(AGE_KEY) === "1"; } catch (_) {}
    if (approved) return;
    const gate = document.getElementById("ageGate");
    const confirm = document.getElementById("ageConfirm");
    if (!gate || !confirm || typeof gate.showModal !== "function") return;
    gate.showModal();
    confirm.addEventListener("click", function () {
      try { localStorage.setItem(AGE_KEY, "1"); } catch (_) {}
      gate.close();
    });
  }

  function signUrl(sign) {
    return "/experiencias/signos/" + sign.id + ".html";
  }

  function addSignLink(container, sign, label) {
    const link = el("a", "sign-related-link");
    link.href = signUrl(sign);
    link.append(el("span", "related-glyph", sign.glyph));
    const copy = el("span", "related-copy");
    copy.append(el("strong", "", sign.name), el("small", "", label || sign.period.shortLabel));
    link.append(copy, el("span", "related-arrow", "→"));
    container.append(link);
  }

  function render(sign, data) {
    const signs = data.signs.slice().sort(function (a, b) { return a.order - b.order; });
    const signsById = Object.fromEntries(signs.map(function (item) { return [item.id, item]; }));
    const index = signs.findIndex(function (item) { return item.id === sign.id; });
    const previous = signs[(index + signs.length - 1) % signs.length];
    const next = signs[(index + 1) % signs.length];
    const opposite = signsById[sign.oppositeSignId];

    document.title = sign.name + " | Signos & Astrologia — Luxuriosa";
    setText("signGlyph", sign.glyph);
    setText("signName", sign.name);
    setText("signPeriod", sign.period.label);
    setText("signArchetype", sign.archetype);
    setText("signOverview", sign.profile.overview);
    setText("signElement", sign.element);
    setText("signModality", sign.modality);
    setText("signPolarity", sign.polarity);
    setText("signTraditionalRuler", sign.rulers.traditional);
    setText("signModernRuler", sign.rulers.modern ? sign.rulers.modern : "Sem correspondência moderna destacada nesta ficha");
    setText("signElementDescription", data.classification.elements[sign.element]);
    setText("signModalityDescription", data.classification.modalities[sign.modality]);
    setText("signPolarityDescription", data.classification.polarities[sign.polarity]);
    setText("signCommunication", sign.profile.communication);
    setText("signAffection", sign.profile.affection);
    setText("signReflection", sign.profile.reflectionPrompt);
    setText("signOppositeName", opposite ? opposite.name : "—");

    const keywords = document.getElementById("signKeywords");
    keywords.replaceChildren();
    sign.keywords.forEach(function (keyword) {
      keywords.append(el("span", "sign-keyword", keyword));
    });

    fillList("signStrengths", sign.profile.strengths);
    fillList("signChallenges", sign.profile.challenges);

    const oppositeContainer = document.getElementById("signOppositeLink");
    oppositeContainer.replaceChildren();
    if (opposite) addSignLink(oppositeContainer, opposite, "Signo oposto");

    const navigation = document.getElementById("signNavigation");
    navigation.replaceChildren();
    addSignLink(navigation, previous, "Signo anterior");
    addSignLink(navigation, next, "Próximo signo");

    const share = document.getElementById("shareSign");
    const feedback = document.getElementById("shareFeedback");
    share.addEventListener("click", async function () {
      const url = window.location.href;
      const shareData = {
        title: sign.name + " — Signos Luxuriosa",
        text: "Conheça o perfil simbólico de " + sign.name + " na Experiência Luxuriosa.",
        url: url
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
          feedback.textContent = "Compartilhamento aberto.";
        } else if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
          feedback.textContent = "Link copiado. Compartilhe com quem quiser.";
        } else {
          feedback.textContent = "Copie o endereço desta página para compartilhar.";
        }
      } catch (error) {
        if (error && error.name === "AbortError") return;
        feedback.textContent = "Não foi possível compartilhar automaticamente. Copie o endereço desta página.";
      }
    });

    root.hidden = false;
  }

  async function init() {
    setupAgeGate();
    if (!root || !signId) return;
    try {
      const response = await fetch(DATA_URL, { headers: { Accept: "application/json" }, cache: "no-cache" });
      if (!response.ok) throw new Error("Não foi possível carregar os dados dos signos.");
      const data = await response.json();
      if (data.schemaVersion !== 1 || !Array.isArray(data.signs)) throw new Error("Base de signos inválida.");
      const sign = data.signs.find(function (item) { return item.id === signId; });
      if (!sign) throw new Error("Signo não encontrado.");
      render(sign, data);
    } catch (error) {
      console.error("[Luxuriosa] Erro ao carregar a página do signo:", error);
      const errorBox = document.getElementById("signDetailError");
      errorBox.hidden = false;
      errorBox.textContent = "Não foi possível carregar este signo agora. Volte ao catálogo e tente novamente.";
    }
  }

  init();
})();
