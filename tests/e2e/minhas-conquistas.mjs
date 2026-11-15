import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SERVICE_ROLE_KEY;
const PASSWORD = "E2E-Only-2026!";

assert.ok(SUPABASE_URL, "E2E_SUPABASE_URL ausente.");
assert.ok(SERVICE_ROLE_KEY, "E2E_SERVICE_ROLE_KEY ausente.");

async function createTestUser(label) {
  const email = `minhas-conquistas-${label.toLowerCase()}@example.com`;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: `Conta E2E ${label}`,
        account_setup_completed: true
      }
    })
  });

  const payload = await response.json();
  assert.ok(response.ok, `Não foi possível criar usuário de teste: ${JSON.stringify(payload)}`);
  assert.ok(payload.id, "A API local não retornou o ID do usuário.");
  return { id: payload.id, email };
}

async function login(page, email, expectedPath) {
  await page.locator("#loginEmail").fill(email);
  await page.locator("#loginPassword").fill(PASSWORD);
  await Promise.all([
    page.waitForURL(url => url.pathname === expectedPath, { timeout: 30000 }),
    page.locator('#loginForm button[type="submit"]').click()
  ]);
}

async function confirmAgeGate(page) {
  const confirm = page.locator("#ageConfirm");
  if (await confirm.count()) {
    await confirm.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
  }
}

async function completeDiscovery(page, saveResult) {
  await page.locator('[data-experience="discovery"]').click();
  await page.locator("#experienceStart").click();

  for (let index = 0; index < 15; index += 1) {
    await page.locator("#experienceOptions button").first().click();
    await page.locator("#experienceNext").click();
  }

  await page.locator("#experienceResult").waitFor({ state: "visible", timeout: 15000 });

  const savePanel = page.locator("#experienceSavePanel");
  if (!saveResult) {
    await page.waitForTimeout(350);
    assert.equal(
      await savePanel.evaluate(element => element.hidden),
      true,
      "Visitante ou conta sem aceite não deve receber o painel para salvar."
    );
    await page.locator("#experienceDone").click();
    return;
  }

  await savePanel.waitFor({ state: "visible", timeout: 15000 });
  const saveButton = page.locator("#experienceSaveButton");
  await saveButton.click();
  await page.locator("#experienceSaveStatus").waitFor({ state: "visible", timeout: 15000 });
  assert.match(
    await page.locator("#experienceSaveStatus").innerText(),
    /salvo no seu histórico privado/i,
    "A interface não confirmou o salvamento do resultado."
  );
  await page.locator("#experienceDone").click();
}

const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR || "";

async function captureScreenshot(page, filename) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${filename}.png`,
    fullPage: true,
    animations: "disabled"
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  assert.ok(
    dimensions.document <= dimensions.viewport + 1 &&
      dimensions.body <= dimensions.viewport + 1,
    label + ": conteúdo excedeu a largura da tela (" + JSON.stringify(dimensions) + ")."
  );
}

async function acceptTerms(page) {
  await page.locator("#conquistasTermsGate").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(
    await page.locator("#conquistasMain").evaluate(element => element.hidden),
    true,
    "O painel de conquistas precisa ficar oculto antes do aceite."
  );
  await page.locator("#conquistasTermsCheckbox").check();
  await page.locator("#conquistasAcceptTerms").click();
  await page.locator("#conquistasMain").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#conquistasEmpty").waitFor({ state: "visible", timeout: 15000 });
}

async function readResultsForUser(userId) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/experience_results`);
  url.searchParams.set("select", "*");
  url.searchParams.set("user_id", `eq.${userId}`);
  const response = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`
    }
  });
  assert.ok(response.ok, `Consulta administrativa local falhou: ${response.status}`);
  return response.json();
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

let contextA;
let contextB;

try {
  // 1. Visitante anônimo: consegue concluir uma experiência, mas não recebe o salvamento.
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(`${BASE_URL}/experiencias/`, { waitUntil: "domcontentloaded" });
  await confirmAgeGate(anonymousPage);
  await completeDiscovery(anonymousPage, false);
  await anonymousContext.close();

  // 2. Acesso direto sem sessão conduz ao login e volta ao destino solicitado.
  const userA = await createTestUser("A");
  contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto(`${BASE_URL}/portal/conquistas/`, { waitUntil: "domcontentloaded" });
  await pageA.waitForURL(url => url.pathname.endsWith("/login.html"), { timeout: 15000 });
  assert.equal(new URL(pageA.url()).searchParams.get("next"), "portal/conquistas/");
  await login(pageA, userA.email, "/portal/conquistas/");
  await pageA.locator("#conquistasTermsGate").waitFor({ state: "visible", timeout: 15000 });

  // 3. Autenticado sem aceite: experiências públicas continuam disponíveis, sem salvar.
  await pageA.goto(`${BASE_URL}/experiencias/`, { waitUntil: "domcontentloaded" });
  await confirmAgeGate(pageA);
  await completeDiscovery(pageA, false);

  // 4. Portal mostra ativação opcional; somente após o aceite abre o painel.
  await pageA.goto(`${BASE_URL}/portal/`, { waitUntil: "domcontentloaded" });
  await pageA.locator("#portalAchievementsActivationCard").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(
    await pageA.locator("#portalAchievementsCard").evaluate(element => element.hidden),
    true,
    "O atalho de conquistas não deve aparecer antes do aceite."
  );
  await pageA.locator("#portalAchievementsActivationCard").click();
  await acceptTerms(pageA);

  // 5. Conta A salva duas tentativas da mesma atividade: duas entradas, apenas 10 pontos.
  await pageA.goto(`${BASE_URL}/experiencias/`, { waitUntil: "domcontentloaded" });
  await confirmAgeGate(pageA);
  await completeDiscovery(pageA, true);
  await completeDiscovery(pageA, true);

  const savedByA = await readResultsForUser(userA.id);
  assert.equal(savedByA.length, 2, "As duas tentativas devem ficar no histórico da conta A.");
  const allowedColumns = [
    "id", "user_id", "attempt_id", "activity_id", "activity_title",
    "category", "result_title", "result_summary", "score", "score_max", "created_at"
  ].sort();
  assert.deepEqual(Object.keys(savedByA[0]).sort(), allowedColumns,
    "O registro persistido deve conter somente os campos resumidos permitidos.");
  assert.ok(savedByA.every(row => row.activity_id === "discovery"));

  await pageA.goto(`${BASE_URL}/portal/conquistas/`, { waitUntil: "domcontentloaded" });
  await pageA.locator("#conquistasMain").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await pageA.locator("#conquistasPoints").innerText(), "10");
  assert.equal(await pageA.locator("#conquistasActivities").innerText(), "1");
  assert.equal(await pageA.locator("#conquistasSaved").innerText(), "2");

  // Captura de desktop com resultados sintéticos preenchidos no fluxo E2E.
  await pageA.setViewportSize({ width: 1440, height: 1000 });
  await assertNoHorizontalOverflow(pageA, "Histórico desktop em 1440 px");
  await captureScreenshot(pageA, "dashboard-historico-desktop-1440");

  // 6. Conta B recebe seu próprio painel vazio, sem enxergar os resultados de A.
  const userB = await createTestUser("B");
  contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(`${BASE_URL}/login.html?next=portal%2F`, { waitUntil: "domcontentloaded" });
  await login(pageB, userB.email, "/portal/");
  await pageB.locator("#portalAchievementsActivationCard").waitFor({ state: "visible", timeout: 15000 });
  await pageB.setViewportSize({ width: 390, height: 844 });
  await pageB.goto(`${BASE_URL}/portal/conquistas/`, { waitUntil: "domcontentloaded" });
  await pageB.locator("#conquistasTermsGate").waitFor({ state: "visible", timeout: 15000 });
  await assertNoHorizontalOverflow(pageB, "Gate de aceite em 390 px");
  const gateButtonColors = await pageB.locator("#conquistasAcceptTerms").evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color
  }));
  assert.notEqual(gateButtonColors.background, "rgba(0, 0, 0, 0)",
    "Botão de aceite deve possuir fundo visível.");
  await captureScreenshot(pageB, "gate-aceite-mobile-390");
  await pageB.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(pageB, "Gate de aceite em 320 px");
  await pageB.setViewportSize({ width: 390, height: 844 });
  await acceptTerms(pageB);
  await assertNoHorizontalOverflow(pageB, "Painel de conquistas em 390 px");
  await captureScreenshot(pageB, "dashboard-vazio-mobile-390");
  const mobileColumns = await pageB.locator("#conquistasBadges").evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.split(" ").length
  );
  assert.equal(mobileColumns, 2, "Em celular, os emblemas devem ficar em duas colunas.");
  await pageB.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(pageB, "Painel de conquistas em 320 px");
  await captureScreenshot(pageB, "dashboard-vazio-mobile-320");
  await pageB.setViewportSize({ width: 1440, height: 900 });
  await assertNoHorizontalOverflow(pageB, "Painel de conquistas em desktop");
  await captureScreenshot(pageB, "dashboard-vazio-desktop-1440");
  assert.equal(await pageB.locator("#conquistasPoints").innerText(), "0");
  assert.equal(await pageB.locator("#conquistasSaved").innerText(), "0");
  assert.equal(await pageB.locator("#conquistasHistory").evaluate(element => element.children.length), 0);
  assert.equal((await readResultsForUser(userB.id)).length, 0);

  // 7. Revogar o aceite de A apaga seu histórico; o painel volta a ficar bloqueado.
  await pageA.goto(`${BASE_URL}/portal/conquistas/`, { waitUntil: "domcontentloaded" });
  await pageA.locator("#conquistasMain").waitFor({ state: "visible", timeout: 15000 });
  pageA.once("dialog", dialog => dialog.accept());
  await pageA.locator("#conquistasDeactivate").click();
  await pageA.locator("#conquistasTermsGate").waitFor({ state: "visible", timeout: 15000 });
  assert.match(
    await pageA.locator("#conquistasGateStatus").innerText(),
    /histórico salvo foi apagado/i
  );
  assert.equal((await readResultsForUser(userA.id)).length, 0);
  assert.equal(await pageA.locator("#conquistasMain").evaluate(element => element.hidden), true);

  // A revogação de A não altera a conta B.
  await pageB.reload({ waitUntil: "domcontentloaded" });
  await pageB.locator("#conquistasMain").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await pageB.locator("#conquistasPoints").innerText(), "0");

  console.log("E2E Minhas conquistas: PASS — visitante, login, consentimento, salvamento, pontuação, isolamento e revogação.");
} finally {
  await contextA?.close();
  await contextB?.close();
  await browser.close();
}
