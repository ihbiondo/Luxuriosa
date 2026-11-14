(function () {
  "use strict";

  const DATA_URL = "/data/astrologia.json";
  const AGE_KEY = "lux18";
  const form = document.getElementById("signForm");
  const dateInput = document.getElementById("birthDate");
  const timeInput = document.getElementById("birthTime");
  const timezoneInput = document.getElementById("birthTimezone");
  const errorBox = document.getElementById("calculatorError");
  const result = document.getElementById("signResult");
  const firstSelect = document.getElementById("signOne");
  const secondSelect = document.getElementById("signTwo");
  const grid = document.getElementById("signGrid");
  let solarShare = null;

  function setupAgeGate() {
    let approved = false;
    try {
      approved = localStorage.getItem(AGE_KEY) === "1";
    } catch (_) {}

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

  function appendTextElement(parent, tagName, className, value) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
  }

  function populateTimezones() {
    const zones = [
      "America/Sao_Paulo", "America/Noronha", "America/Manaus",
      "America/Cuiaba", "America/Rio_Branco", "America/Argentina/Buenos_Aires",
      "America/New_York", "America/Chicago", "America/Denver",
      "America/Los_Angeles", "Europe/Lisbon", "Europe/London",
      "Europe/Paris", "Africa/Luanda", "Asia/Dubai", "Asia/Tokyo",
      "Asia/Shanghai", "Australia/Sydney", "Pacific/Auckland", "UTC"
    ];
    const datalist = document.getElementById("timezoneOptions");
    if (datalist) {
      datalist.replaceChildren();
      zones.forEach(function (zone) {
        const option = document.createElement("option");
        option.value = zone;
        datalist.append(option);
      });
    }

    let currentZone = "America/Sao_Paulo";
    try {
      currentZone = Intl.DateTimeFormat().resolvedOptions().timeZone || currentZone;
    } catch (_) {}
    if (timezoneInput) timezoneInput.value = currentZone;
    const hint = document.getElementById("timezoneCurrentHint");
    if (hint) hint.textContent = "Fuso sugerido pelo dispositivo: " + currentZone + ". Confira se corresponde ao local de nascimento.";
  }

  function componentsToUtcMillis(parts) {
    const date = new Date(0);
    date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
    date.setUTCHours(parts.hour || 0, parts.minute || 0, parts.second || 0, 0);
    return date.getTime();
  }

  function readZonedParts(date, formatter) {
    const parts = {};
    formatter.formatToParts(date).forEach(function (part) {
      if (part.type !== "literal") parts[part.type] = Number(part.value);
    });
    if (parts.hour === 24) parts.hour = 0;
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second
    };
  }

  function sameLocalDateTime(a, b) {
    return a.year === b.year && a.month === b.month && a.day === b.day &&
      a.hour === b.hour && a.minute === b.minute && a.second === b.second;
  }

  function localBirthTimeToUtc(dateValue, timeValue, timeZone) {
    const dateParts = dateValue.split("-").map(Number);
    const timeParts = timeValue.split(":").map(Number);
    if (dateParts.length !== 3 || timeParts.length < 2) {
      throw new Error("Confira a data e o horário informados.");
    }

    const target = {
      year: dateParts[0],
      month: dateParts[1],
      day: dateParts[2],
      hour: timeParts[0],
      minute: timeParts[1],
      second: 0
    };

    const check = new Date(0);
    check.setUTCFullYear(target.year, target.month - 1, target.day);
    check.setUTCHours(0, 0, 0, 0);
    if (
      target.year < 1 || target.month < 1 || target.month > 12 ||
      target.day < 1 || target.hour < 0 || target.hour > 23 ||
      target.minute < 0 || target.minute > 59 ||
      check.getUTCFullYear() !== target.year ||
      check.getUTCMonth() !== target.month - 1 ||
      check.getUTCDate() !== target.day
    ) {
      throw new Error("A data ou o horário não são válidos.");
    }

    let formatter;
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      });
    } catch (_) {
      throw new Error("Não reconheci esse fuso horário. Escolha um fuso IANA válido, como America/Sao_Paulo.");
    }

    const targetMillis = componentsToUtcMillis(target);
    let guess = targetMillis;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const shown = readZonedParts(new Date(guess), formatter);
      const correction = targetMillis - componentsToUtcMillis(shown);
      if (correction === 0) break;
      guess += correction;
    }

    // Confere transições de horário de verão: horários inexistentes ou repetidos não são presumidos.
    const candidates = [];
    for (let offsetMinutes = -180; offsetMinutes <= 180; offsetMinutes += 15) {
      const candidate = new Date(guess + offsetMinutes * 60000);
      if (sameLocalDateTime(readZonedParts(candidate, formatter), target)) {
        candidates.push(candidate.getTime());
      }
    }
    const unique = Array.from(new Set(candidates));
    if (unique.length === 0) {
      throw new Error("Esse horário pode não ter existido no fuso escolhido devido a uma mudança de horário. Confira os dados.");
    }
    if (unique.length > 1) {
      throw new Error("Esse horário ocorreu duas vezes no fuso escolhido. Informe o horário exato antes de calcular.");
    }
    return new Date(unique[0]);
  }

  function findSignForDate(value, signsById, signs) {
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || !parts.every(Number.isFinite)) return null;
    const year = parts[0], month = parts[1], day = parts[2];
    const parsed = new Date(0);
    parsed.setUTCHours(0, 0, 0, 0);
    parsed.setUTCFullYear(year, month - 1, day);
    if (
      year < 1 || month < 1 || month > 12 || day < 1 ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) return null;

    const monthDay = month * 100 + day;
    const ordered = signs.slice().sort(function (a, b) {
      return a.period.startMonthDay - b.period.startMonthDay;
    });
    let current = signsById.capricorn || ordered[ordered.length - 1];
    ordered.forEach(function (sign) {
      if (monthDay >= sign.period.startMonthDay) current = sign;
    });
    return current || null;
  }

  function findSignByLongitude(longitude, signs) {
    const normalized = ((longitude % 360) + 360) % 360;
    return signs.slice().sort(function (a, b) {
      return a.order - b.order;
    })[Math.floor(normalized / 30)] || null;
  }

  function renderSign(sign, method, note) {
    document.getElementById("resultSymbol").textContent = sign.glyph;
    document.getElementById("resultName").textContent = sign.name;
    document.getElementById("resultDates").textContent = sign.period.label;
    document.getElementById("resultElement").textContent = "Elemento: " + sign.element;
    document.getElementById("resultModality").textContent = "Modalidade: " + sign.modality;
    document.getElementById("resultCalculationMethod").textContent = method;
    document.getElementById("resultDescription").textContent =
      sign.profile.overview + (note ? " " + note : "");
    result.hidden = false;

    const studio = document.getElementById("solarShareStudio");
    if (studio) studio.hidden = false;
    if (solarShare) solarShare.setSign(sign);
  }

  function showCalculationError(message) {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }
    result.hidden = true;
    const studio = document.getElementById("solarShareStudio");
    if (studio) studio.hidden = true;
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
      appendTextElement(details, "p", "sign-card-detail", "Relacionamentos: " + sign.profile.relationships);
      appendTextElement(details, "p", "sign-card-detail", "Intimidade: " + sign.profile.intimacy);
      appendTextElement(details, "p", "sign-card-prompt", "Para refletir: " + sign.profile.reflectionPrompt);
      const opposite = signsById[sign.oppositeSignId];
      if (opposite) appendTextElement(details, "p", "sign-card-detail", "Signo oposto: " + opposite.name + ".");
      const rulers = sign.rulers.modern
        ? "Regência tradicional: " + sign.rulers.traditional + " · Correspondência moderna: " + sign.rulers.modern + "."
        : "Regência tradicional: " + sign.rulers.traditional + ".";
      appendTextElement(details, "p", "sign-card-detail", rulers);
      card.append(details);

      const link = document.createElement("a");
      link.className = "sign-card-link";
      link.href = "/experiencias/signos/" + sign.id + ".html";
      link.textContent = "Conhecer " + sign.name + " →";
      card.append(link);
      grid.append(card);
    });
  }

  function describeCombination(a, b, classification) {
    if (a.id === b.id) {
      return "Você escolheu o mesmo signo nas duas opções. Use esta leitura como convite para observar diferentes formas de expressar os temas simbólicos de " + a.name + ".";
    }
    if (a.element === b.element) {
      return "Os dois signos compartilham o elemento " + a.element.toLowerCase() + ". " +
        classification.elements[a.element] +
        " Nesta leitura, isso sugere pontos de identificação — sem determinar como uma relação funciona.";
    }
    const fireAir = (a.element === "Ar" && b.element === "Fogo") || (a.element === "Fogo" && b.element === "Ar");
    if (fireAir) return "Na tradição astrológica, ar e fogo são associados a ideias, movimento e entusiasmo. É uma combinação simbólica que convida à troca e à experimentação.";
    const earthWater = (a.element === "Água" && b.element === "Terra") || (a.element === "Terra" && b.element === "Água");
    if (earthWater) return "Na tradição astrológica, água e terra são associados a sensibilidade, cuidado e construção. É uma combinação simbólica que convida ao acolhimento e à consistência.";
    if (a.modality === b.modality) {
      return "Os dois signos compartilham a modalidade " + a.modality.toLowerCase() + ". " +
        classification.modalities[a.modality] +
        " A semelhança pode ser um ponto interessante para explorar nesta leitura simbólica.";
    }
    return "Esses signos combinam elementos diferentes: " + a.element.toLowerCase() + " e " + b.element.toLowerCase() +
      ". Na astrologia, essa diferença é tratada como convite para conhecer ritmos e perspectivas distintas.";
  }

  function setupCompatibility(signs, data) {
    [firstSelect, secondSelect].forEach(function (select) {
      signs.forEach(function (sign) {
        const option = document.createElement("option");
        option.value = sign.id;
        option.textContent = sign.glyph + " " + sign.name;
        select.append(option);
      });
    });

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

  async function calculateSolarSign(value, time, timezone, signsById, signs) {
    if (!time) {
      const estimated = findSignForDate(value, signsById, signs);
      if (!estimated) throw new Error("Não consegui reconhecer essa data. Confira o dia, mês e ano.");
      return {
        sign: estimated,
        method: "Estimativa",
        note: "Como o horário não foi informado, usamos as datas convencionais do zodíaco tropical. Perto da mudança de signo, o resultado pode variar."
      };
    }

    if (!globalThis.Astronomy || typeof globalThis.Astronomy.SunPosition !== "function") {
      throw new Error("O cálculo astronômico não carregou. Atualize a página e tente novamente.");
    }
    const utcDate = localBirthTimeToUtc(value, time, timezone);
    const solarPosition = globalThis.Astronomy.SunPosition(utcDate);
    const longitude = solarPosition && Number(solarPosition.elon);
    if (!Number.isFinite(longitude)) {
      throw new Error("Não foi possível calcular a posição do Sol com esses dados.");
    }
    const sign = findSignByLongitude(longitude, signs);
    if (!sign) throw new Error("Não foi possível identificar o signo solar.");
    return {
      sign: sign,
      method: "Cálculo astronômico",
      note: "Resultado calculado pela longitude eclíptica geocêntrica aparente do Sol no horário e fuso informados."
    };
  }

  async function init() {
    setupAgeGate();
    if (!form || !dateInput || !grid || !firstSelect || !secondSelect) return;

    populateTimezones();
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
      ) throw new Error("A base astrológica não possui o formato esperado.");

      const signs = data.signs.slice().sort(function (a, b) { return a.order - b.order; });
      const signsById = Object.fromEntries(signs.map(function (sign) { return [sign.id, sign]; }));
      data.signsById = signsById;

      if (globalThis.LuxuriosaSignShare) {
        solarShare = globalThis.LuxuriosaSignShare.mount({
          canvasId: "solarShareCanvas",
          storyButtonId: "solarShareStory",
          squareButtonId: "solarShareSquare",
          downloadButtonId: "solarShareDownload",
          shareButtonId: "solarShareNative",
          whatsAppLinkId: "solarShareWhatsApp",
          statusId: "solarShareStatus"
        });
      }

      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!dateInput.value || !dateInput.validity.valid) {
          dateInput.reportValidity();
          return;
        }
        if (errorBox) errorBox.hidden = true;

        const button = form.querySelector('button[type="submit"]');
        const originalText = button ? button.textContent : "";
        if (button) {
          button.disabled = true;
          button.textContent = "Calculando...";
        }
        try {
          const method = await calculateSolarSign(
            dateInput.value,
            timeInput ? timeInput.value : "",
            timezoneInput ? timezoneInput.value.trim() : "America/Sao_Paulo",
            signsById,
            signs
          );
          renderSign(method.sign, method.method, method.note);
        } catch (error) {
          showCalculationError(error.message || "Não foi possível calcular o signo com os dados informados.");
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = originalText;
          }
        }
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
