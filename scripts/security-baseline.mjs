import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const forbiddenPath = /(^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.wrangler)(?:\/|$)|\.(?:pem|key|p12|pfx|jks|dump|backup|bak)$/i;
const allowPath = /(^|\/)\.env\.example$/i;
const textExtensions = new Set([
  ".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".json", ".jsonc", ".toml", ".yaml", ".yml", ".md", ".txt",
  ".sql", ".css", ".scss", ".xml", ".sh", ".ps1", ".py"
]);

const secretPatterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["provider-secret", /\b(?:sk_live|sk_test|whsec|re)_[A-Za-z0-9_-]{20,}\b/],
  ["supabase-jwt", /\beyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
  ["secret-env-assignment", /\b(?:SUPABASE_SERVICE_ROLE_KEY|INFINITEPAY_API_KEY|RESEND_API_KEY|CLOUDFLARE_API_TOKEN|SMTP_PASS|POSTGRES_PASSWORD)\s*[:=]\s*["'](?!\$\{)[A-Za-z0-9_./+=-]{16,}["']/]
];

const findings = [];
for (const path of tracked) {
  if (forbiddenPath.test(path) && !allowPath.test(path)) {
    findings.push({ path, rule: "sensitive-file-tracked" });
    continue;
  }

  if (!textExtensions.has(extname(path).toLowerCase())) continue;

  let size;
  try {
    size = statSync(path).size;
  } catch {
    findings.push({ path, rule: "tracked-file-unreadable" });
    continue;
  }
  if (size > 2 * 1024 * 1024) continue;

  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    findings.push({ path, rule: "tracked-file-unreadable" });
    continue;
  }
  if (content.includes("\0")) continue;

  for (const [rule, pattern] of secretPatterns) {
    if (pattern.test(content)) findings.push({ path, rule });
  }
}

if (findings.length) {
  console.error("Security baseline failed. Potential sensitive material was found:");
  for (const finding of findings) console.error("- " + finding.path + " [" + finding.rule + "]");
  console.error("Values are intentionally omitted. Review locally and rotate exposed credentials when necessary.");
  process.exitCode = 1;
} else {
  console.log("Security baseline passed: no known secret patterns or sensitive local files are tracked.");
}
