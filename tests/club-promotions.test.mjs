import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync("data/produtos.json", "utf8"));
const catalogScript = readFileSync("js/catalogo.js", "utf8");
const cart = readFileSync("js/carrinho.js", "utf8");
const clubPrices = readFileSync("js/clube-precos.js", "utf8");
const productDetail = readFileSync("js/produto-detalhe.js", "utf8");
const clubPageScript = readFileSync("js/clube.js", "utf8");
const clubPage = readFileSync("clube.html", "utf8");
const clubLanding = readFileSync("clube/index.html", "utf8");
const home = readFileSync("index.html", "utf8");
const cartOrders = readFileSync("supabase/functions/cart-orders/index.ts", "utf8");
const paymentOrder = readFileSync("supabase/functions/create-payment-order/index.ts", "utf8");
const membershipMigration = readFileSync(
  "supabase/migrations/20261122190000_club_membership_requires_complete_profile.sql",
  "utf8"
);

const clubPromotions = catalog.produtos.filter((product) =>
  Number(product.precoAntigo) > Number(product.preco)
);

test("o Clube comunica somente os dois benefícios atuais", () => {
  const planStart = clubPage.indexOf('<article class="plan-card">');
  const planEnd = clubPage.indexOf("</article>", planStart);
  const planCard = planStart >= 0 && planEnd > planStart
    ? clubPage.slice(planStart, planEnd)
    : "";
  const landingBenefits = clubLanding.split('<div class="benefit">')
    .slice(1)
    .map((item) => item.split("</div>")[0]);

  assert.equal((planCard.match(/<li>/g) || []).length, 2);
  assert.match(planCard, /Promoções exclusivas em produtos selecionados/);
  assert.match(planCard, /Frete com valores especiais para membros/);
  assert.equal(landingBenefits.length, 2);
  assert.match(landingBenefits[0], /Preços promocionais em produtos/);
  assert.match(landingBenefits[1], /Frete com valor especial/);
  assert.doesNotMatch(clubPage, /Acesso às vantagens e novidades do Clube|Área de membro para consultar sua participação/);
  assert.equal(landingBenefits.some((item) => item.includes("Área de membro") || item.includes("Privacidade e autonomia")), false);
});

test("todas as promoções do catálogo são identificadas como benefícios do Clube", () => {
  assert.equal(clubPromotions.length, 11);
  assert.match(catalogScript, /Promoção exclusiva para membros do Clube Luxuriosa/);
  assert.match(catalogScript, /formatarPreco\(produto\.preco\)/);
  assert.match(catalogScript, /formatarPreco\([\s\S]*?produto\.precoAntigo/);
  assert.match(productDetail, /Promoção exclusiva para membros do Clube Luxuriosa/);
  assert.equal((home.match(/home-kit-static-club-label/g) || []).length, 4);
});

test("as páginas dos 11 produtos exibem preço promocional e identificação do Clube sem depender de JavaScript", () => {
  for (const product of clubPromotions) {
    const html = readFileSync(product.pagina, "utf8");
    assert.match(html, /class="product-detail-price"/, product.pagina);
    assert.match(html, /club-promo-note/, product.pagina);
    assert.match(html, /Promoção exclusiva para membros do Clube Luxuriosa/, product.pagina);
  }
});

test("a consulta pública de status exige membro ativo e perfil completo", () => {
  assert.match(clubPrices, /client\.rpc\("get_club_membership_state"\)/);
  assert.match(clubPrices, /membership\.is_member === true && membership\.profile_complete === true/);
  assert.match(clubPrices, /profile_missing_fields/);
  assert.match(clubPageScript, /state\?\.profile_complete === true/);
  assert.match(clubPage, /O endereço permanece opcional/);
  assert.match(clubLanding, /data de nascimento \(18\+\)/);
});

test("o benefício de frete não pode ser ativado manualmente no navegador", () => {
  assert.match(cart, /controle\.disabled = true/);
  assert.match(cart, /membroClubeVerificado = detail\.loaded === true/);
  assert.match(cart, /var membroClube = membroClubeVerificado && membroClubeAtivo/);
  assert.match(cart, /Tarifa especial do Clube aplicada automaticamente/);
});

test("cart-orders consulta a adesão real e recalcula preços no servidor", () => {
  assert.match(cartOrders, /userClient\.rpc\("get_club_membership_state"\)/);
  assert.match(cartOrders, /data\?\.is_member === true && data\?\.profile_complete === true/);
  assert.match(cartOrders, /cleanItems\(body\.items \|\| \[\], catalog, isClubMember\)/);
  assert.match(cartOrders, /const clubDiscountCents = 0/);
  assert.match(cartOrders, /const totalCents = subtotalCents \+ \(shippingCents \|\| 0\)/);
  assert.match(cartOrders, /club_discount_percent: 0/);
  assert.doesNotMatch(cartOrders, /admin\.from\("club_memberships"\)/);
});

test("checkout de pagamento valida membro, aplica o preço do catálogo e não acumula 10%", () => {
  assert.match(paymentOrder, /userClient\.rpc\("get_club_membership_state"\)/);
  assert.match(paymentOrder, /data\?\.is_member === true && data\?\.profile_complete === true/);
  assert.match(paymentOrder, /const regularPriceCents =/);
  assert.match(paymentOrder, /const hasClubPromotion = regularPriceCents > clubPrice/);
  assert.match(paymentOrder, /const unitCents = hasClubPromotion && !isClubMember \? regularPriceCents : clubPrice/);
  assert.match(paymentOrder, /const clubDiscountCents = 0/);
  assert.match(paymentOrder, /const totalCents = subtotalCents \+ shippingCents/);
  assert.match(paymentOrder, /PAYMENT_CHECKOUT_PAYLOAD_VERSION = 10/);
  assert.match(paymentOrder, /checkoutItems = orderItems\.map\(\(item\) => \(\{/);
  assert.doesNotMatch(paymentOrder, /CLUB_DISCOUNT_|netLineCents|discountCents/);
  assert.doesNotMatch(paymentOrder, /regularPrice > clubPrice/);
});

test("uma adesão registrada continua podendo ser encerrada mesmo com perfil incompleto", () => {
  assert.match(clubPageScript, /const membershipActive = state\\?\\.membership_active === true \\|\\| isMember/);
  assert.match(clubPageScript, /\\$\\("leaveClub"\\)\\.hidden = !membershipActive/);
  assert.match(clubPageScript, /supabase\\.rpc\\("leave_luxuriosa_club"\\)/);
});

test("a adesão exige nome, usuário, WhatsApp, e-mail e maioridade; endereço não é obrigatório", () => {
  assert.match(membershipMigration, /username/);
  assert.match(membershipMigration, /full_name/);
  assert.match(membershipMigration, /birth_date/);
  assert.match(membershipMigration, /phone/);
  assert.match(membershipMigration, /email/);
  assert.match(membershipMigration, /interval '18 years'/);
  assert.match(membershipMigration, /Endereço não é obrigatório/);
  assert.match(membershipMigration, /complete seu usuário, nome completo[\s\S]*endereço continua opcional/);
});
