/* Educação Luxuriosa — camada compartilhada
 * Navegação, acessibilidade e declaração de idade.
 * Sem analytics, anúncios, coleta de respostas ou dependências externas.
 */
(function () {
  "use strict";

  const AGE_KEY = "lux18";
  const NAV_ITEMS = [
    { label: "Temas educativos", href: "/educacao/temas/", section: "temas" },
    { label: "Enciclopédia", href: "/educacao/enciclopedia/", section: "enciclopedia" },
    { label: "Curiosidades", href: "/educacao/curiosidades/", section: "curiosidades" },
    { label: "Guias", href: "/educacao/guias/", section: "guias" },
    { label: "Interatividade", href: "/educacao/interatividade/", section: "interatividade" }
  ];

  function normalizePath(path) {
    const clean = (path || "/").split("?")[0].split("#")[0];
    return clean.endsWith("/index.html") ? clean.slice(0, -"index.html".length) : clean;
  }

  function setupNavigation() {
    const menu = document.querySelector(".ed-menu");
    const nav = menu && menu.querySelector("nav");
    if (!menu || !nav) return;

    menu.setAttribute("data-ed-module-menu", "");
    const summary = menu.querySelector("summary");
    if (summary) {
      summary.textContent = "Explorar módulos ⌄";
      summary.setAttribute("aria-label", "Abrir navegação dos módulos educativos");
    }

    const brand = document.querySelector(".ed-brand");
    if (brand) {
      brand.href = "/educacao/";
      brand.setAttribute("aria-label", "Educação Luxuriosa — início");
      const subtitle = brand.querySelector("small");
      if (subtitle) subtitle.textContent = "EDUCAÇÃO · CONHECIMENTO";
    }

    const currentPath = normalizePath(window.location.pathname);
    const currentSection = NAV_ITEMS.find(item =>
      currentPath.startsWith("/educacao/" + item.section + "/")
    );

    const links = NAV_ITEMS.map(item => {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;

      if (currentSection && currentSection.section === item.section) {
        link.setAttribute("aria-current", currentPath === item.href ? "page" : "location");
      }
      return link;
    });

    nav.replaceChildren(...links);
    nav.setAttribute("aria-label", "Cinco módulos da Educação Luxuriosa");

    menu.addEventListener("click", event => {
      if (event.target.closest("a")) menu.open = false;
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
    document.querySelectorAll(".ed-header, .ed-adult, .ed-main, .ed-footer").forEach(element => {
      if (hidden) element.setAttribute("aria-hidden", "true");
      else element.removeAttribute("aria-hidden");
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
    setupSkipLink();
    setupAgeDeclaration();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
