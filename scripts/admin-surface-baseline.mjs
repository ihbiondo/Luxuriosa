import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const failures = [];

function read(path) {
  try {
    return readFileSync(resolve(process.cwd(), path), "utf8");
  } catch (error) {
    failures.push(`Required file missing or unreadable: ${path} (${error.message})`);
    return "";
  }
}

function requireMatch(path, source, pattern, message) {
  if (source && !pattern.test(source)) failures.push(`${path}: ${message}`);
}

const configPath = "wrangler.jsonc";
const config = read(configPath);
requireMatch(configPath, config, /"workers_dev"\s*:\s*false\b/, "workers_dev must remain disabled.");
requireMatch(configPath, config, /"preview_urls"\s*:\s*false\b/, "preview_urls must remain disabled.");

const workerPath = "cloudflare/lux-gestao-worker.mjs";
const worker = read(workerPath);
requireMatch(workerPath, worker, /APP_SOURCE_URL\s*=\s*["']https:\/\/raw\.githubusercontent\.com\/ihbiondo\/Luxuriosa\/main\/previa\/lux-gestao\/index\.html["']/, "the production app source must be a fixed GitHub Raw URL.");
requireMatch(workerPath, worker, /fetch\(APP_SOURCE_URL,\s*\{/, "the Worker must fetch only the fixed source URL.");
requireMatch(workerPath, worker, /redirect:\s*["']error["']/, "the upstream fetch must reject redirects.");
requireMatch(workerPath, worker, /Response\.redirect\(["']https:\/\/luxuriosa\.com\.br\/lux-gestao\/["'],\s*308\)/, "the short route must redirect to the canonical host.");
requireMatch(workerPath, worker, /APP_ROUTES\s*=\s*new Set\(\[["']\/lux-gestao\/["'],\s*["']\/lux-gestao\/index\.html["']\]\)/, "the production worker must keep an explicit, narrow route allowlist.");
requireMatch(workerPath, worker, /request\.method !== ["']GET["'] && request\.method !== ["']HEAD["']/, "the worker must reject methods other than GET/HEAD.");

if (/LUX_ACCESS_SERVICE_TOKEN|CF-Access-Client-(?:Id|Secret)|APP_SOURCE_URL\s*=\s*new URL|sourceUrl\.pathname/i.test(worker)) {
  failures.push(`${workerPath}: obsolete service-token forwarding or request-derived upstream source found.`);
}

for (const header of [
  /Cache-Control["'],\s*["']private, no-store, max-age=0["']/,
  /X-Content-Type-Options["'],\s*["']nosniff["']/,
  /X-Frame-Options["'],\s*["']DENY["']/,
  /Referrer-Policy["'],\s*["']strict-origin-when-cross-origin["']/
]) {
  requireMatch(workerPath, worker, header, `required response security header missing: ${header}`);
}

const adminPages = [
  "previa/lux-gestao/index.html",
  "previa/lux-gestao-pedidos/index.html",
  "previa/lux-central/index.html"
];

for (const path of adminPages) {
  const html = read(path);
  requireMatch(path, html, /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i, "admin interface must remain excluded from indexing (not an access control).");
  requireMatch(path, html, /signInWithPassword/, "Supabase sign-in flow is missing.");
  requireMatch(path, html, /supabase\.auth\.getSession/, "initial session check is missing.");
  requireMatch(path, html, /sb_publishable_[A-Za-z0-9_-]+/, "expected publishable Supabase key not found.");
  requireMatch(path, html, /functions\.invoke|\/functions\/v1\//, "expected backend API integration marker not found.");

  if (/SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_[A-Za-z0-9_-]+|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(html)) {
    failures.push(`${path}: privileged Supabase credential or JWT-like secret pattern appears in browser source.`);
  }
}

if (failures.length) {
  console.error("Administrative surface baseline failed:");
  for (const failure of failures) console.error("- " + failure);
  console.error("This check protects selected source-code invariants. It does not verify Cloudflare Access policies or replace server-side authorization.");
  process.exitCode = 1;
} else {
  console.log("Administrative surface baseline passed.");
  console.log("Note: Cloudflare Access and hosted authorization policies still require independent configuration and review.");
}
