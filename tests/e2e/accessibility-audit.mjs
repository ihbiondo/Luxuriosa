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
const report = { routeFailures: [], missingLanguage: [], missingTitle: [], imagesWithoutAlt: [], controlsWithoutName: [], fieldsWithoutLabel: [], framesWithoutTitle: [], ageGateFailures: [], interactionFailures: [] };

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
          await page.keyboard.press("Shift+Tab");
          const reverseToExit = await page.evaluate(() => document.activeElement?.matches(".ed-age-exit") === true);
          if (!tabToExit || !tabToConfirm || !reverseToExit) {
            report.ageGateFailures.push({ route, stage: "keyboard-trap", tabToExit, tabToConfirm, reverseToExit });
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
          framesWithoutTitle: [...document.querySelectorAll("iframe")].filter(x => !hidden(x) && !x.getAttribute("title")?.trim()).map(x => x.getAttribute("src") || "")
        };
      });
      if (!issues.language) report.missingLanguage.push(route);
      if (!issues.title) report.missingTitle.push(route);
      for (const key of ["imagesWithoutAlt","controlsWithoutName","fieldsWithoutLabel","framesWithoutTitle"]) {
        report[key].push(...issues[key].map(item => ({ route, item })));
      }
    } catch (e) { report.routeFailures.push({ route, error: String(e).slice(0,200) }); }
  }

  async function openEducationRoute(route) {
    await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 20000 });
    const dialog = page.locator('.ed-age-dialog[role="dialog"][aria-modal="true"]');
    if (await dialog.count()) await page.locator(".ed-age-confirm").click();
    await page.waitForLoadState("domcontentloaded");
  }

  try {
    await openEducationRoute("/educacao/duvidas-frequentes/");
    const faqInput = page.locator("#faqSearch");
    await faqInput.focus();
    const faqFocus = await page.locator(".ed-faq-search-control").evaluate(el => {
      const style = getComputedStyle(el);
      return style.borderColor !== "rgb(187, 163, 206)" || style.boxShadow !== "none";
    });
    await faqInput.fill("termo-inexistente-luxuriosa");
    const noFaqResults = await page.locator("#faqSearchStatus").innerText();
    const noVisibleFaqItems = await page.locator(".ed-faq-item:not([hidden])").count();
    await faqInput.fill("lubrificante");
    const matchingFaqItems = await page.locator(".ed-faq-item:not([hidden])").count();
    await faqInput.fill("");
    const restoredFaqItems = await page.locator(".ed-faq-item:not([hidden])").count();
    if (!faqFocus || !noFaqResults.includes("Nenhuma pergunta encontrada") ||
        noVisibleFaqItems !== 0 || matchingFaqItems === 0 || restoredFaqItems === 0) {
      report.interactionFailures.push({ route: "/educacao/duvidas-frequentes/", faqFocus, noFaqResults, noVisibleFaqItems, matchingFaqItems, restoredFaqItems });
    }

    await openEducationRoute("/educacao/");
    await page.locator('[data-discovery="materials"]').click();
    const discovery = await page.evaluate(() => ({
      pressed: document.querySelector('[data-discovery="materials"]')?.getAttribute("aria-pressed"),
      result: document.querySelector("#edDiscoveryResult")?.innerText || "",
      link: document.querySelector("#edDiscoveryResult a")?.getAttribute("href") || ""
    }));
    if (discovery.pressed !== "true" || !discovery.result.includes("Entenda os materiais") ||
        discovery.link !== "/educacao/curiosidades/materiais-dos-acessorios.html") {
      report.interactionFailures.push({ route: "/educacao/", discovery });
    }

    await openEducationRoute("/educacao/interatividade/");
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
    await page.locator("#quizReset").click();
    const resetQuiz = await page.locator("#quizResult").innerText();
    if (!partialQuiz.includes("Você respondeu 0 de 21") || feedbackCount !== 21 ||
        !completeQuiz.includes("21 de 21") || completedFeedbackCount !== 21 || resetQuiz !== "") {
      report.interactionFailures.push({ route: "/educacao/interatividade/", partialQuiz, feedbackCount, completeQuiz, completedFeedbackCount, resetQuiz });
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
    if (!checklist.count.includes("3 de 10") || checklist.value !== "3" ||
        checklist.text !== "3 de 10 itens conferidos" ||
        topicLink !== "/educacao/guias/escolher-lubrificante.html") {
      report.interactionFailures.push({ route: "/educacao/interatividade/", checklist, topicLink });
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
