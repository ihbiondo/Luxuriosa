/* Educação Luxuriosa — camada compartilhada
 * Navegação, acessibilidade e declaração de idade.
 * Sem analytics, anúncios, coleta de respostas ou dependências externas.
 */
(function () {
  "use strict";

  const AGE_KEY = "lux18";
  const EDUCATION_MODULE_LINKS = [
    { label: "Temas educativos", href: "/educacao/temas/" },
    { label: "Enciclopédia", href: "/educacao/enciclopedia/" },
    { label: "Curiosidades", href: "/educacao/curiosidades/" },
    { label: "Guias", href: "/educacao/guias/" },
    { label: "Interatividade", href: "/educacao/interatividade/" }
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
    document.querySelectorAll(".ed-header, .ed-adult, .ed-main, .ed-footer").forEach(element => {
      // Mantém o conteúdo no DOM e no fluxo de leitura dos rastreadores.
      // O atributo inert impede foco e interação enquanto a declaração 18+ está aberta.
      if (hidden) element.setAttribute("inert", "");
      else element.removeAttribute("inert");
    });
  }

  function setupAgeDeclaration() {
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
