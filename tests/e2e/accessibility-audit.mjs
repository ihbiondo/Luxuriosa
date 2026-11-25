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
const report = { routeFailures: [], missingLanguage: [], missingTitle: [], imagesWithoutAlt: [], controlsWithoutName: [], fieldsWithoutLabel: [], framesWithoutTitle: [] };

try {
  for (const route of routes) {
    try {
      const response = await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 20000 });
      if (response && response.status() >= 400) { report.routeFailures.push({ route, status: response.status() }); continue; }
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
} finally { await browser.close(); }

const counts = Object.fromEntries(Object.entries(report).map(([key, value]) => [key, value.length]));
console.log("Acessibilidade estrutural:", JSON.stringify({ routes: routes.length, ...counts }));
if (reportPath) { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); }
for (const key of Object.keys(report)) assert.equal(report[key].length, 0, key + ": " + JSON.stringify(report[key].slice(0,15)));
console.log("Acessibilidade estrutural Playwright: PASS.");
