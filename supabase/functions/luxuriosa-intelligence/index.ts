import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ALLOWED_ORIGINS = new Set([
  "https://luxuriosa.com.br",
  "https://www.luxuriosa.com.br",
  "http://127.0.0.1:1421",
  "http://localhost:1421"
]);

function reply(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://luxuriosa.com.br",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin"
    }
  });
}

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

async function authorize(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Faça login para acessar a Gestão.", status: 401 };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: "Sessão inválida. Entre novamente.", status: 401 };

  const { data: permission, error: permissionError } = await admin
    .from("user_permissions")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (permissionError) return { error: "Não foi possível validar a permissão administrativa.", status: 500 };
  if (permission?.role !== "admin") return { error: "Acesso restrito à administração.", status: 403 };

  return { user: data.user };
}
const CUSTOMER_INTERESTS = [
  { key: "lingerie", label: "Lingerie" },
  { key: "cosmeticos_sensuais", label: "Cosméticos sensuais" },
  { key: "geles_lubrificantes", label: "Géis e lubrificantes" },
  { key: "acessorios_casais", label: "Acessórios para casais" },
  { key: "jogos_brincadeiras", label: "Jogos e brincadeiras" },
  { key: "massagem_relaxamento", label: "Massagem e relaxamento" },
  { key: "estimulacao", label: "Produtos de estimulação" },
  { key: "fantasias_acessorios", label: "Fantasias e acessórios" },
  { key: "kits_presentes", label: "Kits e presentes" },
  { key: "novidades_lancamentos", label: "Novidades e lançamentos" }
];

const CUSTOMER_PRICE_RANGES = [
  { key: "ate_50", label: "Até R$ 50" },
  { key: "50_100", label: "R$ 50 a R$ 100" },
  { key: "100_200", label: "R$ 100 a R$ 200" },
  { key: "acima_200", label: "Acima de R$ 200" }
];

const CUSTOMER_OFFER_TYPES = [
  { key: "descontos", label: "Descontos e oportunidades" },
  { key: "kits", label: "Kits e combinações" },
  { key: "novidades", label: "Novidades e lançamentos" },
  { key: "recomendacoes", label: "Recomendações personalizadas" }
];

// Taxonomia comercial explícita. Produtos sem correspondência ficam fora da comparação.
const PRODUCT_INTEREST_MAP: Record<string, string> = {
  "1": "jogos_brincadeiras", "2": "jogos_brincadeiras", "3": "jogos_brincadeiras",
  "4": "acessorios_casais", "5": "acessorios_casais",
  "7": "geles_lubrificantes", "8": "estimulacao", "9": "estimulacao",
  "10": "kits_presentes", "11": "estimulacao", "12": "geles_lubrificantes",
  "13": "geles_lubrificantes", "14": "estimulacao", "15": "estimulacao",
  "16": "cosmeticos_sensuais", "17": "estimulacao", "18": "estimulacao",
  "19": "estimulacao", "20": "estimulacao",
  "22": "kits_presentes", "23": "kits_presentes", "24": "kits_presentes",
  "25": "kits_presentes", "26": "kits_presentes", "27": "kits_presentes",
  "28": "kits_presentes", "29": "kits_presentes"
};

function createCustomerInterestStats() {
  return new Map(CUSTOMER_INTERESTS.map((item) => [item.key, {
    key: item.key,
    label: item.label,
    declared_customers: 0,
    viewing_users: new Set<string>(),
    view_events: 0,
    cart_users: new Set<string>(),
    add_to_cart_events: 0,
    buyers: new Set<string>(),
    paid_orders: new Set<string>(),
    units_sold: 0,
    revenue_cents: 0
  }] as const));
}


async function readCustomerInsights(from: string, to: string, periodDays: number) {
  const [
    profileCountResult,
    preferenceResult,
    consentResult,
    cartResult,
    eventResult,
    orderResult
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("preferences")
      .select("user_id, favorite_categories, preferred_price_range, preferred_offer_type")
      .limit(10000),
    admin.from("account_data_consents")
      .select("user_id, granted, consent_text_version, created_at")
      .eq("purpose", "experience_personalization")
      .order("created_at", { ascending: false })
      .limit(20000),
    admin.from("cart_sessions")
      .select("session_key, user_id")
      .not("user_id", "is", null)
      .limit(20000),
    admin.from("site_events")
      .select("session_key, event_name, product_id, created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .in("event_name", ["product_view", "add_to_cart"])
      .order("created_at", { ascending: true })
      .limit(20000),
    admin.from("orders")
      .select("id, customer_id, paid_at")
      .eq("payment_status", "paid")
      .not("customer_id", "is", null)
      .gte("paid_at", from)
      .lte("paid_at", to)
      .limit(10000)
  ]);

  for (const result of [profileCountResult, preferenceResult, consentResult, cartResult, eventResult, orderResult]) {
    if (result.error) throw result.error;
  }

  // Usa a autorização mais recente e o texto v2, que contempla as novas preferências comerciais.
  const latestConsent = new Map<string, any>();
  for (const row of consentResult.data || []) {
    if (!latestConsent.has(row.user_id)) latestConsent.set(row.user_id, row);
  }
  const eligibleUsers = new Set<string>();
  for (const [userId, consent] of latestConsent.entries()) {
    if (consent.granted === true && consent.consent_text_version === "luxuriosa-account-data-v2-2026-11") {
      eligibleUsers.add(userId);
    }
  }

  const eligiblePreferences = (preferenceResult.data || [])
    .filter((row: any) => eligibleUsers.has(row.user_id));
  const categoryStats = createCustomerInterestStats();
  const priceCounts = new Map(CUSTOMER_PRICE_RANGES.map((item) => [item.key, 0] as const));
  const offerCounts = new Map(CUSTOMER_OFFER_TYPES.map((item) => [item.key, 0] as const));

  let profilesWithCategories = 0;
  let profilesWithPrice = 0;
  let profilesWithOffer = 0;
  for (const preference of eligiblePreferences) {
    const selected = Array.isArray(preference.favorite_categories)
      ? [...new Set(preference.favorite_categories.filter((key: string) => categoryStats.has(key)))]
      : [];
    if (selected.length) profilesWithCategories += 1;
    if (preference.preferred_price_range && priceCounts.has(preference.preferred_price_range)) {
      priceCounts.set(preference.preferred_price_range, (priceCounts.get(preference.preferred_price_range) || 0) + 1);
      profilesWithPrice += 1;
    }
    if (preference.preferred_offer_type && offerCounts.has(preference.preferred_offer_type)) {
      offerCounts.set(preference.preferred_offer_type, (offerCounts.get(preference.preferred_offer_type) || 0) + 1);
      profilesWithOffer += 1;
    }
    for (const key of selected) {
      const stat = categoryStats.get(key);
      if (stat) stat.declared_customers += 1;
    }
  }

  const sessionOwners = new Map<string, string>();
  for (const cart of cartResult.data || []) {
    if (cart.session_key && cart.user_id && eligibleUsers.has(cart.user_id)) {
      sessionOwners.set(String(cart.session_key), String(cart.user_id));
    }
  }

  const trackedUsers = new Set<string>();
  let linkedProductEvents = 0;
  let unmappedProductEvents = 0;
  for (const event of eventResult.data || []) {
    const userId = sessionOwners.get(String(event.session_key || ""));
    if (!userId || !eligibleUsers.has(userId)) continue;
    linkedProductEvents += 1;
    const interestKey = PRODUCT_INTEREST_MAP[String(event.product_id || "")];
    if (!interestKey || !categoryStats.has(interestKey)) {
      unmappedProductEvents += 1;
      continue;
    }
    const stat = categoryStats.get(interestKey);
    if (!stat) {
      unmappedProductEvents += 1;
      continue;
    }
    trackedUsers.add(userId);
    if (event.event_name === "product_view") {
      stat.view_events += 1;
      stat.viewing_users.add(userId);
    } else if (event.event_name === "add_to_cart") {
      stat.add_to_cart_events += 1;
      stat.cart_users.add(userId);
    }
  }

  const eligibleOrders = (orderResult.data || [])
    .filter((order: any) => order.customer_id && eligibleUsers.has(order.customer_id));
  const orderIds = eligibleOrders.map((order: any) => order.id);
  const orderOwners = new Map(eligibleOrders.map((order: any) => [String(order.id), String(order.customer_id)] as const));
  let unmappedPurchaseItems = 0;
  let paidRevenueCents = 0;
  const purchasedUsers = new Set<string>();
  if (eligibleOrders.length) {
    const { data: orderItems, error: itemError } = await admin.from("order_items")
      .select("order_id, product_id, quantity, unit_price, line_total")
      .in("order_id", orderIds)
      .limit(30000);
    if (itemError) throw itemError;

    for (const item of orderItems || []) {
      const userId = orderOwners.get(String(item.order_id));
      if (!userId) continue;
      const interestKey = PRODUCT_INTEREST_MAP[String(item.product_id || "")];
      if (!interestKey || !categoryStats.has(interestKey)) {
        unmappedPurchaseItems += 1;
        continue;
      }
      const stat = categoryStats.get(interestKey);
      if (!stat) {
        unmappedPurchaseItems += 1;
        continue;
      }
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const lineValue = item.line_total === null || item.line_total === undefined
        ? (Number(item.unit_price) || 0) * quantity
        : Number(item.line_total) || 0;
      stat.units_sold += quantity;
      stat.revenue_cents += Math.round(lineValue * 100);
      stat.paid_orders.add(String(item.order_id));
      stat.buyers.add(userId);
      purchasedUsers.add(userId);
      paidRevenueCents += Math.round(lineValue * 100);
    }
  }

  const categories = CUSTOMER_INTERESTS.map((item) => {
    const stat = categoryStats.get(item.key)!;
    return {
      key: stat.key,
      label: stat.label,
      declared_customers: stat.declared_customers,
      viewing_customers: stat.viewing_users.size,
      product_views: stat.view_events,
      cart_customers: stat.cart_users.size,
      add_to_cart_events: stat.add_to_cart_events,
      buying_customers: stat.buyers.size,
      paid_orders: stat.paid_orders.size,
      units_sold: stat.units_sold,
      revenue_cents: stat.revenue_cents
    };
  });

  return {
    ok: true,
    period_days: periodDays,
    generated_at: new Date().toISOString(),
    total_profiles: profileCountResult.count || 0,
    personalization_eligible_profiles: eligibleUsers.size,
    profiles_with_categories: profilesWithCategories,
    profiles_with_price: profilesWithPrice,
    profiles_with_offer: profilesWithOffer,
    tracked_profiles: trackedUsers.size,
    tracked_product_events: linkedProductEvents,
    purchased_profiles: purchasedUsers.size,
    paid_orders: eligibleOrders.length,
    paid_revenue_cents: paidRevenueCents,
    categories,
    price_ranges: CUSTOMER_PRICE_RANGES.map((item) => ({
      key: item.key, label: item.label, customers: priceCounts.get(item.key) || 0
    })),
    offer_types: CUSTOMER_OFFER_TYPES.map((item) => ({
      key: item.key, label: item.label, customers: offerCounts.get(item.key) || 0
    })),
    coverage: {
      eligible_profiles: eligibleUsers.size,
      eligible_preferences: eligiblePreferences.length,
      linked_product_events: linkedProductEvents,
      unmapped_product_events: unmappedProductEvents,
      unmapped_purchase_items: unmappedPurchaseItems,
      source_limit_reached:
        (preferenceResult.data || []).length >= 10000 ||
        (consentResult.data || []).length >= 20000 ||
        (cartResult.data || []).length >= 20000 ||
        (eventResult.data || []).length >= 20000 ||
        (orderResult.data || []).length >= 10000
    }
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "Origem não autorizada." }, 403, origin);
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://luxuriosa.com.br",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin"
    }});
  }
  if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "Origem não autorizada." }, 403, origin);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16 * 1024) return reply({ error: "Solicitação muito grande." }, 413, origin);
  let body: any;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16 * 1024) return reply({ error: "Solicitação muito grande." }, 413, origin);
    body = JSON.parse(raw);
  } catch {
    return reply({ error: "Corpo da solicitação inválido." }, 400, origin);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Corpo da solicitação inválido." }, 400, origin);
  try {
    const authorization = await authorize(request);
    if ("error" in authorization) return reply({ error: authorization.error }, authorization.status, origin);
    if (body.action !== "customer-insights") return reply({ error: "Ação não reconhecida." }, 400, origin);
    const periodDays = Number(body.period_days ?? 30);
    if (![7, 30, 90, 365].includes(periodDays)) {
      return reply({ error: "Período inválido. Escolha 7, 30, 90 ou 365 dias." }, 400, origin);
    }
    const now = new Date();
    const from = new Date(now.getTime() - periodDays * 86400000).toISOString();
    const result = await readCustomerInsights(from, now.toISOString(), periodDays);
    return reply(result, 200, origin);
  } catch (error) {
    console.error("luxuriosa-intelligence:", error);
    return reply({ error: "Não foi possível consultar a inteligência de clientes." }, 500, origin);
  }
});
