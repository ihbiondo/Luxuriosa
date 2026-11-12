import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INFINITEPAY_API_KEY = Deno.env.get("INFINITEPAY_API_KEY") || "";
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ALLOWED_ORIGINS = new Set(["https://luxuriosa.com.br", "https://www.luxuriosa.com.br"]);
const CATALOG_URL = "https://luxuriosa.com.br/data/produtos.json";
const CHECKOUT_URL = "https://api.checkout.infinitepay.io/links";
const PAYMENT_CHECKOUT_PAYLOAD_VERSION = 5;
const VARIABLE_DICE_KIT_IDS = new Set(["22", "23", "24", "26", "27", "28", "29"]);
const ALLOWED_DICE_VARIANT_IDS = new Set(["1", "2", "3"]);
const CLUB_DISCOUNT_THRESHOLD_CENTS = 10000;
const CLUB_DISCOUNT_PERCENT = 10;
const CLUB_DISCOUNT_RULE_VERSION = "clube-10-v1-2026-11";
const CHECKOUT_VALIDITY_MINUTES = 60;
const WEBHOOK_URL = "https://byiykxfugvxuowueuxca.supabase.co/functions/v1/infinitepay-webhook";
const RETURN_URL = "https://luxuriosa.com.br/pagamento-retorno.html";

function reply(body: unknown, status = 200, origin = "") {
  return new Response(status === 204 || status === 205 || status === 304 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://luxuriosa.com.br",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin",
      "cache-control": "no-store"
    }
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function textValue(value: unknown, max = 160): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeCity(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function brazilPhone(value: string): string {
  const number = digits(value);
  if (number.length === 10 || number.length === 11) return "+55" + number;
  if ((number.length === 12 || number.length === 13) && number.startsWith("55")) return "+" + number;
  return "";
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100000) throw new Error("Preço inválido no catálogo.");
  return Math.round(n * 100);
}


type RouteFreight = {
  distanceKm: number;
  outboundTollCents: number;
  returnTollCents: number;
  totalTollCents: number;
};

async function calculateMotorcycleRoundTrip(originCep: string, destination: string): Promise<RouteFreight> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("O cálculo automático de rota ainda não está configurado. Fale com a Luxuriosa para confirmar o frete.");
  }
  const origin = originCep + ", Bauru, SP, Brasil";
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.legs.distanceMeters,routes.legs.travelAdvisory.tollInfo"
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: origin },
      intermediates: [{ address: destination }],
      travelMode: "TWO_WHEELER",
      regionCode: "BR",
      languageCode: "pt-BR",
      extraComputations: ["TOLLS"],
      routeModifiers: { vehicleInfo: { emissionType: "GASOLINE" } }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Google Routes failed", response.status, payload?.error?.message || "No details");
    throw new Error("Não foi possível calcular a rota de motocicleta. Confira o endereço ou fale com a Luxuriosa.");
  }
  const route = payload?.routes?.[0];
  const legs = route?.legs;
  if (!route || !Array.isArray(legs) || legs.length !== 2 ||
      !Number.isFinite(Number(legs[0]?.distanceMeters))) {
    throw new Error("Não conseguimos confirmar o trajeto completo de ida e volta. Fale com a Luxuriosa para calcular o frete.");
  }
  const outboundMeters = Number(legs[0].distanceMeters);
  const distanceKm = outboundMeters / 1000;
  const tollForLeg = (leg: any): { cents: number; unknown: boolean } => {
    const tollInfo = leg?.travelAdvisory?.tollInfo;
    if (!tollInfo) return { cents: 0, unknown: false };
    const prices = Array.isArray(tollInfo.estimatedPrice) ? tollInfo.estimatedPrice : [];
    if (!prices.length) return { cents: 0, unknown: true };
    let total = 0;
    for (const price of prices) {
      if (price?.currencyCode !== "BRL") return { cents: 0, unknown: true };
      const units = Number(price.units || 0);
      const nanos = Number(price.nanos || 0);
      if (!Number.isFinite(units) || !Number.isFinite(nanos)) return { cents: 0, unknown: true };
      total += units * 100 + Math.round(nanos / 10000000);
    }
    return { cents: Math.round(total), unknown: false };
  };
  const outboundToll = tollForLeg(legs[0]);
  const returnToll = tollForLeg(legs[1]);
  if (outboundToll.unknown || returnToll.unknown) {
    throw new Error("A rota pode ter pedágio, mas o valor não pôde ser confirmado. Fale com a Luxuriosa para validar o total.");
  }
  return {
    distanceKm,
    outboundTollCents: outboundToll.cents,
    returnTollCents: returnToll.cents,
    totalTollCents: outboundToll.cents + returnToll.cents
  };
}

function freightTier(distanceKm: number, rule: any, fulfillmentType: "express" | "scheduled") {
  if (distanceKm <= 12) return {
    fee: Number(fulfillmentType === "scheduled" ? rule.scheduled_fee_up_to_12km_cents : rule.express_fee_up_to_12km_cents),
    minimum: Number(rule.minimum_order_up_to_12km_cents)
  };
  if (distanceKm <= 35) return {
    fee: Number(fulfillmentType === "scheduled" ? rule.scheduled_fee_up_to_35km_cents : rule.express_fee_up_to_35km_cents),
    minimum: Number(rule.minimum_order_up_to_35km_cents)
  };
  if (distanceKm <= 55) return {
    fee: Number(fulfillmentType === "scheduled" ? rule.scheduled_fee_up_to_55km_cents : rule.express_fee_up_to_55km_cents),
    minimum: Number(rule.minimum_order_up_to_55km_cents)
  };
  return null;
}

type CatalogProduct = {
  id: string | number;
  esgotado?: boolean;
  preco?: unknown;
  nome?: unknown;
  categoria?: unknown;
  tipoProduto?: unknown;
  sku?: unknown;
};

async function loadCatalog(): Promise<Map<string, CatalogProduct>> {
  const response = await fetch(CATALOG_URL + "?v=" + Date.now(), {
    headers: { "cache-control": "no-cache" }
  });
  if (!response.ok) throw new Error("Não foi possível validar o catálogo. Tente novamente.");
  const data = await response.json();
  if (!Array.isArray(data?.produtos)) throw new Error("Catálogo indisponível.");
  const products = data.produtos as CatalogProduct[];
  return new Map<string, CatalogProduct>(products.map((product) => [String(product.id), product]));
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return reply({}, 204, origin);
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405, origin);
  if (!ALLOWED_ORIGINS.has(origin)) return reply({ error: "Origem não autorizada." }, 403, origin);
  if (!INFINITEPAY_API_KEY || !INFINITEPAY_HANDLE) return reply({ error: "O pagamento automático precisa da API Key e da InfiniteTag configuradas no servidor." }, 503, origin);
  
  try {
    const body = await req.json();
    const sessionKey = body?.session_key;
    if (!isUuid(sessionKey)) return reply({ error: "Sessão inválida. Atualize a página e tente novamente." }, 400, origin);

    const customer = body?.customer || {};
    const name = textValue(customer.name, 160);
    const phone = textValue(customer.phone, 30);
    const phoneE164 = brazilPhone(phone);
    let customerEmail = textValue(customer.email, 254);
    const address = customer.address && typeof customer.address === "object" ? customer.address : {};
    const deliveryAddress = {
      zip: digits(textValue(address.zip, 12)),
      street: textValue(address.street, 180),
      number: textValue(address.number, 30),
      complement: textValue(address.complement, 100),
      district: textValue(address.district, 100),
      city: textValue(address.city, 100),
      state: textValue(address.state, 2).toUpperCase(),
      reference: textValue(address.reference, 180)
    };

    if (!name || !phoneE164 || !/^\+55[1-9]\d{9,10}$/.test(phoneE164) ||
        !deliveryAddress.street || !deliveryAddress.number || !deliveryAddress.district ||
        !deliveryAddress.city || !/^[A-Z]{2}$/.test(deliveryAddress.state)) {
      return reply({
        code: "invalid_customer_data",
        error: "Confira seu nome, telefone brasileiro com DDD e endereço de entrega."
      }, 400, origin);
    }

    if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 80) {
      return reply({ error: "Seu carrinho está vazio ou inválido." }, 400, origin);
    }

    const catalog = await loadCatalog();
    const orderItems: any[] = [];
    let subtotalCents = 0;
    let containsKit = false;

    for (const raw of body.items) {
      const productId = textValue(String(raw?.id ?? ""), 100);
      const product = catalog.get(productId);
      const quantity = Math.trunc(Number(raw?.quantidade));
      if (!product || product.esgotado === true || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return reply({ error: "Um produto do carrinho está indisponível. Atualize o catálogo e tente novamente." }, 409, origin);
      }
      const unitCents = cents(product.preco);
      if (unitCents < 1) return reply({ error: "Um produto está sem preço válido. Fale com a Luxuriosa." }, 409, origin);
      const productName = textValue(product.nome, 180);
      if (!productName) return reply({ error: "Produto inválido no catálogo." }, 409, origin);
      const categoryValue = textValue(product.categoria || product.tipoProduto, 80);
      const category = categoryValue.toLowerCase();
      const selectedComponents: Array<{ product_id: string; product_name: string; quantity: number }> = [];
      const selectedVariantId = textValue(String(raw?.kit_variant_id ?? ""), 10);

      if (VARIABLE_DICE_KIT_IDS.has(productId)) {
        if (!ALLOWED_DICE_VARIANT_IDS.has(selectedVariantId)) {
          return reply({
            code: "kit_variant_required",
            error: "Escolha o Dado do Prazer que acompanha o kit. Volte ao catálogo, remova este kit do carrinho e adicione-o novamente para selecionar a variante."
          }, 409, origin);
        }
        const selectedDice = catalog.get(selectedVariantId);
        if (!selectedDice || selectedDice.esgotado === true) {
          return reply({ error: "A variante escolhida do Dado do Prazer está indisponível. Escolha outra opção ou fale com a Luxuriosa." }, 409, origin);
        }
        selectedComponents.push({
          product_id: selectedVariantId,
          product_name: textValue(selectedDice.nome, 180),
          quantity: 1
        });
      } else if (selectedVariantId) {
        return reply({ error: "A variante enviada não corresponde a este produto. Atualize o carrinho e tente novamente." }, 400, origin);
      }

      const lineCents = unitCents * quantity;
      if (!Number.isSafeInteger(lineCents) || lineCents > 100000000) {
        return reply({ error: "Valor do pedido fora do limite permitido." }, 400, origin);
      }
      subtotalCents += lineCents;
      if (category === "kits") containsKit = true;
      orderItems.push({
        product_id: productId,
        product_name: productName,
        sku: textValue(product.sku, 80) || null,
        quantity,
        unit_price: unitCents / 100,
        product_snapshot: {
          id: productId,
          name: productName,
          category: product.categoria || product.tipoProduto || null,
          selected_components: selectedComponents
        }
      });
    }

    // Confere o saldo dos produtos físicos já contados. Produtos sem contagem
    // continuam liberados, mas qualquer saldo controlado insuficiente bloqueia a cobrança.
    const kitItems = orderItems.filter(item =>
      textValue(item.product_snapshot?.category, 80).toLowerCase() === "kits"
    );
    const kitIds = [...new Set(kitItems.map(item => String(item.product_id)))];
    let kitRecipes: any[] = [];
    if (kitIds.length) {
      const { data, error } = await admin.from("management_kit_components")
        .select("kit_product_id, component_product_id, component_product_name, quantity")
        .in("kit_product_id", kitIds);
      if (error) throw error;
      kitRecipes = data || [];
    }

    const stockDemand = new Map<string, { product_name: string; quantity: number }>();
    const addStockDemand = (productId: unknown, productName: unknown, quantity: number) => {
      const id = textValue(String(productId ?? ""), 100);
      const name = textValue(String(productName ?? ""), 180);
      if (!id || !name || !Number.isSafeInteger(quantity) || quantity < 1) return;
      const current = stockDemand.get(id);
      stockDemand.set(id, {
        product_name: name,
        quantity: (current?.quantity || 0) + quantity
      });
    };

    for (const item of orderItems) {
      const isKit = textValue(item.product_snapshot?.category, 80).toLowerCase() === "kits";
      if (!isKit) {
        addStockDemand(item.product_id, item.product_name, Number(item.quantity));
        continue;
      }

      const components = kitRecipes.filter(recipe => String(recipe.kit_product_id) === String(item.product_id));
      if (!components.length) {
        return reply({
          code: "kit_recipe_missing",
          error: "A composição deste kit ainda não está configurada no estoque. Fale com a Luxuriosa para concluir o pedido."
        }, 409, origin);
      }
      for (const component of components) {
        addStockDemand(
          component.component_product_id,
          component.component_product_name,
          Number(component.quantity) * Number(item.quantity)
        );
      }
      for (const selected of item.product_snapshot?.selected_components || []) {
        addStockDemand(
          selected.product_id,
          selected.product_name,
          Number(selected.quantity) * Number(item.quantity)
        );
      }
    }

    const demandedProductIds = [...stockDemand.keys()];
    if (demandedProductIds.length) {
      const { data: inventoryRows, error: inventoryError } = await admin.from("management_inventory")
        .select("product_id, product_name, quantity_on_hand, stock_control_enabled")
        .in("product_id", demandedProductIds);
      if (inventoryError) throw inventoryError;

      const inventoryMap = new Map((inventoryRows || []).map(row => [String(row.product_id), row]));
      const shortages = demandedProductIds.flatMap(productId => {
        const inventory = inventoryMap.get(productId);
        const demand = stockDemand.get(productId)!;
        if (inventory?.stock_control_enabled !== true) return [];
        const available = Number(inventory.quantity_on_hand || 0);
        if (available >= demand.quantity) return [];
        return [{
          product_name: demand.product_name,
          available,
          required: demand.quantity
        }];
      });

      if (shortages.length) {
        const detail = shortages.slice(0, 5).map(item =>
          item.product_name + ": " + item.available + " disponível(is), " + item.required + " necessário(s)"
        ).join("; ");
        return reply({
          code: "insufficient_stock",
          error: "Não foi possível gerar a cobrança porque falta estoque físico: " + detail + ". Atualize o carrinho após a reposição ou fale com a Luxuriosa."
        }, 409, origin);
      }
    }

    const cityNormalized = normalizeCity(deliveryAddress.city);
    const { data: rule, error: ruleError } = await admin.from("fulfillment_sla_rules")
      .select("id, dispatch_minutes, delivery_minutes, delivery_fee_cents, free_delivery_if_contains_kit, automatic_payment_enabled, freight_origin_cep, express_fee_up_to_12km_cents, express_fee_up_to_35km_cents, express_fee_up_to_55km_cents, scheduled_fee_up_to_12km_cents, scheduled_fee_up_to_35km_cents, scheduled_fee_up_to_55km_cents, minimum_order_up_to_12km_cents, minimum_order_up_to_35km_cents, minimum_order_up_to_55km_cents, scheduled_delivery_enabled, scheduled_max_advance_hours")
      .eq("city_normalized", cityNormalized)
      .eq("state", deliveryAddress.state)
      .eq("fulfillment_mode", "delivery")
      .eq("active", true)
      .maybeSingle();
    if (ruleError) throw ruleError;
    if (!rule || rule.automatic_payment_enabled !== true ||
        !Number.isInteger(rule.dispatch_minutes) || rule.dispatch_minutes < 1 ||
        !Number.isInteger(rule.delivery_minutes) || rule.delivery_minutes < 1) {
      return reply({
        error: "O pagamento automático ainda não está liberado para essa cidade. A equipe da Luxuriosa precisa configurar os prazos de expedição, entrega e frete."
      }, 409, origin);
    }

    const fulfillmentType = body?.fulfillment_type === "scheduled" ? "scheduled" : "express";
    if (fulfillmentType === "scheduled" && rule.scheduled_delivery_enabled !== true) {
      return reply({ error: "A entrega agendada ainda não está disponível para esse destino. Escolha entrega imediata ou fale com a Luxuriosa." }, 409, origin);
    }
    // Temporary Bauru-only fallback: fixed freight, no Google Maps dependency.
    // Other cities continue using the verified motorcycle round-trip route.
    const isBauruFixedFreight = cityNormalized === "bauru" && deliveryAddress.state === "SP";
    let route: RouteFreight | null = null;
    let tier: { fee: number; minimum: number } | null = null;

    if (isBauruFixedFreight) {
      if (fulfillmentType !== "express") {
        return reply({ error: "A entrega agendada ainda não está disponível em Bauru. Escolha entrega imediata." }, 409, origin);
      }
      tier = { fee: 1500, minimum: 5000 };
    } else {
      const routeDestination = [
        deliveryAddress.street + ", " + deliveryAddress.number,
        deliveryAddress.district,
        deliveryAddress.city,
        deliveryAddress.state,
        deliveryAddress.zip,
        "Brasil"
      ].filter(Boolean).join(", ");
      route = await calculateMotorcycleRoundTrip(String(rule.freight_origin_cep || ""), routeDestination);
      if (!Number.isFinite(route.distanceKm) || route.distanceKm <= 0 || route.distanceKm > 55) {
        return reply({ error: "Esse endereço está fora da área automática de entrega (limite de 55 km pela rota de motocicleta). Fale com a Luxuriosa para consultar uma condição especial." }, 409, origin);
      }
      tier = freightTier(route.distanceKm, rule, fulfillmentType);
    }

    if (!tier || !Number.isSafeInteger(tier.fee) || tier.fee < 0 ||
        !Number.isSafeInteger(tier.minimum) || tier.minimum < 0) {
      return reply({ error: "A faixa de frete ou o pedido mínimo desse destino ainda não está configurado." }, 409, origin);
    }
    if (subtotalCents < tier.minimum) {
      const distanceMessage = route
        ? "Para entrega a aproximadamente " + route.distanceKm.toFixed(1).replace(".", ",") + " km, "
        : "Para entrega em Bauru, ";
      return reply({
        error: distanceMessage + "o pedido mínimo é R$ " + (tier.minimum / 100).toFixed(2).replace(".", ",") +
          ". Seu subtotal atual é R$ " + (subtotalCents / 100).toFixed(2).replace(".", ",") + "."
      }, 409, origin);
    }
    const baseFeeCents = containsKit && rule.free_delivery_if_contains_kit ? 0 : tier.fee;
    const tollCents = route?.totalTollCents ?? 0;
    const shippingCents = baseFeeCents + tollCents;
    if (!Number.isSafeInteger(shippingCents) || shippingCents < 0 || shippingCents > 1000000) {
      return reply({ error: "O frete calculado ultrapassou o limite permitido. Fale com a Luxuriosa." }, 409, origin);
    }

    // Pedidos do site devem pertencer a uma conta autenticada para permitir acompanhamento privado.
    // O gateway da Edge Function não exige JWT; por isso validamos a sessão manualmente.
    let customerId: string | null = null;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (token) {
      const { data: userData, error: userAuthError } = await admin.auth.getUser(token);
      if (userAuthError || !userData.user) {
        return reply({ code: "invalid_session", error: "Sua sessão expirou. Atualize a página e entre novamente para continuar." }, 401, origin);
      }
      customerId = userData.user.id;
      if (!customerEmail) customerEmail = textValue(userData.user.email, 254);
    }
    if (!customerId) {
      return reply({
        code: "account_required",
        error: "Entre ou crie sua conta Luxuriosa antes de finalizar o pedido. Seus dados cadastrados serão aproveitados no checkout."
      }, 401, origin);
    }
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      customerEmail = "";
    }

    if (!customerEmail) {
      return reply({ error: "Informe um e-mail válido para receber os dados do pagamento." }, 400, origin);
    }

    // A conta criada na Luxuriosa já integra o Clube gratuito. A elegibilidade
    // é confirmada no banco, nunca confiada ao navegador.
    let isClubMember = false;
    if (customerId) {
      const { data: memberProfile, error: memberError } = await admin.from("profiles")
        .select("id")
        .eq("id", customerId)
        .maybeSingle();
      if (memberError) throw memberError;
      isClubMember = Boolean(memberProfile?.id);
    }
    const clubDiscountCents = isClubMember && subtotalCents > CLUB_DISCOUNT_THRESHOLD_CENTS
      ? Math.round(subtotalCents * CLUB_DISCOUNT_PERCENT / 100)
      : 0;
    const totalCents = subtotalCents - clubDiscountCents + shippingCents;
    if (!Number.isSafeInteger(totalCents) || totalCents < 100) {
      return reply({ error: "O total mínimo para pagamento é R$ 1,00." }, 400, origin);
    }
    if (totalCents > 100000000) return reply({ error: "O valor máximo do pedido foi excedido." }, 400, origin);

    if (!customerEmail) {
      return reply({ error: "Informe um e-mail válido para receber os dados do pagamento." }, 400, origin);
    }

    // Guarda somente hashes para comparar os dados usados na criação do link,
    // sem duplicar telefone e e-mail em texto puro na tabela de pedidos.
    const customerPhoneHash = await sha256Hex(phoneE164);
    const customerEmailHash = await sha256Hex(customerEmail);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHECKOUT_VALIDITY_MINUTES * 60 * 1000);
    const orderId = crypto.randomUUID();
    const cartSnapshot = orderItems.map((item: any) => ({
      id: item.product_id,
      nome: item.product_name,
      quantidade: item.quantity,
      preco: item.unit_price,
      sku: item.sku,
      selected_components: item.product_snapshot?.selected_components || []
    }));

    const { data: cart, error: cartError } = await admin.from("cart_sessions")
      .upsert({
        session_key: sessionKey,
        user_id: customerId,
        status: "checkout_reviewed",
        items_snapshot: cartSnapshot,
        item_count: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: subtotalCents / 100,
        customer_name: name,
        customer_phone: phone,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        last_activity_at: now.toISOString(),
        updated_at: now.toISOString()
      }, { onConflict: "session_key" })
      .select("id")
      .single();
    if (cartError) throw cartError;

    const { data: pendingOrder, error: pendingOrderError } = await admin.from("orders")
      .select("id, order_number, customer_name, subtotal, shipping_amount, club_discount_amount_cents, club_discount_percent, payment_checkout_payload_version, payment_customer_phone_hash, payment_customer_email_hash, payment_amount_cents, payment_checkout_url, payment_expires_at, delivery_address, fulfillment_type")
      .eq("cart_session_id", cart.id)
      .eq("payment_provider", "infinitepay")
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingOrderError) throw pendingOrderError;
    if (pendingOrder) {
      const expiry = pendingOrder.payment_expires_at ? new Date(pendingOrder.payment_expires_at).getTime() : Number.POSITIVE_INFINITY;
      if (expiry <= now.getTime()) {
        const { error: expireError } = await admin.from("orders").update({
          payment_status: "cancelled",
          status: "cancelled",
          updated_at: now.toISOString()
        }).eq("id", pendingOrder.id).eq("payment_status", "pending");
        if (expireError) throw expireError;
      } else {
        const { data: existingItems, error: existingItemsError } = await admin.from("order_items")
          .select("product_id, quantity, unit_price, product_snapshot")
          .eq("order_id", pendingOrder.id);
        if (existingItemsError) throw existingItemsError;
        const selectedComponentsForCompare = (snapshot: any) =>
          (Array.isArray(snapshot?.selected_components) ? snapshot.selected_components : [])
            .map((component: any) => ({
              product_id: String(component.product_id || ""),
              product_name: String(component.product_name || ""),
              quantity: Number(component.quantity || 0)
            }))
            .sort((a: any, b: any) => a.product_id.localeCompare(b.product_id));
        const expectedItems = orderItems.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          selected_components: selectedComponentsForCompare(item.product_snapshot)
        })).sort((a,b) => String(a.product_id).localeCompare(String(b.product_id)));
        const savedItems = (existingItems || []).map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          selected_components: selectedComponentsForCompare(item.product_snapshot)
        })).sort((a,b) => String(a.product_id).localeCompare(String(b.product_id)));
        const sameItems = JSON.stringify(expectedItems) === JSON.stringify(savedItems);
        const priorAddress = pendingOrder.delivery_address || {};
        const addressKeys: Array<keyof typeof deliveryAddress> =
          ["zip","street","number","complement","district","city","state","reference"];
        const sameAddress = addressKeys.every(key =>
          String(priorAddress[key] || "") === String(deliveryAddress[key] || "")
        );
        const sameCheckoutContact =
          Number(pendingOrder.payment_checkout_payload_version) === PAYMENT_CHECKOUT_PAYLOAD_VERSION &&
          pendingOrder.customer_name === name &&
          pendingOrder.payment_customer_phone_hash === customerPhoneHash &&
          pendingOrder.payment_customer_email_hash === customerEmailHash;

        const pendingSubtotalCents = Math.round(Number(pendingOrder.subtotal || 0) * 100);
        const pendingShippingCents = Math.round(Number(pendingOrder.shipping_amount || 0) * 100);
        const pendingDiscountCents = Number(pendingOrder.club_discount_amount_cents || 0);
        const pendingDiscountPercent = Number(pendingOrder.club_discount_percent || 0);
        const expectedDiscountPercent = clubDiscountCents > 0 ? CLUB_DISCOUNT_PERCENT : 0;
        const samePaymentBreakdown =
          pendingSubtotalCents === subtotalCents &&
          pendingShippingCents === shippingCents &&
          pendingDiscountCents === clubDiscountCents &&
          pendingDiscountPercent === expectedDiscountPercent;

        if (Number(pendingOrder.payment_amount_cents) === totalCents && samePaymentBreakdown &&
            sameItems && sameAddress && pendingOrder.fulfillment_type === fulfillmentType &&
            sameCheckoutContact && pendingOrder.payment_checkout_url) {
          return reply({
            ok: true,
            order_number: pendingOrder.order_number,
            checkout_url: pendingOrder.payment_checkout_url,
            subtotal_amount: Number(pendingOrder.subtotal) || subtotalCents / 100,
            club_discount_amount: Number(pendingOrder.club_discount_amount_cents || 0) / 100,
            club_discount_percent: Number(pendingOrder.club_discount_percent || 0),
            shipping_amount: Number(pendingOrder.shipping_amount || 0),
            total_amount: totalCents / 100,
            reused: true
          }, 200, origin);
        }

        if (pendingOrder.payment_checkout_url && !sameCheckoutContact) {
          const expiryLabel = pendingOrder.payment_expires_at
            ? new Date(pendingOrder.payment_expires_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : "";
          const expiryAdvice = expiryLabel
            ? "O link anterior expira em " + expiryLabel + ". Depois desse horário, atualize a loja e tente novamente."
            : "Esse link antigo não tem expiração configurada e pode continuar ativo. A InfinitePay não permite cancelar ou editar links já criados; finalize este pedido pelo WhatsApp para evitar duas cobranças.";
          return reply({
            code: "active_checkout_contact_mismatch",
            order_number: pendingOrder.order_number,
            expires_at: pendingOrder.payment_expires_at || null,
            error: "Já existe um link de pagamento ativo para este carrinho, criado com dados de contato ou configuração anteriores. Não use o link anterior se o telefone ou e-mail estiver incorreto. Por segurança, não vamos gerar uma segunda cobrança enquanto ele estiver válido. " + expiryAdvice
          }, 409, origin);
        }

        return reply({
          error: pendingOrder.payment_checkout_url
            ? "Já existe um pagamento pendente para este carrinho. Conclua a cobrança existente ou aguarde sua expiração antes de criar outro pedido."
            : "Já estamos preparando a cobrança deste pedido. Aguarde alguns instantes e tente novamente."
        }, 409, origin);
      }
    }

    // Proteção básica contra geração abusiva de links. A mesma sessão com pedido
    // pendente é reutilizada acima; novas cobranças por contato são limitadas.
    const attemptWindowStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const [phoneAttempts, emailAttempts] = await Promise.all([
      admin.from("orders").select("id", { count: "exact", head: true })
        .eq("payment_provider", "infinitepay")
        .eq("payment_customer_phone_hash", customerPhoneHash)
        .gte("created_at", attemptWindowStart),
      admin.from("orders").select("id", { count: "exact", head: true })
        .eq("payment_provider", "infinitepay")
        .eq("payment_customer_email_hash", customerEmailHash)
        .gte("created_at", attemptWindowStart)
    ]);
    if (phoneAttempts.error) throw phoneAttempts.error;
    if (emailAttempts.error) throw emailAttempts.error;
    if ((phoneAttempts.count || 0) >= 5 || (emailAttempts.count || 0) >= 5) {
      return reply({ error: "Muitas tentativas de pagamento para esses dados. Aguarde até uma hora ou fale com a Luxuriosa." }, 429, origin);
    }

    const { data: order, error: orderError } = await admin.from("orders").insert({
      id: orderId,
      cart_session_id: cart.id,
      customer_id: customerId,
      status: "awaiting_confirmation",
      source: "website",
      customer_name: name,
      customer_phone: phone,
      delivery_address: deliveryAddress,
      subtotal: subtotalCents / 100,
      shipping_amount: shippingCents / 100,
      total_amount: totalCents / 100,
      club_discount_amount_cents: clubDiscountCents,
      club_discount_percent: clubDiscountCents > 0 ? CLUB_DISCOUNT_PERCENT : 0,
      club_discount_rule_version: clubDiscountCents > 0 ? CLUB_DISCOUNT_RULE_VERSION : null,
      payment_status: "pending",
      payment_provider: "infinitepay",
      payment_checkout_payload_version: PAYMENT_CHECKOUT_PAYLOAD_VERSION,
      payment_customer_phone_hash: customerPhoneHash,
      payment_customer_email_hash: customerEmailHash,
      payment_order_nsu: orderId,
      payment_amount_cents: totalCents,
      dispatch_sla_minutes: rule.dispatch_minutes,
      delivery_sla_minutes: rule.delivery_minutes,
      fulfillment_type: fulfillmentType,
      delivery_origin_cep: rule.freight_origin_cep,
      delivery_distance_km: route ? Number(route.distanceKm.toFixed(2)) : null,
      delivery_base_fee_cents: baseFeeCents,
      delivery_toll_amount_cents: tollCents,
      scheduled_discount_amount: 0,
      payment_expires_at: expiresAt.toISOString()
    }).select("id, order_number").single();
    if (orderError) {
      if (orderError.code === "23505") {
        return reply({ error: "Já existe uma cobrança pendente para este carrinho. Atualize a página e consulte seu pedido antes de tentar novamente." }, 409, origin);
      }
      throw orderError;
    }

    const { error: itemsError } = await admin.from("order_items").insert(
      orderItems.map((item) => ({ ...item, order_id: orderId }))
    );
    if (itemsError) {
      await admin.from("orders").update({ payment_status: "failed" }).eq("id", orderId);
      throw itemsError;
    }

    let checkoutItems: Array<{ quantity: number; price: number; description: string }> = [];
    if (clubDiscountCents > 0) {
      // Allocate the discount proportionally by product line. InfinitePay accepts
      // positive item prices in cents; quantity is embedded in the description so
      // each discounted line can carry its exact net line total without rounding drift.
      const allocations = orderItems.map((item, index) => {
        const lineCents = Math.round(Number(item.unit_price) * 100) * item.quantity;
        const weightedDiscount = lineCents * clubDiscountCents;
        return {
          index,
          lineCents,
          discountCents: Math.floor(weightedDiscount / subtotalCents),
          remainder: weightedDiscount % subtotalCents
        };
      });
      let centsLeft = clubDiscountCents - allocations.reduce((sum, row) => sum + row.discountCents, 0);
      allocations.slice().sort((a, b) => b.remainder - a.remainder || a.index - b.index)
        .slice(0, centsLeft).forEach(row => { allocations[row.index].discountCents += 1; });
      checkoutItems = orderItems.map((item, index) => {
        const netLineCents = allocations[index].lineCents - allocations[index].discountCents;
        if (!Number.isSafeInteger(netLineCents) || netLineCents < 1) {
          throw new Error("Não foi possível distribuir o desconto do Clube com segurança.");
        }
        return {
          quantity: 1,
          price: netLineCents,
          description: item.quantity + "x " + item.product_name
        };
      });
    } else {
      checkoutItems = orderItems.map((item) => ({
        quantity: item.quantity,
        price: Math.round(Number(item.unit_price) * 100),
        description: item.product_name
      }));
    }
    if (shippingCents > 0) {
      checkoutItems.push({
        quantity: 1,
        price: shippingCents,
        description: isBauruFixedFreight ? "Entrega imediata · Bauru (frete fixo)" : "Entrega " + (fulfillmentType === "scheduled" ? "agendada" : "imediata") + " · " + route!.distanceKm.toFixed(1) + " km" + (tollCents > 0 ? " · pedágio incluso" : "")
      });
    }

    const checkoutCustomer = {
      name,
      email: customerEmail,
      phone_number: phoneE164
    };
    console.info("InfinitePay customer prefill prepared", {
      payloadVersion: PAYMENT_CHECKOUT_PAYLOAD_VERSION,
      hasName: Boolean(checkoutCustomer.name),
      hasEmail: Boolean(checkoutCustomer.email),
      hasPhone: Boolean(checkoutCustomer.phone_number),
      phoneCountryCode: checkoutCustomer.phone_number.slice(0, 3),
      phoneDigitCount: digits(checkoutCustomer.phone_number).length,
      phoneE164Valid: /^\+55[1-9]\d{9,10}$/.test(checkoutCustomer.phone_number),
      hasAddress: Boolean(deliveryAddress.street && deliveryAddress.city && deliveryAddress.state)
    });

    const checkoutPayload = {
      order_nsu: orderId,
      redirect_url: RETURN_URL + "?order=" + encodeURIComponent(orderId),
      webhook: {
        url: WEBHOOK_URL,
        events: ["created", "paid", "settled", "refunded", "canceled", "payment_failed"]
      },
      customer: checkoutCustomer,
      address: {
        cep: deliveryAddress.zip,
        street: deliveryAddress.street,
        number: deliveryAddress.number,
        neighborhood: deliveryAddress.district,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        complement: deliveryAddress.complement
      },
      items: checkoutItems,
      options: {
        single_payment: true,
        valid_until: expiresAt.toISOString(),
        require_delivery_address: false,
        payment_methods_enabled: ["credit_card", "pix"]
      }
    };

    const checkoutResponse = await fetch(CHECKOUT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Api-Key": INFINITEPAY_API_KEY
      },
      body: JSON.stringify(checkoutPayload)
    });
    const checkoutText = await checkoutResponse.text();
    let checkoutData: any = {};
    try { checkoutData = checkoutText ? JSON.parse(checkoutText) : {}; } catch { checkoutData = {}; }
    const rawCheckoutUrl = checkoutData?.url ?? checkoutData?.data?.url;
    const checkoutLink = typeof rawCheckoutUrl === "string" ? rawCheckoutUrl.trim() : "";
    let checkoutHost = "";
    try { checkoutHost = checkoutLink ? new URL(checkoutLink).hostname : ""; } catch { checkoutHost = ""; }
    const validCheckoutUrl = ["checkout.infinitepay.io", "checkout.infinitepay.com.br"].includes(checkoutHost) && checkoutLink.startsWith("https://");
    if (!checkoutResponse.ok || !validCheckoutUrl) {
      await admin.from("orders").update({ payment_status: "failed" }).eq("id", orderId);
      console.error("InfinitePay link creation failed", {
        status: checkoutResponse.status,
        contentType: checkoutResponse.headers.get("content-type"),
        responseKeys: checkoutData && typeof checkoutData === "object" ? Object.keys(checkoutData) : [],
        urlType: typeof rawCheckoutUrl,
        urlLength: checkoutLink.length,
        urlHost: checkoutHost || null,
        urlStartsWithHttps: checkoutLink.startsWith("https://"),
        nestedDataKeys: checkoutData?.data && typeof checkoutData.data === "object" ? Object.keys(checkoutData.data) : [],
        error: checkoutData?.message || checkoutData?.error || checkoutData?.code || "Invalid response"
      });
      const publicError = checkoutResponse.status === 403
        ? "A InfinitePay recusou a configuração. Confira se a InfiniteTag e a API Key pertencem à mesma conta."
        : "Não foi possível gerar o pagamento agora. Nenhuma cobrança foi confirmada. Tente novamente ou fale com a Luxuriosa.";
      return reply({ error: publicError }, 502, origin);
    }

    const { error: saveLinkError } = await admin.from("orders").update({
      payment_checkout_url: checkoutLink,
      payment_invoice_slug: textValue(checkoutData?.invoice_slug, 200) || null
    }).eq("id", orderId);
    if (saveLinkError) {
      await admin.from("orders").update({
        payment_status: "review_required",
        updated_at: new Date().toISOString()
      }).eq("id", orderId).eq("payment_status", "pending");
      console.error("InfinitePay checkout was created but its URL could not be saved. Order moved to review_required.", {
        orderId,
        error: saveLinkError.message
      });
      return reply({
        error: "A cobrança foi criada, mas não conseguimos salvar o link com segurança. Não tente pagar novamente; entre em contato com a Luxuriosa para conferir o pedido."
      }, 502, origin);
    }

    return reply({
      ok: true,
      order_number: order.order_number,
      checkout_url: checkoutLink,
      subtotal_amount: subtotalCents / 100,
      club_discount_amount: clubDiscountCents / 100,
      club_discount_percent: clubDiscountCents > 0 ? CLUB_DISCOUNT_PERCENT : 0,
      shipping_amount: shippingCents / 100,
      total_amount: totalCents / 100,
      expires_at: expiresAt.toISOString()
    }, 200, origin);
  } catch (error) {
    console.error("create-payment-order:", error);
    return reply({
      error: error instanceof Error ? error.message : "Não foi possível preparar o pagamento."
    }, 400, origin);
  }
});
