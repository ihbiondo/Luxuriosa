(function () {
  "use strict";

  const DATA_URL = "/data/astrologia.json";
  const AGE_KEY = "lux18";
  const signId = document.body.dataset.signId;
  const root = document.getElementById("signDetailMain");

  function setupExperienceNavigation() {
    const nav = document.querySelector(".header nav");
    if (!nav) return;

    const items = [
      { label: "Meu Portal", href: "/portal/", className: "global-nav-link global-nav-link--portal" },
      { label: "Experiências", href: "/experiencias/", className: "global-nav-link global-nav-link--experiences" },
      { label: "Educação", href: "/educacao/", className: "global-nav-link global-nav-link--education" },
      { label: "Voltar para Loja", href: "/", className: "global-nav-link global-nav-link--store" }
    ];
    const links = items.map(item => {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      if (item.className) link.className = item.className;
      if (item.current) link.setAttribute("aria-current", item.current);
      return link;
    });
    nav.replaceChildren(...links);
    nav.setAttribute("aria-label", "Navegação entre Portal, Experiências e Educação");

    const footer = document.querySelector(".footer");
    if (footer) {
      [
        { href: "/portal/", label: "Meu Portal" },
        { href: "/educacao/", label: "Educação" }
      ].forEach(item => {
        if (footer.querySelector('a[href="' + item.href + '"]')) return;
        const link = document.createElement("a");
        link.href = item.href;
        link.textContent = item.label;
        footer.append(link);
      });
    }
  }

  setupExperienceNavigation();
  (function recordLocalJourney() {
    try {
      const key = "lux_journey_session_v1";
      const path = window.location.pathname.replace(/index\\.html$/, "");
      const current = path || "/";
      const stored = JSON.parse(window.sessionStorage.getItem(key) || "[]");
      const recent = Array.isArray(stored) ? stored.filter(item => typeof item === "string" && item !== current) : [];
      window.sessionStorage.setItem(key, JSON.stringify([current, ...recent].slice(0, 12)));
    } catch (_) {
      // O histórico contextual é opcional e permanece apenas nesta aba.
    }
  })();


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


  function addSignJourney(){
    if(!root || root.querySelector(".sign-journey")) return;
    const panel=el("aside","sign-journey");
    panel.setAttribute("aria-labelledby","signJourneyTitle");
    const kicker=el("small","sign-journey-kicker","SE QUISER CONTINUAR");
    const title=el("h2","","A descoberta pode seguir por outros caminhos.");
    title.id="signJourneyTitle";
    const description=el("p","","A astrologia é uma leitura simbólica. Você também pode explorar conversas e informações sobre relações no seu próprio ritmo.");
    const actions=el("div","sign-journey-actions");
    const conversation=el("a","","Explorar uma conversa a dois →");
    conversation.href="/experiencias/?tipo=couple";
    const learning=el("a","","Ler sobre relações e comunicação →");
    learning.href="/educacao/temas/relacoes-saudaveis-e-comunicacao.html";
    actions.append(conversation,learning);
    const portal=el("a","sign-journey-portal","Voltar ao meu Portal");
    portal.href="/portal/";
    panel.append(kicker,title,description,actions,portal);
    root.append(panel);
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
    setText("signNameInEssence", sign.name);
    setText("signPeriod", sign.period.label);
    setText("signArchetype", sign.archetype);
    setText("signOverview", sign.profile.overview);
    setText("signEssence", sign.profile.essence);
    setText("signRelationships", sign.profile.relationships);
    setText("signIntimacy", sign.profile.intimacy);
    setText("signGrowth", sign.profile.growth);
    setText("signElement", "Elemento: " + sign.element);
    setText("signModality", "Modalidade: " + sign.modality);
    setText("signPolarity", "Polaridade: " + sign.polarity);
    setText("signElementHeading", sign.element);
    setText("signModalityHeading", sign.modality);
    setText("signPolarityHeading", sign.polarity);
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

    if (globalThis.LuxuriosaSignShare) {
      const shareStudio = globalThis.LuxuriosaSignShare.mount({
        canvasId: "detailShareCanvas",
        storyButtonId: "detailShareStory",
        squareButtonId: "detailShareSquare",
        downloadButtonId: "detailShareDownload",
        shareButtonId: "detailShareNative",
        whatsAppLinkId: "detailShareWhatsApp",
        statusId: "detailShareStatus"
      });
      if (shareStudio) shareStudio.setSign(sign);
    }

    addSignJourney();
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
