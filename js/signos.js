(function () {
  "use strict";

  const DATA_URL = "/data/astrologia.json";
  const AGE_KEY = "lux18";
  const form = document.getElementById("signForm");
  const dateInput = document.getElementById("birthDate");
  const result = document.getElementById("signResult");
  const firstSelect = document.getElementById("signOne");
  const secondSelect = document.getElementById("signTwo");
  const grid = document.getElementById("signGrid");

  function setupAgeGate() {
    let approved = false;
    try {
      approved = localStorage.getItem(AGE_KEY) === "1";
    } catch (_) {
      // A experiência continua disponível mesmo quando o armazenamento local é bloqueado.
    }

    if (approved) return;

    const gate = document.getElementById("ageGate");
    const confirm = document.getElementById("ageConfirm");
    if (!gate || !confirm || typeof gate.showModal !== "function") return;

    gate.showModal();
    confirm.addEventListener("click", function () {
      try {
        localStorage.setItem(AGE_KEY, "1");
      } catch (_) {
        // A declaração de idade não depende de persistência local.
      }
      gate.close();
    });
  }

  function appendTextElement(parent, tagName, className, value) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
  }

  function populateSignSelects(signs) {
    [firstSelect, secondSelect].forEach(function (select) {
      signs.forEach(function (sign) {
        const option = document.createElement("option");
        option.value = sign.id;
        option.textContent = sign.glyph + " " + sign.name;
        select.append(option);
      });
    });
  }

  function findSignForDate(value, signsById, signs) {
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || !parts.every(Number.isFinite)) return null;

    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const parsed = new Date(0);
    parsed.setUTCHours(0, 0, 0, 0);
    parsed.setUTCFullYear(year, month - 1, day);

    if (
      year < 1 || month < 1 || month > 12 || day < 1 ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }

    const monthDay = month * 100 + day;
    const ordered = signs.slice().sort(function (a, b) {
      return a.period.startMonthDay - b.period.startMonthDay;
    });

    // O período de Capricórnio atravessa a virada do ano.
    let current = signsById.capricorn || ordered[ordered.length - 1];

    ordered.forEach(function (sign) {
      if (monthDay >= sign.period.startMonthDay) current = sign;
    });

    return current || null;
  }

  function renderSign(sign) {
    document.getElementById("resultSymbol").textContent = sign.glyph;
    document.getElementById("resultName").textContent = sign.name;
    document.getElementById("resultDates").textContent = sign.period.label;
    document.getElementById("resultElement").textContent = "Elemento: " + sign.element;
    document.getElementById("resultModality").textContent = "Modalidade: " + sign.modality;
    document.getElementById("resultDescription").textContent = sign.profile.overview;
    result.hidden = false;
  }

  function fillCatalog(signs, signsById) {
    grid.replaceChildren();

    signs.forEach(function (sign) {
      const card = document.createElement("article");
      card.className = "sign-card";

      appendTextElement(card, "span", "sign-card-symbol", sign.glyph);
      appendTextElement(card, "h3", "", sign.name);
      appendTextElement(card, "p", "", sign.period.shortLabel);
      appendTextElement(card, "span", "sign-card-meta", sign.element + " · " + sign.modality);

      const details = document.createElement("details");
      details.className = "sign-card-details";
      appendTextElement(details, "summary", "", "Explorar signo");
      appendTextElement(details, "p", "sign-card-overview", sign.profile.overview);
      appendTextElement(details, "p", "sign-card-detail", "Potenciais simbólicos: " + sign.profile.strengths.join(", ") + ".");
      appendTextElement(details, "p", "sign-card-detail", "Pontos de atenção: " + sign.profile.challenges.join(", ") + ".");
      appendTextElement(details, "p", "sign-card-detail", "Comunicação: " + sign.profile.communication);
      appendTextElement(details, "p", "sign-card-detail", "Afetividade: " + sign.profile.affection);
      appendTextElement(details, "p", "sign-card-prompt", "Para refletir: " + sign.profile.reflectionPrompt);

      const opposite = signsById[sign.oppositeSignId];
      if (opposite) {
        appendTextElement(details, "p", "sign-card-detail", "Signo oposto: " + opposite.name + ".");
      }

      const rulers = sign.rulers.modern
        ? "Regência tradicional: " + sign.rulers.traditional + " · Correspondência moderna: " + sign.rulers.modern + "."
        : "Regência tradicional: " + sign.rulers.traditional + ".";
      appendTextElement(details, "p", "sign-card-detail", rulers);

      card.append(details);

      const profileLink = document.createElement("a");
      profileLink.className = "sign-card-link";
      profileLink.href = "/experiencias/signos/" + sign.id + ".html";
      profileLink.textContent = "Conhecer " + sign.name + " →";
      card.append(profileLink);

      grid.append(card);
    });
  }

  function describeCombination(a, b, classification) {
    if (a.id === b.id) {
      return "Você escolheu o mesmo signo nas duas opções. A leitura pode servir como convite para observar diferentes formas de expressar os temas simbólicos de " + a.name + ".";
    }

    if (a.element === b.element) {
      return "Os dois signos compartilham o elemento " + a.element.toLowerCase() + ". " +
        classification.elements[a.element] +
        " Nesta leitura, isso sugere pontos de identificação — sem determinar como uma relação funciona.";
    }

    const hasAirAndFire = (a.element === "Ar" && b.element === "Fogo") || (a.element === "Fogo" && b.element === "Ar");
    if (hasAirAndFire) {
      return "Na tradição astrológica, ar e fogo são associados a ideias, movimento e entusiasmo. É uma combinação simbólica que convida à troca e à experimentação.";
    }
    const hasWaterAndEarth = (a.element === "Água" && b.element === "Terra") || (a.element === "Terra" && b.element === "Água");
    if (hasWaterAndEarth) {
      return "Na tradição astrológica, água e terra são associados a sensibilidade, cuidado e construção. É uma combinação simbólica que convida ao acolhimento e à consistência.";
    }

    if (a.modality === b.modality) {
      return "Os dois signos compartilham a modalidade " + a.modality.toLowerCase() + ". " +
        classification.modalities[a.modality] +
        " A semelhança pode ser um ponto interessante para explorar nesta leitura simbólica.";
    }

    return "Esses signos combinam elementos diferentes: " + a.element.toLowerCase() + " e " + b.element.toLowerCase() +
      ". Na astrologia, essa diferença é tratada como um convite para conhecer ritmos, perspectivas e formas de expressão distintas.";
  }

  function setupCompatibility(signs, data) {
    populateSignSelects(signs);

    document.getElementById("compatibilityForm").addEventListener("submit", function (event) {
      event.preventDefault();

      const a = data.signsById[firstSelect.value];
      const b = data.signsById[secondSelect.value];
      if (!a || !b) {
        firstSelect.reportValidity();
        secondSelect.reportValidity();
        return;
      }

      document.getElementById("compatibilityHeading").textContent = a.name + " + " + b.name;
      document.getElementById("compatibilityText").textContent = describeCombination(a, b, data.classification);
      document.getElementById("compatibilityResult").hidden = false;
    });
  }

  function showLoadError() {
    grid.replaceChildren();
    appendTextElement(grid, "p", "sign-load-error", "Não foi possível carregar as informações dos signos agora. Atualize a página para tentar novamente.");
    [form, document.getElementById("compatibilityForm")].forEach(function (element) {
      if (!element) return;
      element.querySelectorAll("button, input, select").forEach(function (control) {
        control.disabled = true;
      });
    });
  }

  async function init() {
    setupAgeGate();

    if (!form || !dateInput || !grid || !firstSelect || !secondSelect) return;

    const today = new Date();
    const pad = function (number) { return String(number).padStart(2, "0"); };
    dateInput.max = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());

    try {
      const response = await fetch(DATA_URL, {
        headers: { Accept: "application/json" },
        cache: "no-cache"
      });
      if (!response.ok) throw new Error("Falha ao carregar a base astrológica.");

      const data = await response.json();
      if (
        data.schemaVersion !== 1 ||
        !Array.isArray(data.signs) ||
        data.signs.length !== 12 ||
        !data.classification
      ) {
        throw new Error("A base astrológica não possui o formato esperado.");
      }

      const signs = data.signs.slice().sort(function (a, b) {
        return a.order - b.order;
      });
      const signsById = Object.fromEntries(signs.map(function (sign) {
        return [sign.id, sign];
      }));
      data.signsById = signsById;

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!dateInput.value || !dateInput.validity.valid) {
          dateInput.reportValidity();
          return;
        }

        const sign = findSignForDate(dateInput.value, signsById, signs);
        if (sign) renderSign(sign);
      });

      setupCompatibility(signs, data);
      fillCatalog(signs, signsById);
    } catch (error) {
      console.error("[Luxuriosa] Não foi possível iniciar a experiência de signos:", error);
      showLoadError();
    }
  }

  init();
})();
