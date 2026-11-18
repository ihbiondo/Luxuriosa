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
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active && typeof active.blur === "function") active.blur();
    document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
    const header = document.querySelector(".header");
    if (header) {
      header.style.setProperty("position", "static", "important");
      header.style.setProperty("top", "auto", "important");
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(50);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${filename}.png`,
    fullPage: true,
    animations: "disabled"
  });
  await page.evaluate(() => {
    document.documentElement.style.removeProperty("scroll-behavior");
    const header = document.querySelector(".header");
    if (header) {
      header.style.removeProperty("position");
      header.style.removeProperty("top");
    }
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

async function completeKnowledgeQuiz(page) {
  await page.goto(`${BASE_URL}/educacao/interatividade/`, { waitUntil: "domcontentloaded" });
  const questions = page.locator("#knowledgeQuiz .ed-question");
  const total = await questions.count();
  assert.equal(total, 21, "O quiz deve apresentar as 21 questões previstas.");

  for (let index = 0; index < total; index += 1) {
    const question = questions.nth(index);
    const answer = await question.getAttribute("data-answer");
    await question.locator(`input[type="radio"][value="${answer}"]`).check();
  }

  await page.locator("#quizCheck").click();
  await page.locator("#quizResult").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await page.locator("#quizResult").innerText(), /21 de 21 respostas corretas/i);

  const nextStep = page.locator(".ed-next-step");
  await nextStep.waitFor({ state: "visible", timeout: 10000 });
  const nextLinks = await nextStep.locator("a[href]").evaluateAll(links =>
    links.map(link => link.getAttribute("href"))
  );
  assert.ok(
    nextLinks.some(href => href === "/experiencias/" || href === "/educacao/"),
    "Ao concluir o quiz, deve surgir ao menos uma rota relevante de continuidade. Encontradas: " + nextLinks.join(", ")
  );

  await page.locator("#experienceSavePanel").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#experienceSaveButton").click();
  await page.locator("#experienceSaveStatus").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await page.locator("#experienceSaveStatus").innerText(), /salvo no seu histórico privado/i);
}

async function completeSolarSign(page) {
  await page.goto(`${BASE_URL}/experiencias/signos.html`, { waitUntil: "domcontentloaded" });
  await confirmAgeGate(page);
  await page.locator("#birthDate").fill("1990-05-01");
  await page.locator("#signForm button[type=submit]").click();
  await page.locator("#signResult").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#signJourney").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(
    await page.locator("#signJourneyLinkOne").getAttribute("href"),
    "#compatibilityForm",
    "Após descobrir o signo solar, a próxima etapa deve oferecer a comparação de combinações."
  );
  assert.equal(
    await page.locator("#signJourney").evaluate(element => element.nextElementSibling?.id),
    "experienceSavePanel",
    "A opção de salvar deve ficar imediatamente junto ao resultado e ao próximo passo."
  );
  await page.locator("#experienceSavePanel").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#experienceSaveButton").click();
  await page.locator("#experienceSaveStatus").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await page.locator("#experienceSaveStatus").innerText(), /salvo no seu histórico privado/i);

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page, "Leitura solar e próximo passo em 390 px");
  await captureScreenshot(page, "signo-solar-proximo-passo-mobile-390");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertNoHorizontalOverflow(page, "Leitura solar e próximo passo em 1440 px");
  await captureScreenshot(page, "signo-solar-proximo-passo-desktop-1440");
}

async function completeSignCompatibility(page) {
  // Começa uma sessão visual limpa após o teste anterior de fuso inválido.
  await page.goto(`${BASE_URL}/experiencias/signos.html`, { waitUntil: "domcontentloaded" });
  await confirmAgeGate(page);
  await page.locator("#signOne").selectOption("aries");
  await page.locator("#signTwo").selectOption("leo");
  await page.locator('#compatibilityForm button[type="submit"]').click();
  await page.locator("#compatibilityResult").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#signJourney").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(
    await page.locator("#signJourneyLinkOne").getAttribute("href"),
    "/educacao/temas/relacoes-saudaveis-e-comunicacao.html",
    "Após a compatibilidade, a próxima etapa deve sugerir conteúdo contextual sobre relações saudáveis."
  );
  assert.equal(
    await page.locator("#signJourney").evaluate(element => element.nextElementSibling?.id),
    "experienceSavePanel",
    "A opção de salvar deve acompanhar a recomendação da compatibilidade."
  );
  await page.locator("#experienceSavePanel").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#experienceSaveButton").click();
  await page.locator("#experienceSaveStatus").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await page.locator("#experienceSaveStatus").innerText(), /salvo no seu histórico privado/i);

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page, "Compatibilidade e próximo passo em 390 px");
  await captureScreenshot(page, "compatibilidade-proximo-passo-mobile-390");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertNoHorizontalOverflow(page, "Compatibilidade e próximo passo em 1440 px");
  await captureScreenshot(page, "compatibilidade-proximo-passo-desktop-1440");
}


async function auditCartAndCheckout(page) {
  // Bloqueia a integração analítica hospedada; o teste não deve gravar eventos reais.
  await page.route("https://byiykxfugvxuowueuxca.supabase.co/functions/v1/cart-orders", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, test: true })
    })
  );

  // Usa somente um produto real do catálogo local; não cria pedido nem inicia pagamento.
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`${BASE_URL}/loja.html`, { waitUntil: "domcontentloaded" });

  const product = await page.evaluate(async () => {
    const response = await fetch("/data/produtos.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Não foi possível carregar o catálogo local.");
    const catalog = await response.json();
    const item = catalog.produtos.find(product => String(product.id) === "31");
    if (!item) throw new Error("O produto de referência 31 não está no catálogo.");
    return {
      id: String(item.id),
      nome: item.nome,
      preco: item.preco,
      imagem: item.imagem || "",
      categoria: item.categoria || "",
      tamanhos: item.tamanhos || "",
      quantidade: 1
    };
  });

  assert.ok(Number.isFinite(product.preco) && product.preco > 0,
    "O produto usado no teste deve ter preço válido.");
  await page.evaluate(item => {
    localStorage.removeItem("luxuriosa_carrinho");
    localStorage.setItem("luxuriosa_carrinho", JSON.stringify([item]));
  }, product);

  await page.goto(`${BASE_URL}/loja.html?abrirCarrinho=1#catalogo`, {
    waitUntil: "domcontentloaded"
  });

  const localAuthSession = await page.evaluate(() => {
    return Object.keys(localStorage)
      .filter(key => /^sb-.*-auth-token$/.test(key))
      .some(key => {
        try {
          const value = JSON.parse(localStorage.getItem(key) || "null");
          return Boolean(value && value.access_token);
        } catch (_) {
          return false;
        }
      });
  });
  assert.ok(localAuthSession,
    "A sessão autenticada da conta E2E deve permanecer disponível no checkout.");

  // Aceita o aviso etário somente no navegador descartável do teste.
  const ageButtons = ["#gateYes", "#ageConfirm"];
  for (const selector of ageButtons) {
    const button = page.locator(selector);
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      break;
    }
  }

  await page.locator("#cart.open").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(() => {
    const checkout = document.querySelector("#cartCheckout");
    return checkout && !checkout.disabled;
  }, null, { timeout: 20000 });

  assert.equal(await page.locator("#cartCount").innerText(), "1",
    "O carrinho deve mostrar uma unidade do produto de teste.");
  assert.equal(await page.locator("#cartItems .cart-item").count(), 1,
    "O carrinho deve renderizar exatamente o produto selecionado.");

  async function inspectCart(label) {
    const metrics = await page.evaluate(() => {
      const drawer = document.querySelector("#cart");
      const items = document.querySelector("#cartItems");
      const close = document.querySelector("#cartClose");
      const checkout = document.querySelector("#cartCheckout");
      const box = element => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      };
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        drawer: box(drawer),
        drawerClientWidth: drawer?.clientWidth || 0,
        drawerScrollWidth: drawer?.scrollWidth || 0,
        items: box(items),
        close: box(close),
        checkout: box(checkout)
      };
    });
    assert.ok(metrics.document <= metrics.viewport + 1,
      label + ": documento excedeu a largura do celular: " + JSON.stringify(metrics));
    assert.ok(metrics.drawer && metrics.drawer.left >= -1 &&
      metrics.drawer.right <= metrics.viewport + 1,
      label + ": gaveta do carrinho saiu da tela: " + JSON.stringify(metrics));
    assert.ok(metrics.drawerScrollWidth <= metrics.drawerClientWidth + 1,
      label + ": conteúdo interno da gaveta criou rolagem horizontal: " + JSON.stringify(metrics));
    assert.ok(metrics.checkout && metrics.checkout.left >= -1 &&
      metrics.checkout.right <= metrics.viewport + 1,
      label + ": botão de checkout saiu da tela: " + JSON.stringify(metrics));
    return metrics;
  }

  await inspectCart("Carrinho em 320 px");
  await captureScreenshot(page, "carrinho-gaveta-mobile-320");

  await page.setViewportSize({ width: 390, height: 844 });
  await inspectCart("Carrinho em 390 px");
  await captureScreenshot(page, "carrinho-gaveta-mobile-390");

  // Verifica a atualização da quantidade e do subtotal sem enviar nenhum pedido.
  await page.locator('#cartItems .cart-qty-btn[aria-label^="Aumentar quantidade"]').click();
  await page.waitForFunction(() => document.querySelector("#cartCount")?.textContent === "2");
  assert.equal(await page.locator("#cartItems .cart-qty").innerText(), "2",
    "O controle de quantidade deve atualizar o item na gaveta.");

  // A conta A já está autenticada no Supabase descartável deste E2E.
  // A etapa registra apenas a abertura do checkout; nenhum dado é enviado.
  await page.evaluate(() => {
    if (window.LuxuriosaInteligencia &&
        typeof window.LuxuriosaInteligencia.registrarEtapa === "function") {
      window.LuxuriosaInteligencia.registrarEtapa = () => Promise.resolve();
    }
  });
  await page.locator("#cartCheckout").click();
  await page.locator("#customerOverlay:not([hidden])").waitFor({
    state: "visible",
    timeout: 20000
  });

  async function inspectCheckout(label) {
    const metrics = await page.evaluate(() => {
      const overlay = document.querySelector("#customerOverlay");
      const dialog = overlay?.querySelector(".customer-dialog");
      const rect = dialog?.getBoundingClientRect();
      const fields = [...(dialog?.querySelectorAll("input, select, textarea, button") || [])]
        .filter(element => !element.hidden && element.getClientRects().length)
        .map(element => {
          const box = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id,
            left: Math.round(box.left),
            right: Math.round(box.right),
            width: Math.round(box.width)
          };
        });
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        overlayVisible: Boolean(overlay && !overlay.hidden),
        dialog: rect ? {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        } : null,
        fields
      };
    });
    assert.ok(metrics.overlayVisible, label + ": etapa de dados não abriu.");
    assert.ok(metrics.document <= metrics.viewport + 1,
      label + ": página excedeu a largura da tela: " + JSON.stringify(metrics));
    assert.ok(metrics.dialog && metrics.dialog.left >= -1 &&
      metrics.dialog.right <= metrics.viewport + 1,
      label + ": formulário saiu da largura da tela: " + JSON.stringify(metrics));
    const overflowingFields = metrics.fields.filter(field =>
      field.left < metrics.dialog.left - 1 || field.right > metrics.dialog.right + 1
    );
    assert.equal(overflowingFields.length, 0,
      label + ": campos ultrapassaram o formulário: " + JSON.stringify(overflowingFields));
    return metrics;
  }

  await page.setViewportSize({ width: 320, height: 740 });
  await inspectCheckout("Checkout em 320 px");
  await captureScreenshot(page, "checkout-dados-mobile-320");

  await page.setViewportSize({ width: 390, height: 844 });
  await inspectCheckout("Checkout em 390 px");
  await captureScreenshot(page, "checkout-dados-mobile-390");

  // Fecha sem revisar, cadastrar endereço, gerar cobrança ou iniciar pagamento.
  await page.locator("#customerClose").click();
  await page.locator("#customerOverlay[hidden]").waitFor({ state: "attached" });
  await page.evaluate(() => localStorage.removeItem("luxuriosa_carrinho"));
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

  // 6. O quiz educativo integrado também pode salvar um resumo e sua pontuação.
  await completeKnowledgeQuiz(pageA);
  const savedAfterQuiz = await readResultsForUser(userA.id);
  assert.equal(savedAfterQuiz.length, 3, "O quiz deve acrescentar um terceiro registro.");
  const quizResult = savedAfterQuiz.find(row => row.activity_id === "knowledge_quiz");
  assert.ok(quizResult, "O quiz deve usar o identificador oficial knowledge_quiz.");
  assert.equal(quizResult.score, 21);
  assert.equal(quizResult.score_max, 21);
  assert.match(quizResult.result_summary, /21 de 21 questões/i);

  // 7. As duas leituras astrológicas também salvam resumos e oferecem próximos passos.
  await completeSolarSign(pageA);
  const savedAfterSolar = await readResultsForUser(userA.id);
  assert.equal(savedAfterSolar.length, 4, "O signo solar deve acrescentar um quarto registro.");
  const solarResult = savedAfterSolar.find(row => row.activity_id === "sign_profile");
  assert.ok(solarResult, "A leitura solar deve usar o identificador oficial sign_profile.");
  assert.equal(solarResult.category, "astrologia");
  assert.equal(solarResult.score, null);
  assert.ok(!solarResult.result_summary.includes("1990-05-01"));
  assert.ok(!solarResult.result_summary.includes("08:30"));
  assert.ok(!solarResult.result_summary.includes("America/Sao_Paulo"),
    "Data, horário e fuso de nascimento não podem entrar no histórico.");

  // Uma falha em um novo cálculo deve esconder o salvamento da leitura anterior.
  await pageA.locator(".timezone-settings summary").click();
  await pageA.locator("#birthTime").fill("08:30");
  await pageA.locator("#birthTimezone").fill("Invalid/TimeZone");
  await pageA.locator('#signForm button[type="submit"]').click();
  await pageA.locator("#calculatorError").waitFor({ state: "visible", timeout: 10000 });
  assert.equal(await pageA.locator("#signResult").evaluate(element => element.hidden), true);
  assert.equal(await pageA.locator("#signJourney").evaluate(element => element.hidden), true);
  assert.equal(await pageA.locator("#experienceSavePanel").evaluate(element => element.hidden), true);
  assert.equal((await readResultsForUser(userA.id)).length, 4,
    "Uma falha de cálculo não deve permitir salvar novamente o resultado anterior.");

  await completeSignCompatibility(pageA);
  const savedAfterSigns = await readResultsForUser(userA.id);
  assert.equal(savedAfterSigns.length, 5, "A compatibilidade deve acrescentar um quinto registro.");
  const compatibilityResult = savedAfterSigns.find(row => row.activity_id === "sign_compatibility");
  assert.ok(compatibilityResult, "A leitura de compatibilidade deve usar o identificador sign_compatibility.");
  assert.equal(compatibilityResult.category, "astrologia");
  assert.equal(compatibilityResult.score, null);
  assert.equal(compatibilityResult.result_title, "Áries + Leão");

  await pageA.goto(`${BASE_URL}/portal/conquistas/`, { waitUntil: "domcontentloaded" });
  await pageA.locator("#conquistasMain").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await pageA.locator("#conquistasPoints").innerText(), "40");
  assert.equal(await pageA.locator("#conquistasActivities").innerText(), "4");
  assert.equal(await pageA.locator("#conquistasSaved").innerText(), "5");

  // Capturas do histórico com resultados de teste em celular e desktop.
  await pageA.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(pageA, "Histórico mobile em 390 px");
  await captureScreenshot(pageA, "dashboard-historico-mobile-390");
  await pageA.setViewportSize({ width: 1440, height: 1000 });
  await assertNoHorizontalOverflow(pageA, "Histórico desktop em 1440 px");
  await captureScreenshot(pageA, "dashboard-historico-desktop-1440");

  // 7. Carrinho e formulário de dados responsivos, sem efetuar compra.
  await auditCartAndCheckout(pageA);

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
  const gateTheme = await pageB.evaluate(() => ({
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    checkboxAccent: getComputedStyle(document.querySelector("#conquistasTermsCheckbox")).accentColor
  }));
  assert.equal(gateTheme.colorScheme, "light", "O Portal autenticado deve usar tema claro.");
  assert.notEqual(gateTheme.checkboxAccent, "auto", "O checkbox deve ter cor de destaque definida.");
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
