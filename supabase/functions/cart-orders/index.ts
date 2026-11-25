import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCartActivityStatePatch, statusAfterVisitorActivity } from "../_shared/cart-session-state.mjs";
import { canReuseCartInstance, cartInstanceStatusForAction, resolveCartInstanceId } from "../_shared/cart-instance-state.mjs";
import { applyAnalyticsContext, buildVisitSessionActivityPatch, buildVisitSessionCreatePatch, normalizeAnalyticsPagePath, normalizeAnalyticsPageTitle } from "../_shared/visitor-analytics.mjs";
import { RateLimitUnavailableError, runCartRequestGuards } from "../_shared/cart-request-guards.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const allowedOrigins = new Set(["https://luxuriosa.com.br", "https://www.luxuriosa.com.br"]);
const CATALOG_URL = "https://luxuriosa.com.br/data/produtos.json";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(scope: "cart_ip" | "cart_session", identifier: string, maximum: number): Promise<boolean> {
  const keyHash = await sha256Hex(identifier);
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    p_scope: scope,
    p_key_hash: keyHash,
    p_window_seconds: 60,
    p_limit: maximum
  });
  if (error) throw new Error("Não foi possível validar o limite de requisições.");
  return data === true;
}

// Atomic Postgres-backed fixed-window throttling is shared across Edge Function instances.
async function rateLimitRequest(req: Request, sessionKey: string, eventsOnly: boolean): Promise<boolean> {
  const ip = req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (ip && !(await consumeRateLimit("cart_ip", ip, eventsOnly ? 180 : 90))) return false;
  return await consumeRateLimit("cart_session", sessionKey, eventsOnly ? 120 : 30);
}

async function resolveCartUserId(token: string): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return !error ? data.user?.id || null : null;
}

async function rateLimitAndResolveUser(
  req: Request,
  sessionKey: string,
  eventsOnly: boolean,
  token: string
) {
  return runCartRequestGuards(
    () => rateLimitRequest(req, sessionKey, eventsOnly),
    () => resolveCartUserId(token)
  );
}

async function measure<T>(
  timings: Record<string, number>,
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    timings[name] = Math.round(performance.now() - startedAt);
  }
}
const VARIABLE_DICE_KIT_IDS = new Set(["22", "23", "24", "27", "28", "29"]);
const DICE_VARIANT_NAMES = new Map([
  ["1", "Dado do Prazer — Gay"],
  ["2", "Dado do Prazer — Hétero"],
  ["3", "Dado do Prazer — Lésbico"]
]);

function response(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": allowedOrigins.has(origin) ? origin : "https://luxuriosa.com.br",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function cleanText(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, max);
  return result || null;
}

async function upsertVisitSession(
  visitId: string,
  sessionKey: string,
  now: string,
  pagePath: string,
  pageTitle: string | null,
  analyticsContext: unknown
) {
  const { data: existing, error: lookupError } = await admin.from("site_visit_sessions")
    .select("session_key").eq("visit_id", visitId).maybeSingle();
  if (lookupError) throw lookupError;

  const updateActivity = async () => {
    const { error } = await admin.from("site_visit_sessions")
      .update(buildVisitSessionActivityPatch(now, pagePath, pageTitle))
      .eq("visit_id", visitId)
      .eq("session_key", sessionKey)
      // Requests can arrive out of order; never let delayed activity move
      // last_activity_at or the last-page snapshot backwards.
      .lt("last_activity_at", now);
    if (error) throw error;
  };

  if (existing) {
    if (String(existing.session_key) !== sessionKey) {
      throw new Error("Identificador de visita inválido.");
    }
    await updateActivity();
    return;
  }

  const visit = buildVisitSessionCreatePatch(
    visitId, sessionKey, now, pagePath, pageTitle, analyticsContext
  );
  const { error: insertError } = await admin.from("site_visit_sessions").insert(visit);
  if (!insertError) return;

  // Another request may have created the visit after the initial lookup.
  // In that case, accept the race only for the same browser and update
  // activity without replacing the original start time or acquisition data.
  if (insertError.code !== "23505") throw insertError;
  const { data: racedVisit, error: raceLookupError } = await admin.from("site_visit_sessions")
    .select("session_key").eq("visit_id", visitId).maybeSingle();
  if (raceLookupError) throw raceLookupError;
  if (!racedVisit || String(racedVisit.session_key) !== sessionKey) {
    throw new Error("Identificador de visita inválido.");
  }
  await updateActivity();
}

async function loadCatalog(): Promise<Map<string, any>> {
  const response = await fetch(CATALOG_URL, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error("Não foi possível validar o catálogo. Tente novamente.");
  const data = await response.json();
  if (!Array.isArray(data?.produtos)) throw new Error("Catálogo indisponível.");
  return new Map(data.produtos.map((product: any) => [String(product.id), product]));
}
function cleanItems(value: unknown, catalog: Map<string, any>) {
  if (!Array.isArray(value) || value.length > 80) throw new Error("Carrinho inválido.");
  return value.map((raw: any) => {
    const productId = cleanText(String(raw?.id ?? ""), 100);
    if (!productId) throw new Error("Produto inválido no carrinho.");
    const quantity = Math.trunc(Number(raw?.quantidade));
    const selectedDiceId = cleanText(raw?.kit_variant_id, 10);
    const product = catalog.get(productId);
    if (!product || product.esgotado === true) throw new Error("Um produto do carrinho está indisponível. Atualize o carrinho.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error("Quantidade inválida.");
    const price = Number(product?.preco);
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error("Preço inválido no catálogo.");
    const isVariableKit = VARIABLE_DICE_KIT_IDS.has(productId);
    let selectedDiceName: string | null = null;
    if (isVariableKit) {
      if (!selectedDiceId || !DICE_VARIANT_NAMES.has(selectedDiceId)) throw new Error("Escolha o Dado do Prazer incluído neste kit antes de registrar o pedido.");
      const selectedDice = catalog.get(selectedDiceId);
      if (!selectedDice || selectedDice.esgotado === true) throw new Error("A variante escolhida está indisponível. Atualize o carrinho.");
      selectedDiceName = cleanText(selectedDice.nome, 180);
    } else if (selectedDiceId) throw new Error("A variante informada não pertence a este produto. Atualize o carrinho.");
    return {
      product_id: productId,
      product_name: cleanText(product.nome, 180),
      sku: cleanText(product.sku, 80),
      quantity,
      unit_price: Math.round(price * 100) / 100,
      product_snapshot: {
        selected_dice_product_id: isVariableKit ? selectedDiceId : null,
        selected_dice_product_name: isVariableKit ? selectedDiceName : null
      }
    };
  });
}

function total(items: ReturnType<typeof cleanItems>) {
  return Math.round(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) * 100) / 100;
}

class CartInstanceConflictError extends Error {}

async function loadCartInstance(cartInstanceId: string, sessionKey: string, userId: string | null) {
  const { data, error } = await admin.from("cart_instances")
    .select("id, session_key, status, user_id")
    .eq("id", cartInstanceId)
    .maybeSingle();
  if (error) throw error;
  if (data && String(data.session_key) !== sessionKey) {
    throw new CartInstanceConflictError("Este carrinho não pertence à sessão atual. Inicie uma nova tentativa.");
  }
  if (data?.user_id && userId && String(data.user_id) !== userId) {
    throw new CartInstanceConflictError("Este carrinho pertence a outra conta. Inicie uma nova tentativa.");
  }
  return data;
}

async function ensureCartInstance(
  cartInstanceId: string,
  sessionKey: string,
  userId: string | null,
  now: string,
  isLegacy: boolean
) {
  let existing = await loadCartInstance(cartInstanceId, sessionKey, userId);
  if (existing) return existing;

  const row: Record<string, unknown> = {
    id: cartInstanceId,
    session_key: sessionKey,
    user_id: userId,
    status: "active",
    last_activity_at: now,
    created_at: now,
    updated_at: now
  };
  if (isLegacy) row.legacy_cart_session_id = cartInstanceId;

  const { error } = await admin.from("cart_instances").insert(row);
  if (!error) return { id: cartInstanceId, session_key: sessionKey, status: "active" };
  if (error.code !== "23505") throw error;

  // Same-cart concurrent requests are safe; a different browser cannot take ownership.
  existing = await loadCartInstance(cartInstanceId, sessionKey, userId);
  if (!existing) throw error;
  return existing;
}

async function updateCartInstanceActivity(
  cartInstanceId: string,
  sessionKey: string,
  userId: string | null,
  now: string,
  eventName: string,
  pageType: string,
  analyticsContext: unknown
) {
  const existing = await ensureCartInstance(cartInstanceId, sessionKey, userId, now, false);
  if (!canReuseCartInstance(existing.status, eventName, 0, false)) {
    throw new CartInstanceConflictError("Este carrinho já foi encerrado. Inicie uma nova tentativa de compra.");
  }
  const nextStatus = statusAfterVisitorActivity(existing.status);
  const patch: Record<string, unknown> = {
    ...buildCartActivityStatePatch(now, nextStatus),
    session_key: sessionKey,
    last_activity_at: now,
    last_page_type: pageType,
    last_event_name: eventName,
    analytics_consent: true
  };
  if (userId) patch.user_id = userId;
  applyAnalyticsContext(patch, analyticsContext);
  const { error } = await admin.from("cart_instances").update(patch)
    .eq("id", cartInstanceId).eq("session_key", sessionKey);
  if (error) throw error;
}

async function persistCartInstanceSnapshot(
  cartInstanceId: string,
  sessionKey: string,
  legacyCartSessionId: string,
  isLegacy: boolean,
  userId: string | null,
  action: string,
  items: ReturnType<typeof cleanItems>,
  subtotal: number,
  now: string,
  analyticsConsent: boolean,
  pageType: string | null,
  analyticsContext: unknown
) {
  const existing = await ensureCartInstance(cartInstanceId, sessionKey, userId, now, isLegacy);
  const itemCount = items.reduce((n, item) => n + item.quantity, 0);
  if (!canReuseCartInstance(existing.status, action, itemCount, isLegacy)) {
    throw new CartInstanceConflictError("Este carrinho já foi encerrado. Inicie uma nova tentativa de compra.");
  }

  if (!isLegacy && action === "cart_snapshot" && itemCount === 0) {
    const clearPatch: Record<string, unknown> = {
      status: "cleared",
      cleared_at: now,
      abandoned_at: null,
      last_activity_at: now,
      last_event_name: action,
      updated_at: now,
      analytics_consent: analyticsConsent
    };
    if (userId) clearPatch.user_id = userId;
    if (analyticsConsent && analyticsContext) applyAnalyticsContext(clearPatch, analyticsContext);
    const { error } = await admin.from("cart_instances").update(clearPatch)
      .eq("id", cartInstanceId).eq("session_key", sessionKey);
    if (error) throw error;
    return { cleared: true, item_count: 0, subtotal: 0 };
  }

  const instanceStatus = cartInstanceStatusForAction(action, itemCount, isLegacy, existing.status) || "active";
  const patch: Record<string, unknown> = {
    ...buildCartActivityStatePatch(now, instanceStatus),
    id: cartInstanceId,
    session_key: sessionKey,
    status: instanceStatus,
    items_snapshot: items,
    item_count: itemCount,
    subtotal,
    last_activity_at: now,
    last_event_name: action,
    analytics_consent: analyticsConsent,
    cleared_at: null
  };
  if (isLegacy) patch.legacy_cart_session_id = legacyCartSessionId;
  if (userId) patch.user_id = userId;
  if (pageType) patch.last_page_type = pageType;
  else if (action === "checkout_started" || action === "checkout_reviewed" || action === "whatsapp_opened") {
    patch.last_page_type = "checkout";
  }
  if (analyticsConsent) applyAnalyticsContext(patch, analyticsContext);
  else Object.assign(patch, {
    traffic_source: "unknown", traffic_source_detail: null, traffic_medium: "unknown",
    device_category: "unknown", operating_system: "unknown", browser_family: "unknown",
    utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: null, utm_term: null, utm_id: null
  });
  if (action === "checkout_started") patch.checkout_started_at = now;
  if (action === "whatsapp_opened") patch.whatsapp_opened_at = now;
  const { error } = await admin.from("cart_instances").update(patch)
    .eq("id", cartInstanceId).eq("session_key", sessionKey);
  if (error) throw error;
  return { cleared: false, item_count: itemCount, subtotal };
}

async function recordMarketingConsent(cartSessionId: string, cartInstanceId: string, userId: string | null, customer: any, now: string) {
  const name = cleanText(customer?.name, 160);
  const phone = cleanText(customer?.phone, 30);
  if (!name || !phone || customer?.marketingWhatsappOptIn !== true) return false;
  const { data: latestConsent, error: lookupError } = await admin.from("contact_consents")
    .select("id, granted, granted_at, revoked_at")
    .eq("cart_instance_id", cartInstanceId).eq("channel", "whatsapp")
    .eq("purpose", "marketing")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1).maybeSingle();
  if (lookupError) throw lookupError;
  const alreadyGranted = latestConsent?.granted === true &&
    Boolean(latestConsent?.granted_at) && !latestConsent?.revoked_at;
  if (!alreadyGranted) {
    const { error } = await admin.from("contact_consents").insert({
      user_id: userId, cart_session_id: cartSessionId, cart_instance_id: cartInstanceId,
      channel: "whatsapp", purpose: "marketing", granted: true, source: "checkout",
      consent_text_version: "whatsapp-marketing-v1", granted_at: now
    });
    if (error) throw error;
  }
  const address = customer?.address && typeof customer.address === "object" ? customer.address : {};
  const consentPatch = {
    customer_name: name, customer_phone: phone,
    city: cleanText(address.city, 100), state: cleanText(address.state, 2),
    marketing_whatsapp_opt_in: true, marketing_whatsapp_opt_in_at: now,
    updated_at: now
  };
  const [sessionUpdate, instanceUpdate] = await Promise.all([
    admin.from("cart_sessions").update(consentPatch).eq("id", cartSessionId),
    admin.from("cart_instances").update(consentPatch).eq("id", cartInstanceId)
  ]);
  if (sessionUpdate.error) throw sessionUpdate.error;
  if (instanceUpdate.error) throw instanceUpdate.error;
  return true;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (!allowedOrigins.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin",
      "cache-control": "no-store"
    }});
  }
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405, origin);
  if (!allowedOrigins.has(origin)) return response({ error: "Origem não autorizada." }, 403, origin);
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) return response({ error: "Formato de requisição inválido." }, 415, origin);
  if (Number(req.headers.get("content-length") || 0) > 16 * 1024) return response({ error: "Solicitação muito grande." }, 413, origin);

  const requestStartedAt = performance.now();
  const performanceTimings: Record<string, number> = {};
  let actionName = "unknown";

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) return response({ error: "Solicitação muito grande." }, 413, origin);
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return response({ error: "Corpo da solicitação inválido." }, 400, origin); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return response({ error: "Corpo da solicitação inválido." }, 400, origin);
    const action = body?.action;
    actionName = typeof action === "string" ? action : "unknown";
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
    let userId: string | null = null;

    if (action === "visitor_heartbeat") {
      if (body.analytics_consent !== true) return response({ ok: true, skipped: true }, 200, origin);
      const sessionKey = body.session_key;
      const requestedCartInstanceId = body.cart_instance_id == null ? null : body.cart_instance_id;
      if (requestedCartInstanceId !== null && !isUuid(requestedCartInstanceId)) {
        return response({ error: "Identificador do carrinho inválido." }, 400, origin);
      }
      const pageType = body.page_type;
      const visitId = body.visit_id == null ? null : body.visit_id;
      const pagePath = visitId ? normalizeAnalyticsPagePath(body.page_path) : null;
      const pageTitle = normalizeAnalyticsPageTitle(body.page_title);
      const allowedPages = ["home", "catalog", "product", "checkout", "institutional", "other"];
      if (!isUuid(sessionKey) || !allowedPages.includes(pageType) ||
          (visitId !== null && (!isUuid(visitId) || !pagePath))) {
        return response({ error: "Sessão, visita ou página inválida." }, 400, origin);
      }
      let guards;
      try {
        guards = await measure(performanceTimings, "guards_ms", () =>
          rateLimitAndResolveUser(req, sessionKey, true, token)
        );
      } catch (guardError) {
        if (!(guardError instanceof RateLimitUnavailableError)) throw guardError;
        console.error("cart-orders heartbeat rate limiter unavailable:", guardError.cause);
        return response({ error: "Proteção contra abuso temporariamente indisponível. Tente novamente." }, 503, origin);
      }
      userId = guards.userId;
      performanceTimings.rate_limit_ms = guards.rateLimitMs;
      performanceTimings.auth_ms = guards.authMs;
      if (!guards.withinRateLimit) return response({ error: "Muitas atualizações de presença. Aguarde um instante." }, 429, origin);

      const now = new Date().toISOString();
      const { data: currentSession, error: currentSessionError } = await measure(
        performanceTimings,
        "cart_session_lookup_ms",
        async () => await admin.from("cart_sessions")
          .select("status")
          .eq("session_key", sessionKey)
          .maybeSingle()
      );
      if (currentSessionError) throw currentSessionError;

      const heartbeatUpdate: Record<string, unknown> = {
        ...buildCartActivityStatePatch(now, statusAfterVisitorActivity(currentSession?.status)),
        session_key: sessionKey,
        analytics_consent: true,
        last_activity_at: now,
        last_page_type: pageType,
        last_event_name: "heartbeat"
      };
      if (userId) heartbeatUpdate.user_id = userId;
      applyAnalyticsContext(heartbeatUpdate, body.analytics_context);
      const { error: heartbeatError } = await measure(
        performanceTimings,
        "cart_session_upsert_ms",
        async () => await admin.from("cart_sessions").upsert(
          heartbeatUpdate, { onConflict: "session_key" }
        )
      );
      if (heartbeatError) throw heartbeatError;
      if (visitId && pagePath) {
        await measure(
          performanceTimings,
          "visit_session_upsert_ms",
          () => upsertVisitSession(visitId, sessionKey, now, pagePath, pageTitle, body.analytics_context)
        );
      }
      if (requestedCartInstanceId) {
        await measure(
          performanceTimings,
          "cart_instance_activity_ms",
          () => updateCartInstanceActivity(
            requestedCartInstanceId, sessionKey, userId, now, "heartbeat", pageType, body.analytics_context
          )
        );
      }
      return response({ ok: true, cart_instance_id: requestedCartInstanceId }, 200, origin);
    }

    if (action === "site_event") {
      if (body.analytics_consent !== true) return response({ ok: true, skipped: true }, 200, origin);
      const sessionKey = body.session_key;
      const eventName = body.event_name;
      const pageType = body.page_type;
      const requestedCartInstanceId = body.cart_instance_id == null ? null : body.cart_instance_id;
      if (requestedCartInstanceId !== null && !isUuid(requestedCartInstanceId)) {
        return response({ error: "Identificador do carrinho inválido." }, 400, origin);
      }
      const visitId = body.visit_id == null ? null : body.visit_id;
      const pagePath = visitId ? normalizeAnalyticsPagePath(body.page_path) : null;
      const pageTitle = normalizeAnalyticsPageTitle(body.page_title);
      const allowedEvents = ["page_view", "product_view", "add_to_cart", "checkout_started", "checkout_reviewed", "whatsapp_opened"];
      const allowedPages = ["home", "catalog", "product", "checkout", "institutional", "other"];
      if (!isUuid(sessionKey) || !allowedEvents.includes(eventName) || !allowedPages.includes(pageType) ||
          (visitId !== null && (!isUuid(visitId) || !pagePath))) {
        return response({ error: "Evento inválido." }, 400, origin);
      }
      let guards;
      try {
        guards = await measure(performanceTimings, "guards_ms", () =>
          rateLimitAndResolveUser(req, sessionKey, true, token)
        );
      } catch (guardError) {
        if (!(guardError instanceof RateLimitUnavailableError)) throw guardError;
        console.error("cart-orders rate limiter unavailable:", guardError.cause);
        return response({ error: "Proteção contra abuso temporariamente indisponível. Tente novamente." }, 503, origin);
      }
      userId = guards.userId;
      performanceTimings.rate_limit_ms = guards.rateLimitMs;
      performanceTimings.auth_ms = guards.authMs;
      if (!guards.withinRateLimit) return response({ error: "Muitas solicitações. Aguarde um instante e tente novamente." }, 429, origin);
      const productId = eventName === "product_view" || eventName === "add_to_cart"
        ? cleanText(body.product_id, 100) : null;
      if ((eventName === "product_view" || eventName === "add_to_cart") && !productId) {
        return response({ error: "Produto inválido." }, 400, origin);
      }
      const quantity = Math.max(1, Math.min(99, Math.trunc(Number(body.quantity) || 1)));
      const now = new Date().toISOString();
      const { data: currentSession, error: currentSessionError } = await measure(
        performanceTimings,
        "cart_session_lookup_ms",
        async () => await admin.from("cart_sessions")
          .select("status")
          .eq("session_key", sessionKey)
          .maybeSingle()
      );
      if (currentSessionError) throw currentSessionError;

      const sessionUpdate: Record<string, unknown> = {
        ...buildCartActivityStatePatch(now, statusAfterVisitorActivity(currentSession?.status)),
        session_key: sessionKey,
        analytics_consent: true,
        last_activity_at: now, last_page_type: pageType, last_event_name: eventName
      };
      if (userId) sessionUpdate.user_id = userId;
      applyAnalyticsContext(sessionUpdate, body.analytics_context);
      const { error: sessionError } = await measure(
        performanceTimings,
        "cart_session_upsert_ms",
        async () => await admin.from("cart_sessions").upsert(
          sessionUpdate, { onConflict: "session_key" }
        )
      );
      if (sessionError) throw sessionError;
      if (visitId && pagePath) {
        await measure(
          performanceTimings,
          "visit_session_upsert_ms",
          () => upsertVisitSession(visitId, sessionKey, now, pagePath, pageTitle, body.analytics_context)
        );
      }
      if (requestedCartInstanceId) {
        await measure(
          performanceTimings,
          "cart_instance_activity_ms",
          () => updateCartInstanceActivity(
            requestedCartInstanceId, sessionKey, userId, now, eventName, pageType, body.analytics_context
          )
        );
      }
      const { error } = await measure(
        performanceTimings,
        "site_event_insert_ms",
        async () => await admin.from("site_events").insert({
          session_key: sessionKey, cart_instance_id: requestedCartInstanceId,
          visit_id: visitId, event_name: eventName, page_type: pageType,
          page_path: pagePath, page_title: pageTitle,
          product_id: productId, quantity
        })
      );
      if (error) throw error;
      return response({ ok: true }, 200, origin);
    }

    if (!["cart_snapshot", "checkout_started", "checkout_reviewed", "whatsapp_opened"].includes(action)) return response({ error: "Ação inválida." }, 400, origin);
    const sessionKey = body?.session_key;
    const requestedCartInstanceId = body.cart_instance_id == null ? null : body.cart_instance_id;
    if (!isUuid(sessionKey)) return response({ error: "Sessão inválida." }, 400, origin);
    if (requestedCartInstanceId !== null && !isUuid(requestedCartInstanceId)) {
      return response({ error: "Identificador do carrinho inválido." }, 400, origin);
    }
    let guards;
    try {
      guards = await measure(performanceTimings, "guards_ms", () =>
        rateLimitAndResolveUser(req, sessionKey, false, token)
      );
    } catch (guardError) {
      if (!(guardError instanceof RateLimitUnavailableError)) throw guardError;
      console.error("cart-orders rate limiter unavailable:", guardError.cause);
      return response({ error: "Proteção contra abuso temporariamente indisponível. Tente novamente." }, 503, origin);
    }
    userId = guards.userId;
    performanceTimings.rate_limit_ms = guards.rateLimitMs;
    performanceTimings.auth_ms = guards.authMs;
    if (!guards.withinRateLimit) return response({ error: "Muitas solicitações. Aguarde um instante e tente novamente." }, 429, origin);

    // O preço do campo "preco" do catálogo é público; não consultar associação ao Clube.
    const catalog = await measure(performanceTimings, "catalog_ms", () => loadCatalog());
    const items = cleanItems(body.items || [], catalog);
    const subtotal = total(items);
    if (subtotal > 1000000) return response({ error: "Valor do carrinho inválido." }, 400, origin);
    const requestedItemCount = items.reduce((n, item) => n + item.quantity, 0);
    if (requestedCartInstanceId) {
      const currentInstance = await measure(
        performanceTimings,
        "cart_instance_precheck_ms",
        () => loadCartInstance(requestedCartInstanceId, sessionKey, userId)
      );
      if (currentInstance && !canReuseCartInstance(currentInstance.status, action, requestedItemCount, false)) {
        throw new CartInstanceConflictError("Este carrinho já foi encerrado. Inicie uma nova tentativa de compra.");
      }
    }

    const now = new Date().toISOString();
    const snapshotStatus = action === "checkout_started" ? "checkout_started" :
      action === "checkout_reviewed" ? "checkout_reviewed" :
      action === "whatsapp_opened" ? "whatsapp_opened" : "active";
    const snapshot: Record<string, unknown> = {
      ...buildCartActivityStatePatch(now, snapshotStatus),
      session_key: sessionKey,
      items_snapshot: items,
      item_count: items.reduce((n, item) => n + item.quantity, 0),
      subtotal,
      last_activity_at: now,
      analytics_consent: body.analytics_consent === true
    };
    const allowedPages = ["home", "catalog", "product", "checkout", "institutional", "other"];
    const requestedPageType = cleanText(body.page_type, 40);
    if (requestedPageType && allowedPages.includes(requestedPageType)) snapshot.last_page_type = requestedPageType;
    else if (action === "checkout_started" || action === "checkout_reviewed" || action === "whatsapp_opened") snapshot.last_page_type = "checkout";
    snapshot.last_event_name = action;
    if (body.analytics_consent === true) applyAnalyticsContext(snapshot, body.analytics_context);
    else Object.assign(snapshot, {
      traffic_source: "unknown", traffic_source_detail: null, traffic_medium: "unknown",
      device_category: "unknown", operating_system: "unknown", browser_family: "unknown",
      utm_source: null, utm_medium: null, utm_campaign: null,
      utm_content: null, utm_term: null, utm_id: null
    });
    if (action === "checkout_started") snapshot.checkout_started_at = now;
    if (action === "whatsapp_opened") snapshot.whatsapp_opened_at = now;
    if (userId) snapshot.user_id = userId;

    const { data: cart, error: cartError } = await measure(
      performanceTimings,
      "cart_session_upsert_ms",
      async () => await admin.from("cart_sessions")
        .upsert(snapshot, { onConflict: "session_key" })
        .select("id")
        .single()
    );
    if (cartError) throw cartError;

    const resolvedCart = resolveCartInstanceId(requestedCartInstanceId, cart.id);
    const cartInstanceId = resolvedCart.id;
    const pageTypeForInstance = typeof snapshot.last_page_type === "string" ? snapshot.last_page_type : null;
    const instanceSnapshot = await measure(
      performanceTimings,
      "cart_instance_snapshot_ms",
      () => persistCartInstanceSnapshot(
        cartInstanceId, sessionKey, cart.id, resolvedCart.isLegacy, userId,
        action, items, subtotal, now, body.analytics_consent === true,
        pageTypeForInstance, body.analytics_context
      )
    );

    if (action === "checkout_reviewed") {
      let marketingOptIn = false;
      if (body.customer?.marketingWhatsappOptIn === true) {
        try { marketingOptIn = await recordMarketingConsent(cart.id, cartInstanceId, userId, body.customer, now); }
        catch (consentError) { console.error("Luxuriosa: falha ao registrar consentimento:", consentError); }
      }
      return response({ ok: true, cart_instance_id: cartInstanceId, cart_cleared: instanceSnapshot.cleared, marketing_opt_in: marketingOptIn }, 200, origin);
    }
    if (action !== "whatsapp_opened") {
      return response({
        ok: true, cart_instance_id: cartInstanceId,
        cart_cleared: instanceSnapshot.cleared
      }, 200, origin);
    }

    const customerName = cleanText(body.customer?.name, 160);
    const customerPhone = cleanText(body.customer?.phone, 30);
    if (!customerName || !customerPhone || items.length === 0) {
      return response({ error: "Dados do pedido incompletos." }, 400, origin);
    }
    const fulfillmentInput = cleanText(body.customer?.fulfillmentType, 20);
    if (fulfillmentInput && !["express", "pickup"].includes(fulfillmentInput)) {
      return response({ error: "Modalidade de recebimento inválida." }, 400, origin);
    }
    const fulfillmentType = fulfillmentInput === "pickup" ? "pickup" : "express";
    let pickupRequestedAt: string | null = null;
    if (fulfillmentType === "pickup") {
      const requestedAtInput = body.customer?.pickupRequestedAt;
      const requestedAtDate = typeof requestedAtInput === "string" ? new Date(requestedAtInput) : null;
      if (!requestedAtDate || !Number.isFinite(requestedAtDate.getTime())) {
        return response({ error: "Informe uma data e um horário válidos para a retirada." }, 400, origin);
      }
      pickupRequestedAt = requestedAtDate.toISOString();
    }
    const submittedAddress = body.customer?.address && typeof body.customer.address === "object"
      ? body.customer.address : {};
    const address = fulfillmentType === "pickup" ? {} : submittedAddress;
    // WhatsApp is a request for human confirmation, not a final checkout.
    // Never persist a shipping amount supplied by the browser as an authoritative quote.
    const subtotalCents = Math.round(subtotal * 100);
    const shippingCents = fulfillmentType === "pickup" ? 0 : null;
    // As promoções do catálogo são públicas; o pedido não aplica desconto adicional.
    const clubDiscountCents = 0;
    const totalCents = subtotalCents + (shippingCents || 0);

    const { data: previousOrder, error: previousOrderError } = await admin.from("orders")
      .select("id, order_number, customer_id, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, fulfillment_type, pickup_requested_at")
      .eq("cart_instance_id", cartInstanceId)
      .eq("status", "awaiting_confirmation")
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previousOrderError) throw previousOrderError;
    if (previousOrder) {
      const { data: previousItems, error: previousItemsError } = await admin.from("order_items")
        .select("product_id, product_name, sku, quantity, unit_price, product_snapshot")
        .eq("order_id", previousOrder.id);
      if (previousItemsError) throw previousItemsError;
      const normalizeItems = (rows: any[]) => rows.map(item => ({
        product_id: item.product_id || null,
        product_name: item.product_name || "",
        sku: item.sku || null,
        quantity: Number(item.quantity),
        unit_price: Math.round(Number(item.unit_price) * 100),
        selected_dice_product_id: item.product_snapshot?.selected_dice_product_id || null
      })).sort((a,b) =>
        String(a.product_id).localeCompare(String(b.product_id)) ||
        String(a.product_name).localeCompare(String(b.product_name)) ||
        String(a.sku).localeCompare(String(b.sku)) ||
        a.quantity - b.quantity ||
        a.unit_price - b.unit_price ||
        String(a.selected_dice_product_id || "").localeCompare(String(b.selected_dice_product_id || ""))
      );
      const sameItems = JSON.stringify(normalizeItems(previousItems || [])) ===
        JSON.stringify(normalizeItems(items));
      const previousAddress = previousOrder.delivery_address || {};
      const addressKeys = ["zip","street","number","complement","district","city","state","reference"];
      const sameAddress = addressKeys.every(key =>
        String(previousAddress[key] || "") === String(address[key] || "")
      );
      const previousPickupRequestedAt = previousOrder.pickup_requested_at
        ? new Date(previousOrder.pickup_requested_at).getTime()
        : null;
      const currentPickupRequestedAt = pickupRequestedAt
        ? new Date(pickupRequestedAt).getTime()
        : null;
      const sameOrder =
        previousOrder.fulfillment_type === fulfillmentType &&
        previousPickupRequestedAt === currentPickupRequestedAt &&
        previousOrder.customer_id === userId &&
        previousOrder.customer_name === customerName &&
        previousOrder.customer_phone === customerPhone &&
        Math.round(Number(previousOrder.subtotal || 0) * 100) === subtotalCents &&
        (previousOrder.shipping_amount == null ? null : Math.round(Number(previousOrder.shipping_amount) * 100)) === shippingCents &&
        Number(previousOrder.club_discount_amount_cents || 0) === clubDiscountCents &&
        Number(previousOrder.club_discount_percent || 0) === 0 &&
        sameAddress && sameItems;

      if (sameOrder) {
        let marketingOptIn = false;
        if (body.customer?.marketingWhatsappOptIn === true) {
          try { marketingOptIn = await recordMarketingConsent(cart.id, cartInstanceId, userId, body.customer, now); }
          catch (consentError) { console.error("Luxuriosa: falha ao registrar consentimento:", consentError); }
        }
        return response({
          ok: true,
          order_number: previousOrder.order_number,
          total_amount: Number(previousOrder.total_amount) || 0,
          fulfillment_type: previousOrder.fulfillment_type,
          pickup_requested_at: previousOrder.pickup_requested_at,
          club_discount_amount: Number(previousOrder.club_discount_amount_cents || 0) / 100,
          club_discount_percent: Number(previousOrder.club_discount_percent || 0),
          duplicate: true,
          marketing_opt_in: marketingOptIn
        }, 200, origin);
      }

      return response({
        code: "recent_whatsapp_order_mismatch",
        error: "Já existe um pedido recente para este carrinho com dados ou benefícios diferentes. Para evitar duplicidade, não criamos outro automaticamente. Fale com a equipe da Luxuriosa para conferir o pedido anterior."
      }, 409, origin);
    }

    const { data: order, error: orderError } = await admin.from("orders").insert({
      cart_session_id: cart.id,
      cart_instance_id: cartInstanceId,
      customer_id: userId,
      status: "awaiting_confirmation",
      source: "whatsapp",
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_address: address,
      fulfillment_type: fulfillmentType,
      pickup_requested_at: pickupRequestedAt,
      subtotal: subtotalCents / 100,
      shipping_amount: shippingCents === null ? null : shippingCents / 100,
      total_amount: totalCents / 100,
      club_discount_amount_cents: clubDiscountCents,
      club_discount_percent: 0,
      club_discount_rule_version: null,
      whatsapp_opened_at: now
    }).select("id, order_number").single();
    if (orderError) throw orderError;

    const orderRows = items.map(item => ({ ...item, order_id: order.id }));
    const { error: itemsError } = await admin.from("order_items").insert(orderRows);
    if (itemsError) {
      await admin.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    let marketingOptIn = false;
    if (body.customer?.marketingWhatsappOptIn === true) {
      try { marketingOptIn = await recordMarketingConsent(cart.id, cartInstanceId, userId, body.customer, now); }
      catch (consentError) { console.error("Luxuriosa: falha ao registrar consentimento:", consentError); }
    }

    return response({
      ok: true,
      cart_instance_id: cartInstanceId,
      order_number: order.order_number,
      subtotal_amount: subtotalCents / 100,
      club_discount_amount: clubDiscountCents / 100,
      club_discount_percent: 0,
      shipping_amount: shippingCents === null ? null : shippingCents / 100,
      total_amount: totalCents / 100,
      fulfillment_type: fulfillmentType,
      pickup_requested_at: pickupRequestedAt,
      marketing_opt_in: marketingOptIn
    }, 200, origin);
  } catch (error) {
    console.error("cart-orders:", error);
    const status = error instanceof CartInstanceConflictError ? 409 : 400;
    return response({ error: error instanceof Error ? error.message : "Não foi possível registrar." }, status, origin);
  } finally {
    const totalMs = Math.round(performance.now() - requestStartedAt);
    if (totalMs >= 250) {
      console.info("cart-orders:performance", JSON.stringify({
        action: actionName,
        total_ms: totalMs,
        ...performanceTimings
      }));
    }
  }
});