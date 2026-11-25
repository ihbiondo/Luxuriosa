import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const reportPath = process.env.ACCESSIBILITY_REPORT_PATH || "";
const xml = fs.readFileSync("sitemap.xml", "utf8");
const routes = [...new Set([...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gis)].map(m => {
  try { return new URL(m[1].replaceAll("&amp;", "&")).pathname || "/"; } catch { return null; }
}).filter(Boolean).filter(route => !/^\/(?:previa|442|lux-central|lux-gestao|gestao-privada-)/.test(route)))];

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => { try { localStorage.removeItem("lux18"); } catch (error) {} });
const report = { routeFailures: [], missingLanguage: [], missingTitle: [], imagesWithoutAlt: [], controlsWithoutName: [], fieldsWithoutLabel: [], framesWithoutTitle: [], navigationWithoutName: [], headingStructureFailures: [], duplicateIds: [], ageGateFailures: [], interactionFailures: [] };

try {
  for (const route of routes) {
    try {
      const response = await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 20000 });
      if (response && response.status() >= 400) { report.routeFailures.push({ route, status: response.status() }); continue; }
      const ageRequired = await page.locator("html").getAttribute("data-ed-age-required") === "true";
      if (ageRequired) {
        try {
          const dialog = page.locator('.ed-age-dialog[role="dialog"][aria-modal="true"]');
          await dialog.waitFor({ state: "visible", timeout: 5000 });
          const initialState = await page.evaluate(() => {
            const dialog = document.querySelector(".ed-age-dialog");
            const titleId = dialog?.getAttribute("aria-labelledby");
            const descriptionId = dialog?.getAttribute("aria-describedby");
            return {
              initialFocus: document.activeElement?.matches(".ed-age-confirm") === true,
              named: !!titleId && !!document.getElementById(titleId) && !!descriptionId && !!document.getElementById(descriptionId),
              backgroundInert: [".ed-header", ".ed-adult", ".ed-main", ".ed-footer", ".ed-skip-link"]
                .filter(selector => document.querySelector(selector))
                .every(selector => document.querySelector(selector).hasAttribute("inert"))
            };
          });
          if (!initialState.initialFocus || !initialState.named || !initialState.backgroundInert) {
            report.ageGateFailures.push({ route, stage: "initial", state: initialState });
          }
          await page.keyboard.press("Tab");
          const tabToExit = await page.evaluate(() => document.activeElement?.matches(".ed-age-exit") === true);
          await page.keyboard.press("Tab");
          const tabToConfirm = await page.evaluate(() => document.activeElement?.matches(".ed-age-confirm") === true);
          const ageConfirmFocusVisible = await page.locator(".ed-age-confirm").evaluate(el => {
            const style = getComputedStyle(el);
            return style.outlineStyle === "solid" && style.outlineColor === "rgb(227, 68, 157)" &&
              parseFloat(style.outlineWidth) >= 3;
          });
          await page.keyboard.press("Shift+Tab");
          const reverseToExit = await page.evaluate(() => document.activeElement?.matches(".ed-age-exit") === true);
          if (!tabToExit || !tabToConfirm || !ageConfirmFocusVisible || !reverseToExit) {
            report.ageGateFailures.push({ route, stage: "keyboard-trap", tabToExit, tabToConfirm, ageConfirmFocusVisible, reverseToExit });
          }
          await page.locator(".ed-age-confirm").click();
          await dialog.waitFor({ state: "detached", timeout: 5000 });
          const restored = await page.evaluate(() => ({
            focusReturned: document.activeElement === document.querySelector(".ed-main"),
            backgroundReleased: [".ed-header", ".ed-adult", ".ed-main", ".ed-footer", ".ed-skip-link"]
              .filter(selector => document.querySelector(selector))
              .every(selector => !document.querySelector(selector).hasAttribute("inert"))
          }));
          if (!restored.focusReturned || !restored.backgroundReleased) {
            report.ageGateFailures.push({ route, stage: "close", state: restored });
          }
        } catch (error) {
          report.ageGateFailures.push({ route, stage: "exception", error: String(error).slice(0, 240) });
        }
      }

      const issues = await page.evaluate(() => {
        const hidden = el => {
          if (el.closest("[hidden], [aria-hidden='true']")) return true;
          for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
            const s = getComputedStyle(n); if (s.display === "none" || s.visibility === "hidden") return true;
          }
          return false;
        };
        const name = el => {
          const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
          const linked = ids.map(id => document.getElementById(id)?.textContent || "").join(" ").trim();
          const direct = el.getAttribute("aria-label") || linked || el.getAttribute("title");
          if (direct?.trim()) return direct.trim();
          if (el.labels?.length) return [...el.labels].map(l => l.textContent || "").join(" ").trim();
          if (el.tagName === "INPUT" && ["submit", "button", "reset"].includes(el.type)) return el.value || "";
          if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return "";
          const text = (el.innerText || el.textContent || "").trim();
          if (text) return text;
          const imgAlt = [...el.querySelectorAll("img[alt]")].map(x => x.getAttribute("alt") || "").join(" ").trim();
          return imgAlt || [...el.querySelectorAll("svg title")].map(x => x.textContent || "").join(" ").trim();
        };
        return {
          language: document.documentElement.getAttribute("lang") || "",
          title: document.title.trim(),
          imagesWithoutAlt: [...document.images].filter(x => !hidden(x) && x.getAttribute("alt") === null).map(x => x.getAttribute("src") || ""),
          controlsWithoutName: [...document.querySelectorAll("a[href],button,summary,[role='button'],[role='link']")].filter(x => !hidden(x) && x.getClientRects().length && !name(x)).map(x => x.outerHTML.slice(0,160)),
          fieldsWithoutLabel: [...document.querySelectorAll("input:not([type='hidden']),select,textarea")].filter(x => !hidden(x) && x.getClientRects().length && !name(x)).map(x => x.outerHTML.slice(0,160)),
          framesWithoutTitle: [...document.querySelectorAll("iframe")].filter(x => !hidden(x) && !x.getAttribute("title")?.trim()).map(x => x.getAttribute("src") || ""),
          navigationWithoutName: location.pathname.startsWith("/educacao/")
            ? [...document.querySelectorAll("nav")].filter(nav => !nav.getAttribute("aria-label")?.trim() && !nav.getAttribute("aria-labelledby")?.trim()).map(nav => nav.outerHTML.slice(0,180))
            : [],
          headingStructureFailures: (() => {
            if (!location.pathname.startsWith("/educacao/")) return [];
            const headings = [...(document.querySelector("main")?.querySelectorAll("h1,h2,h3,h4,h5,h6") || [])]
              .map(el => ({ level: Number(el.tagName.slice(1)), text: (el.innerText || el.textContent || "").trim().slice(0,100) }));
            const h1Count = headings.filter(item => item.level === 1).length;
            const headingJump = headings.some((item,index) => index > 0 && item.level > headings[index - 1].level + 1);
            return h1Count === 1 && !headingJump ? [] : [{ h1Count, headingJump, headings }];
          })(),
          duplicateIds: location.pathname.startsWith("/educacao/")
            ? [...document.querySelectorAll("[id]")].map(el => el.id).filter((id,index,all) => all.indexOf(id) !== index)
            : []
        };
      });
      if (!issues.language) report.missingLanguage.push(route);
      if (!issues.title) report.missingTitle.push(route);
      for (const key of ["imagesWithoutAlt","controlsWithoutName","fieldsWithoutLabel","framesWithoutTitle","navigationWithoutName","headingStructureFailures","duplicateIds"]) {
        report[key].push(...issues[key].map(item => ({ route, item })));
      }
    } catch (e) { report.routeFailures.push({ route, error: String(e).slice(0,200) }); }
  }

  async function openEducationRoute(route) {
    await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 20000 });
    const dialog = page.locator('.ed-age-dialog[role="dialog"][aria-modal="true"]');
    if (await dialog.count()) {
      const ageButtonStyle = await page.locator(".ed-age-confirm").evaluate(el => {
        const style = getComputedStyle(el);
        return { color: style.color, background: style.backgroundColor };
      });
      if (ageButtonStyle.color !== "rgb(27, 18, 32)" || ageButtonStyle.background !== "rgb(227, 68, 157)") {
        report.interactionFailures.push({ route, ageButtonStyle });
      }
      await page.locator(".ed-age-confirm").click();
    }
    await page.waitForLoadState("domcontentloaded");
  }

  try {
    await openEducationRoute("/educacao/duvidas-frequentes/");
    const firstFaqItem = page.locator(".ed-faq-item").first();
    const faqSummary = firstFaqItem.locator("summary");
    await faqSummary.focus();
    const faqSummaryFocus = await faqSummary.evaluate(el => {
      const style = getComputedStyle(el);
      return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
    });
    await faqSummary.press("Enter");
    const faqOpenedByKeyboard = await firstFaqItem.evaluate(el => el.open);
    await page.keyboard.press("Tab");
    const faqRelatedLinkFocused = await firstFaqItem.locator(".ed-faq-related-link").first().evaluate(el => el === document.activeElement);
    await faqSummary.focus();
    await faqSummary.press("Space");
    const faqClosedByKeyboard = !(await firstFaqItem.evaluate(el => el.open));
    if (!faqSummaryFocus || !faqOpenedByKeyboard || !faqRelatedLinkFocused || !faqClosedByKeyboard) {
      report.interactionFailures.push({ route: "/educacao/duvidas-frequentes/", faqSummaryFocus, faqOpenedByKeyboard, faqRelatedLinkFocused, faqClosedByKeyboard });
    }

    const faqInput = page.locator("#faqSearch");
    await faqInput.focus();
    const faqFocus = await page.locator(".ed-faq-search-control").evaluate(el => {
      const style = getComputedStyle(el);
      return style.borderColor === "rgb(255, 138, 199)" && style.boxShadow.includes("0px 0px 0px 3px");
    });
    await faqInput.fill("termo-inexistente-luxuriosa");
    const noFaqResults = await page.locator("#faqSearchStatus").innerText();
    const noVisibleFaqItems = await page.locator(".ed-faq-item:not([hidden])").count();
    await faqInput.fill("Biblioteca de produtos");
    const relatedOnlyFaqItems = await page.locator(".ed-faq-item:not([hidden])").count();
    await faqInput.fill("lubrificante");
    const matchingFaqItems = await page.locator(".ed-faq-item:not([hidden])").count();
    await page.locator('.ed-faq-jump a[href^="#faq-"]').first().click();
    const restoredFaqItems = await page.locator(".ed-faq-item:not([hidden])").count();
    const faqStatusHidden = await page.locator("#faqSearchStatus").isHidden();
    if (!faqFocus || !noFaqResults.includes("Nenhuma pergunta encontrada") ||
        noVisibleFaqItems !== 0 || relatedOnlyFaqItems !== 0 || matchingFaqItems === 0 || restoredFaqItems === 0 || !faqStatusHidden) {
      report.interactionFailures.push({ route: "/educacao/duvidas-frequentes/", faqFocus, noFaqResults, noVisibleFaqItems, relatedOnlyFaqItems, matchingFaqItems, restoredFaqItems, faqStatusHidden });
    }

    await openEducationRoute("/educacao/");
    const discoveryButton = page.locator('[data-discovery="materials"]');
    await discoveryButton.focus();
    const discoveryFocus = await discoveryButton.evaluate(el => {
      const style = getComputedStyle(el);
      return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
    });
    await discoveryButton.press("Enter");
    const discovery = await page.evaluate(() => ({
      pressed: document.querySelector('[data-discovery="materials"]')?.getAttribute("aria-pressed"),
      result: document.querySelector("#edDiscoveryResult")?.innerText || "",
      link: document.querySelector("#edDiscoveryResult a")?.getAttribute("href") || ""
    }));
    if (!discoveryFocus || discovery.pressed !== "true" || !discovery.result.includes("Entenda os materiais") ||
        discovery.link !== "/educacao/curiosidades/materiais-dos-acessorios.html") {
      report.interactionFailures.push({ route: "/educacao/", discoveryFocus, discovery });
    }

    await openEducationRoute("/educacao/interatividade/");
    await page.locator("#quizCheck").focus();
    const interactivitySemantics = await page.evaluate(() => {
      const questions = Array.from(document.querySelectorAll("#knowledgeQuiz fieldset"));
      const radios = Array.from(document.querySelectorAll("#knowledgeQuiz input[type=radio]"));
      const ids = Array.from(document.querySelectorAll("[id]")).map(element => element.id);
      const quizResult = document.querySelector("#quizResult");
      const progress = document.querySelector("#checkProgressBar");
      const topicOutput = document.querySelector("#topicOutput");
      const primaryButton = document.querySelector("#quizCheck");
      const ghostButton = document.querySelector("#quizReset");
      const primaryButtonStyle = primaryButton ? getComputedStyle(primaryButton) : null;
      const ghostButtonStyle = ghostButton ? getComputedStyle(ghostButton) : null;
      const saveEyebrow = document.querySelector("#experienceSavePanel small");
      return {
        questionCount: questions.length,
        missingLegends: questions.filter(question => !question.querySelector(":scope > legend")?.textContent.trim()).length,
        radiosWithoutLabels: radios.filter(input => !input.labels || input.labels.length === 0).length,
        missingFeedbackReferences: questions.filter(question => {
          const describedBy = question.getAttribute("aria-describedby");
          return !describedBy || !document.getElementById(describedBy);
        }).length,
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index).length,
        topicFinderLabelled: Boolean(document.querySelector('label[for="topicFinder"]')),
        primaryButtonContrast: primaryButtonStyle?.color === "rgb(27, 18, 32)" &&
          primaryButtonStyle?.backgroundColor === "rgb(227, 68, 157)",
        primaryButtonFocusVisible: primaryButtonStyle?.outlineStyle === "solid" &&
          primaryButtonStyle?.outlineColor === "rgb(227, 68, 157)" &&
          parseFloat(primaryButtonStyle?.outlineWidth || "0") >= 3,
        ghostButtonContrast: ghostButtonStyle?.color === "rgb(73, 52, 81)" &&
          ghostButtonStyle?.borderColor === "rgb(119, 95, 130)",
        quizResultLive: quizResult?.getAttribute("role") === "status" && quizResult?.getAttribute("aria-live") === "polite",
        progressSemantics: progress?.getAttribute("role") === "progressbar" &&
          progress?.getAttribute("aria-valuemin") === "0" && progress?.getAttribute("aria-valuemax") === "10",
        topicOutputLive: topicOutput?.getAttribute("aria-live") === "polite",
        topicOutputContrast: getComputedStyle(topicOutput).color === "rgb(102, 91, 112)",
        savePanelNamed: document.querySelector("#experienceSavePanel")?.getAttribute("aria-labelledby") === "experienceSaveTitle",
        saveEyebrowContrast: getComputedStyle(saveEyebrow).color === "rgb(128, 96, 47)"
      };
    });
    if (interactivitySemantics.questionCount !== 21 || interactivitySemantics.missingLegends !== 0 ||
        interactivitySemantics.radiosWithoutLabels !== 0 || interactivitySemantics.missingFeedbackReferences !== 0 ||
        interactivitySemantics.duplicateIds !== 0 || !interactivitySemantics.topicFinderLabelled ||
        !interactivitySemantics.primaryButtonContrast || !interactivitySemantics.primaryButtonFocusVisible ||
        !interactivitySemantics.ghostButtonContrast || !interactivitySemantics.quizResultLive || !interactivitySemantics.progressSemantics ||
        !interactivitySemantics.topicOutputLive || !interactivitySemantics.topicOutputContrast ||
        !interactivitySemantics.savePanelNamed || !interactivitySemantics.saveEyebrowContrast) {
      report.interactionFailures.push({ route: "/educacao/interatividade/", interactivitySemantics });
    }

    await page.locator("#quizCheck").click();
    const partialQuiz = await page.locator("#quizResult").innerText();
    const feedbackCount = await page.locator("#knowledgeQuiz .ed-feedback:not([hidden])").count();
    await page.locator("#quizReset").click();
    await page.locator("#knowledgeQuiz .ed-question").evaluateAll(questions => {
      questions.forEach(question => {
        const answer = question.querySelector('input[type="radio"][value="' + question.dataset.answer + '"]');
        if (answer) answer.checked = true;
      });
    });
    await page.locator("#quizCheck").click();
    const completeQuiz = await page.locator("#quizResult").innerText();
    const completedFeedbackCount = await page.locator("#knowledgeQuiz .ed-feedback:not([hidden])").count();
    const journeyState = await page.evaluate(() => {
      const panel = document.querySelector(".ed-next-step");
      const eyebrow = panel?.querySelector(":scope > small");
      const primary = panel?.querySelector(".ed-next-step-actions > a:first-child");
      const secondary = panel?.querySelector(".ed-next-step-portal");
      return {
        visible: Boolean(panel && !panel.hidden),
        named: panel?.getAttribute("aria-labelledby") === "edNextStepTitle" &&
          Boolean(document.getElementById("edNextStepTitle")?.textContent.trim()),
        eyebrowColor: eyebrow ? getComputedStyle(eyebrow).color : "",
        primaryColor: primary ? getComputedStyle(primary).color : "",
        primaryBackground: primary ? getComputedStyle(primary).backgroundColor : "",
        secondaryColor: secondary ? getComputedStyle(secondary).color : ""
      };
    });
    await page.locator("#quizReset").focus();
    await page.keyboard.press("Tab");
    const journeyFocusVisible = await page.locator(".ed-next-step-actions > a:first-child").evaluate(el => {
      const style = getComputedStyle(el);
      return style.outlineStyle === "solid" && style.outlineColor === "rgb(227, 68, 157)" &&
        parseFloat(style.outlineWidth) >= 3;
    });
    await page.locator("#quizReset").click();
    const resetQuiz = await page.locator("#quizResult").innerText();
    if (!partialQuiz.includes("Você respondeu 0 de 21") || feedbackCount !== 21 ||
        !completeQuiz.includes("21 de 21") || completedFeedbackCount !== 21 || resetQuiz !== "" ||
        !journeyState.visible || !journeyState.named ||
        journeyState.eyebrowColor !== "rgb(128, 96, 47)" ||
        journeyState.primaryColor !== "rgb(27, 18, 32)" ||
        journeyState.primaryBackground !== "rgb(227, 68, 157)" ||
        journeyState.secondaryColor !== "rgb(102, 91, 112)" || !journeyFocusVisible) {
      report.interactionFailures.push({ route: "/educacao/interatividade/", partialQuiz, feedbackCount, completeQuiz, completedFeedbackCount, journeyState, journeyFocusVisible, resetQuiz });
    }

    await page.locator("[data-check]").nth(0).check();
    await page.locator("[data-check]").nth(1).check();
    await page.locator("[data-check]").nth(2).check();
    const checklist = await page.evaluate(() => ({
      count: document.querySelector("#checkCount")?.textContent || "",
      value: document.querySelector("#checkProgressBar")?.getAttribute("aria-valuenow"),
      text: document.querySelector("#checkProgressBar")?.getAttribute("aria-valuetext")
    }));
    await page.locator("#topicFinder").selectOption("lube");
    await page.locator("#topicGo").click();
    const topicLink = await page.locator("#topicOutput a").getAttribute("href");
    const topicLinkColor = await page.locator("#topicOutput a").evaluate(el => getComputedStyle(el).color);
    await page.locator("#topicGo").focus();
    await page.keyboard.press("Tab");
    const topicLinkFocusVisible = await page.locator("#topicOutput a").evaluate(el => {
      const style = getComputedStyle(el);
      return el === document.activeElement && style.outlineStyle === "solid" &&
        style.outlineColor === "rgb(227, 68, 157)" && parseFloat(style.outlineWidth) >= 3;
    });
    if (!checklist.count.includes("3 de 10") || checklist.value !== "3" ||
        checklist.text !== "3 de 10 itens conferidos" ||
        topicLink !== "/educacao/guias/escolher-lubrificante.html" ||
        topicLinkColor !== "rgb(128, 96, 47)" || !topicLinkFocusVisible) {
      report.interactionFailures.push({ route: "/educacao/interatividade/", checklist, topicLink, topicLinkColor, topicLinkFocusVisible });
    }
  } catch (error) {
    report.interactionFailures.push({ route: "education-interactions", error: String(error).slice(0, 300) });
  }
} finally { await browser.close(); }

const counts = Object.fromEntries(Object.entries(report).map(([key, value]) => [key, value.length]));
console.log("Acessibilidade estrutural:", JSON.stringify({ routes: routes.length, ...counts }));
if (reportPath) { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); }
for (const key of Object.keys(report)) assert.equal(report[key].length, 0, key + ": " + JSON.stringify(report[key].slice(0,15)));
console.log("Acessibilidade estrutural Playwright: PASS.");
