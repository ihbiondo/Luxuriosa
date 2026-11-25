/* Educação Luxuriosa — camada compartilhada
 * Navegação, acessibilidade e declaração de idade.
 * Sem anúncios ou coleta de respostas; a medição de visitas é opcional e depende do consentimento analítico.
 */
(function () {
  "use strict";

  function ensureVisitorAnalyticsLoaded() {
    if (window.LuxuriosaInteligencia ||
        document.querySelector('script[data-luxuriosa-visitor-analytics="true"]')) return;
    var script = document.createElement("script");
    script.src = "/js/inteligencia.js?v=20261123-visitor-session-v2";
    script.async = true;
    script.setAttribute("data-luxuriosa-visitor-analytics", "true");
    (document.head || document.documentElement).appendChild(script);
  }

  ensureVisitorAnalyticsLoaded();


  const AGE_KEY = "lux18";
  const EDUCATION_MODULE_LINKS = [
    { label: "Temas educativos", href: "/educacao/temas/" },
    { label: "Enciclopédia", href: "/educacao/enciclopedia/" },
    { label: "Curiosidades", href: "/educacao/curiosidades/" },
    { label: "Guias", href: "/educacao/guias/" },
    { label: "Interatividade", href: "/educacao/interatividade/" },
    { label: "Dúvidas frequentes", href: "/educacao/duvidas-frequentes/" }
  ];
  function normalizePath(path) {
    const clean = (path || "/").split("?")[0].split("#")[0];
    return clean.endsWith("/index.html") ? clean.slice(0, -"index.html".length) : clean;
  }

  function setupNavigation() {
    let header = document.querySelector(".header");
    if (!header) {
      const legacyHeader = document.querySelector(".ed-header");
      if (legacyHeader) {
        header = document.createElement("header");
        header.className = "header";
        legacyHeader.replaceWith(header);

        const brand = document.createElement("a");
        brand.className = "brand";
        brand.href = "/";
        brand.setAttribute("aria-label", "Página inicial da Luxuriosa");
        const brandName = document.createElement("span");
        brandName.textContent = "Luxuriosa";
        const brandSection = document.createElement("small");
        brandSection.textContent = "EDUCAÇÃO";
        brand.append(brandName, brandSection);

        const newNav = document.createElement("nav");
        newNav.setAttribute("aria-label", "Navegação principal da Luxuriosa");
        header.append(brand, newNav);
      }
    }
    const nav = header && header.querySelector("nav");
    if (!header || !nav) return;

    const brand = header.querySelector(".brand");
    if (brand) {
      brand.href = "/";
      brand.setAttribute("aria-label", "Página inicial da Luxuriosa");
      const subtitle = brand.querySelector("small");
      if (subtitle) subtitle.textContent = "EDUCAÇÃO";
    }

    const currentPath = normalizePath(window.location.pathname);
    const portalLink = document.createElement("a");
    portalLink.href = "/portal/";
    portalLink.textContent = "Meu Portal";
    portalLink.className = "global-nav-link global-nav-link--portal";

    const experiencesLink = document.createElement("a");
    experiencesLink.href = "/experiencias/";
    experiencesLink.textContent = "Experiências";
    experiencesLink.className = "global-nav-link global-nav-link--experiences";

    const educationLink = document.createElement("a");
    educationLink.href = "/educacao/";
    educationLink.textContent = "Educação";
    educationLink.className = "global-nav-link global-nav-link--education";
    educationLink.setAttribute("aria-current", currentPath === "/educacao/" ? "page" : "location");

    const storeLink = document.createElement("a");
    storeLink.href = "/";
    storeLink.textContent = "Voltar para Loja";
    storeLink.className = "global-nav-link global-nav-link--store";

    nav.replaceChildren(portalLink, experiencesLink, educationLink, storeLink);
    nav.setAttribute("aria-label", "Navegação principal da Luxuriosa");

    const footerNav = document.querySelector(".ed-footer-links");
    if (footerNav) {
      const footerLinks = [
        { href: "/", label: "Loja" },
        { href: "/portal/", label: "Meu Portal" },
        { href: "/experiencias/", label: "Experiências" },
        ...EDUCATION_MODULE_LINKS.map(item => ({ href: item.href, label: item.label }))
      ];
      footerLinks.forEach(item => {
        if (footerNav.querySelector('a[href="' + item.href + '"]')) return;
        const footerLink = document.createElement("a");
        footerLink.href = item.href;
        footerLink.textContent = item.label;
        footerNav.append(footerLink);
      });
    }


  }


  function setupReadingJourney() {
    const main = document.querySelector(".ed-main");
    if (!main || main.querySelector(".ed-next-step")) return;

    const path = normalizePath(window.location.pathname);
    const journeys = [
      {
        paths: ["/educacao/temas/consentimento-e-limites.html", "/educacao/temas/relacoes-saudaveis-e-comunicacao.html"],
        options: [
          { title: "Levar a reflexão para uma conversa", description: "Uma atividade a dois pode abrir espaço para escuta, diálogo e respeito aos limites.", href: "/experiencias/?tipo=couple", label: "Explorar Conexão a dois" },
          { title: "Conhecer outras formas de se comunicar", description: "Explore conteúdos sobre relações saudáveis e comunicação respeitosa.", href: "/educacao/temas/relacoes-saudaveis-e-comunicacao.html", label: "Ler sobre comunicação" },
          { title: "Explorar novas descobertas", description: "Uma experiência leve pode transformar reflexão em conversa, no seu ritmo.", href: "/experiencias/", label: "Conhecer Experiências" }
        ]
      },
      {
        paths: ["/educacao/temas/prevencao-de-ist.html", "/educacao/temas/prevencao-combinada.html", "/educacao/temas/contracepcao.html", "/educacao/temas/corpo-humano-e-ciclo-menstrual.html", "/educacao/temas/saude-sexual-e-bem-estar.html"],
        options: [
          { title: "Revisar o que você aprendeu", description: "Atividades educativas ajudam a retomar conceitos com calma, sem nota.", href: "/educacao/interatividade/", label: "Abrir atividades educativas" },
          { title: "Aprofundar seus conhecimentos", description: "Consulte outros temas de saúde sexual e prevenção em uma leitura tranquila.", href: "/educacao/temas/", label: "Explorar temas educativos" },
          { title: "Organizar suas dúvidas", description: "Os guias ajudam a preparar perguntas e encontrar orientações confiáveis.", href: "/educacao/guias/", label: "Consultar guias" }
        ]
      },
      {
        paths: ["/educacao/enciclopedia/aneis-penianos.html", "/educacao/enciclopedia/gels-e-lubrificantes.html", "/educacao/enciclopedia/jogos-de-casal.html", "/educacao/enciclopedia/masturbadores.html", "/educacao/enciclopedia/plugs-anais.html", "/educacao/enciclopedia/vibradores.html", "/educacao/curiosidades/materiais-dos-acessorios.html"],
        options: [
          { title: "Conhecer cuidados e escolhas com mais contexto", description: "Orientações práticas ajudam a conservar acessórios e fazer escolhas responsáveis.", href: "/educacao/guias/", label: "Explorar guias educativos" },
          { title: "Consultar outros itens da enciclopédia", description: "Continue conhecendo materiais, características e cuidados de diferentes acessórios.", href: "/educacao/enciclopedia/", label: "Voltar à enciclopédia" },
          { title: "Aprender sobre segurança e bem-estar", description: "Explore temas relacionados à saúde, privacidade e uso responsável.", href: "/educacao/temas/saude-sexual-e-bem-estar.html", label: "Ler sobre bem-estar" }
        ]
      }
    ];
    const journey = journeys.find(item => item.paths.includes(path));
    const options = journey ? journey.options : [
      { title: "Quando quiser, continue explorando.", description: "Você pode mudar do texto para uma atividade gratuita, sem cadastro e no seu ritmo.", href: "/experiencias/", label: "Conhecer Experiências" },
      { title: "Encontre outro assunto para descobrir.", description: "A biblioteca reúne temas, guias e explicações para consultar quando quiser.", href: "/educacao/", label: "Explorar Educação" }
    ];

    // Contexto efêmero por aba: não cria perfil, conta ou histórico persistente.
    const key = "lux_journey_session_v1";
    let recent = [];
    try {
      recent = JSON.parse(window.sessionStorage.getItem(key) || "[]");
      if (!Array.isArray(recent)) recent = [];
    } catch (_) { recent = []; }
    const normalizeCandidate = href => {
      try { return normalizePath(new URL(href, window.location.origin).pathname); }
      catch (_) { return normalizePath(href); }
    };
    recent = recent.map(normalizePath);
    const suggestion = options.find(item => {
      const candidatePath = normalizeCandidate(item.href);
      return candidatePath !== path && !recent.includes(candidatePath);
    }) || options.find(item => normalizeCandidate(item.href) !== path) || options[0];
    try {
      recent = [path, ...recent.filter(item => item !== path)].slice(0, 8);
      window.sessionStorage.setItem(key, JSON.stringify(recent));
    } catch (_) {}

    const panel = document.createElement("aside");
    panel.className = "ed-next-step";
    panel.setAttribute("aria-labelledby", "edNextStepTitle");
    const eyebrow = document.createElement("small");
    eyebrow.textContent = "UM PRÓXIMO PASSO, SEM PRESSA";
    const heading = document.createElement("h2");
    heading.id = "edNextStepTitle";
    heading.textContent = suggestion.title;
    const description = document.createElement("p");
    description.textContent = suggestion.description;
    const actions = document.createElement("div");
    actions.className = "ed-next-step-actions";
    const primary = document.createElement("a");
    primary.href = suggestion.href;
    primary.textContent = suggestion.label;
    const portal = document.createElement("a");
    portal.href = "/portal/";
    portal.textContent = "Voltar ao meu Portal";
    portal.className = "ed-next-step-portal";
    actions.append(primary, portal);
    panel.append(eyebrow, heading, description, actions);

    const article = main.querySelector(".ed-article");
    if (article) {
      const back = article.querySelector(".ed-backtop");
      if (back) article.insertBefore(panel, back);
      else article.append(panel);
      return;
    }

    const tool = main.querySelector(".ed-tool");
    if (tool) {
      const section = tool.closest(".ed-section") || tool.parentElement;
      if (tool.querySelector("#knowledgeQuiz")) panel.hidden = true;
      section.parentElement.insertBefore(panel, section.nextSibling);
    }
  }

  function setupDiscoveryAssistant() {
    const assistant = document.querySelector("#edDiscoveryAssistant");
    const result = document.querySelector("#edDiscoveryResult");
    if (!assistant || !result) return;

    const destinations = {
      types: {
        title: "Comece pela Enciclopédia",
        description: "Conheça os principais tipos de acessórios, suas funções e as características que vale observar antes de comparar opções.",
        href: "/educacao/enciclopedia/",
        label: "Explorar a Enciclopédia"
      },
      materials: {
        title: "Entenda os materiais",
        description: "Veja a diferença entre materiais porosos e não porosos e por que composição, higiene e conservação importam.",
        href: "/educacao/curiosidades/materiais-dos-acessorios.html",
        label: "Ler sobre materiais"
      },
      lubricants: {
        title: "Compare géis e lubrificantes",
        description: "Conheça as bases aquosa, silicone e óleo e confira pontos importantes de compatibilidade com acessórios e preservativos.",
        href: "/educacao/guias/escolher-lubrificante.html",
        label: "Consultar o guia de lubrificantes"
      },
      care: {
        title: "Aprenda sobre limpeza e conservação",
        description: "Veja orientações gerais de limpeza, secagem e armazenamento, sempre respeitando as instruções do fabricante.",
        href: "/educacao/guias/limpeza-e-conservacao.html",
        label: "Abrir o guia de cuidados"
      },
      questions: {
        title: "Tire dúvidas antes de escolher",
        description: "Consulte respostas práticas sobre tamanhos, uso, compatibilidade, higiene e compra reservada.",
        href: "/educacao/duvidas-frequentes/",
        label: "Consultar dúvidas frequentes"
      },
      explore: {
        title: "Explore no seu próprio ritmo",
        description: "Leia explicações curtas, descubra novos assuntos e continue navegando pela biblioteca sem precisar decidir agora.",
        href: "/educacao/curiosidades/",
        label: "Ver curiosidades"
      }
    };

    const buttons = Array.from(assistant.querySelectorAll("[data-discovery]"));
    buttons.forEach(button => {
      button.addEventListener("click", () => {
        const destination = destinations[button.dataset.discovery];
        if (!destination) return;

        buttons.forEach(option => {
          const selected = option === button;
          option.setAttribute("aria-pressed", String(selected));
          option.classList.toggle("is-selected", selected);
        });

        const eyebrow = document.createElement("p");
        eyebrow.className = "ed-discovery-eyebrow";
        eyebrow.textContent = "SUA TRILHA DE LEITURA";
        const heading = document.createElement("h3");
        heading.textContent = destination.title;
        const description = document.createElement("p");
        description.className = "ed-discovery-description";
        description.textContent = destination.description;
        const link = document.createElement("a");
        link.className = "ed-discovery-link";
        link.href = destination.href;
        link.textContent = destination.label;
        result.replaceChildren(eyebrow, heading, description, link);
      });
    });
  }

  function normalizeFaqQuery(value) {
    return (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  }

  function setupFaqSearch() {
    const input = document.querySelector("#faqSearch");
    const container = document.querySelector("#faqQuestions");
    const status = document.querySelector("#faqSearchStatus");
    if (!input || !container || !status) return;

    const groups = Array.from(container.querySelectorAll(".ed-faq-group"));
    const entries = groups.flatMap(group =>
      Array.from(group.querySelectorAll(".ed-faq-item")).map(item => ({
        item,
        group,
        searchText: normalizeFaqQuery(item.textContent)
      }))
    );

    function updateResults() {
      const query = normalizeFaqQuery(input.value.trim());
      let visibleCount = 0;
      const groupCounts = new Map(groups.map(group => [group, 0]));

      entries.forEach(entry => {
        const matches = !query || entry.searchText.includes(query);
        entry.item.hidden = !matches;
        if (matches) {
          visibleCount += 1;
          groupCounts.set(entry.group, groupCounts.get(entry.group) + 1);
        }
      });

      groups.forEach(group => {
        group.hidden = groupCounts.get(group) === 0;
      });

      if (!query) {
        status.hidden = true;
        status.textContent = "";
        return;
      }

      status.hidden = false;
      status.textContent = visibleCount === 0
        ? "Nenhuma pergunta encontrada. Tente outra palavra ou escolha um dos assuntos acima."
        : visibleCount + (visibleCount === 1
          ? " pergunta encontrada."
          : " perguntas encontradas.");
    }

    input.addEventListener("input", updateResults);
    input.addEventListener("search", updateResults);

    // Ao escolher um atalho de assunto, restaura a lista completa para não ocultar a seção de destino.
    document.querySelectorAll(".ed-faq-jump a[href^='#faq-']").forEach(link => {
      link.addEventListener("click", () => {
        if (!input.value) return;
        input.value = "";
        updateResults();
      });
    });
  }

  function setupSkipLink() {
    const main = document.querySelector(".ed-main");
    if (!main) return;

    if (!main.id) main.id = "conteudo-principal";
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    if (document.querySelector(".ed-skip-link")) return;

    const skip = document.createElement("a");
    skip.className = "ed-skip-link";
    skip.href = "#" + main.id;
    skip.textContent = "Pular para o conteúdo";
    document.body.insertBefore(skip, document.body.firstChild);
  }

  function setBackgroundHidden(hidden) {
    document.querySelectorAll(".ed-header, .ed-adult, .ed-main, .ed-footer, .ed-skip-link").forEach(element => {
      // Mantém o conteúdo no DOM e no fluxo de leitura dos rastreadores.
      // O atributo inert impede foco e interação enquanto a declaração 18+ está aberta.
      if (hidden) element.setAttribute("inert", "");
      else element.removeAttribute("inert");
    });
  }

  function setupAgeDeclaration() {
    if (document.documentElement.getAttribute("data-ed-age-required") !== "true") return;

    let approved = false;
    try {
      approved = window.localStorage.getItem(AGE_KEY) === "1";
    } catch (error) {
      // Em navegadores que bloqueiam armazenamento, a confirmação vale apenas para esta página.
    }
    if (approved) return;

    const overlay = document.createElement("div");
    overlay.className = "ed-age-gate";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("section");
    dialog.className = "ed-age-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ed-age-title");
    dialog.setAttribute("aria-describedby", "ed-age-description");

    const eyebrow = document.createElement("p");
    eyebrow.className = "ed-age-eyebrow";
    eyebrow.textContent = "EDUCAÇÃO LUXURIOSA";

    const title = document.createElement("h2");
    title.id = "ed-age-title";
    title.textContent = "Conteúdo para adultos";

    const description = document.createElement("p");
    description.id = "ed-age-description";
    description.textContent = "Esta área é destinada a pessoas com 18 anos ou mais. Ao continuar, você declara ter pelo menos 18 anos.";

    const note = document.createElement("p");
    note.className = "ed-age-note";
    note.textContent = "Esta confirmação é uma declaração de idade, não uma verificação documental.";

    const actions = document.createElement("div");
    actions.className = "ed-age-actions";

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "ed-age-confirm";
    confirm.textContent = "Tenho 18 anos ou mais";

    const exit = document.createElement("a");
    exit.className = "ed-age-exit";
    exit.href = "https://www.google.com.br/";
    exit.textContent = "Sair";

    actions.append(confirm, exit);
    dialog.append(eyebrow, title, description, note, actions);
    overlay.append(dialog);
    document.body.append(overlay);
    document.body.classList.add("ed-age-open");
    setBackgroundHidden(true);

    function closeGate() {
      try {
        window.localStorage.setItem(AGE_KEY, "1");
      } catch (error) {
        // A pessoa pode continuar nesta sessão mesmo sem armazenamento disponível.
      }
      overlay.remove();
      document.body.classList.remove("ed-age-open");
      document.documentElement.classList.remove("ed-age-pending");
      setBackgroundHidden(false);
      const main = document.querySelector(".ed-main");
      if (main) main.focus({ preventScroll: true });
    }

    confirm.addEventListener("click", closeGate);
    dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll("button, a[href]"))
        .filter(element => !element.disabled);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    confirm.focus();
  }

  function initialize() {
    setupNavigation();
    setupFaqSearch();
    setupDiscoveryAssistant();
    setupReadingJourney();
    setupSkipLink();
    setupAgeDeclaration();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
