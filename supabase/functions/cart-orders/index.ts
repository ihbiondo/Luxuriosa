import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const allowedOrigins = new Set(["https://luxuriosa.com.br", "https://www.luxuriosa.com.br"]);
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
      "vary": "Origin"
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
function cleanItems(value: unknown) {
  if (!Array.isArray(value) || value.length > 80) throw new Error("Carrinho inválido.");
  return value.map((raw: any) => {
    const name = cleanText(raw?.nome, 180);
    const productId = cleanText(raw?.id, 100);
    const quantity = Math.trunc(Number(raw?.quantidade));
    const price = Number(raw?.preco);
    const selectedDiceId = cleanText(raw?.kit_variant_id, 10);
    const isVariableKit = Boolean(productId && VARIABLE_DICE_KIT_IDS.has(productId));
    if (!name || !Number.isInteger(quantity) || quantity < 1 || quantity > 999 ||
        !Number.isFinite(price) || price < 0 || price > 100000) throw new Error("Item inválido.");
    if (isVariableKit && (!selectedDiceId || !DICE_VARIANT_NAMES.has(selectedDiceId))) {
      throw new Error("Escolha o Dado do Prazer incluído neste kit antes de registrar o pedido.");
    }
    if (!isVariableKit && selectedDiceId) {
      throw new Error("A variante informada não pertence a este produto. Atualize o carrinho.");
    }
    return {
      product_id: productId,
      product_name: name,
      sku: cleanText(raw?.sku, 80),
      quantity,
      unit_price: Math.round(price * 100) / 100,
      product_snapshot: {
        selected_dice_product_id: isVariableKit ? selectedDiceId : null,
        selected_dice_product_name: isVariableKit ? DICE_VARIANT_NAMES.get(selectedDiceId) : null
      }
    };
  });
}
function total(items: ReturnType<typeof cleanItems>) {
  return Math.round(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) * 100) / 100;
}

async function recordMarketingConsent(cartId: string, userId: string | null, customer: any, now: string) {
  const name = cleanText(customer?.name, 160);
  const phone = cleanText(customer?.phone, 30);
  if (!name || !phone || customer?.marketingWhatsappOptIn !== true) return false;
  const { data: existing, error: lookupError } = await admin.from("contact_consents")
    .select("id").eq("cart_session_id", cartId).eq("channel", "whatsapp")
    .eq("purpose", "marketing").eq("granted", true).is("revoked_at", null)
    .limit(1).maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) {
    const { error } = await admin.from("contact_consents").insert({
      user_id: userId, cart_session_id: cartId, channel: "whatsapp",
      purpose: "marketing", granted: true, source: "checkout",
      consent_text_version: "whatsapp-marketing-v1", granted_at: now
    });
    if (error) throw error;
  }
  const address = customer?.address && typeof customer.address === "object" ? customer.address : {};
  const { error: updateError } = await admin.from("cart_sessions").update({
    customer_name: name, customer_phone: phone,
    city: cleanText(address.city, 100), state: cleanText(address.state, 2),
    marketing_whatsapp_opt_in: true, marketing_whatsapp_opt_in_at: now,
    updated_at: now
  }).eq("id", cartId);
  if (updateError) throw updateError;
  return true;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": allowedOrigins.has(origin) ? origin : "https://luxuriosa.com.br",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "Origin"
  }});
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return response({ error: "Origem não autorizada." }, 403, origin);

  try {
    const body = await req.json();
    const action = body?.action;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    if (token) {
      const { data, error } = await admin.auth.getUser(token);
      if (!error) userId = data.user?.id || null;
    }

    if (action === "site_event") {
      if (body.analytics_consent !== true) return response({ ok: true, skipped: true }, 200, origin);
      const sessionKey = body.session_key;
      const eventName = body.event_name;
      const pageType = body.page_type;
      const allowedEvents = ["page_view", "product_view", "add_to_cart", "checkout_started", "checkout_reviewed", "whatsapp_opened"];
      const allowedPages = ["home", "catalog", "product", "checkout", "institutional", "other"];
      if (!isUuid(sessionKey) || !allowedEvents.includes(eventName) || !allowedPages.includes(pageType)) {
        return response({ error: "Evento inválido." }, 400, origin);
      }
      const productId = eventName === "product_view" || eventName === "add_to_cart"
        ? cleanText(body.product_id, 100) : null;
      if ((eventName === "product_view" || eventName === "add_to_cart") && !productId) {
        return response({ error: "Produto inválido." }, 400, origin);
      }
      const quantity = Math.max(1, Math.min(99, Math.trunc(Number(body.quantity) || 1)));
      const now = new Date().toISOString();
      const { error: sessionError } = await admin.from("cart_sessions").upsert({
        session_key: sessionKey, user_id: userId, status: "active",
        last_activity_at: now, updated_at: now
      }, { onConflict: "session_key" });
      if (sessionError) throw sessionError;
      const { error } = await admin.from("site_events").insert({
        session_key: sessionKey, event_name: eventName, page_type: pageType,
        product_id: productId, quantity
      });
      if (error) throw error;
      return response({ ok: true }, 200, origin);
    }

    const sessionKey = body?.session_key;
    if (!isUuid(sessionKey)) return response({ error: "Sessão inválida." }, 400, origin);
    const items = cleanItems(body.items || []);
    const subtotal = total(items);
    if (subtotal > 1000000) return response({ error: "Valor do carrinho inválido." }, 400, origin);

    if (token && !userId) {
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id || null;
    }

    if (!["cart_snapshot", "checkout_started", "checkout_reviewed", "whatsapp_opened"].includes(action)) {
      return response({ error: "Ação inválida." }, 400, origin);
    }

    const now = new Date().toISOString();
    const snapshot: Record<string, unknown> = {
      session_key: sessionKey,
      user_id: userId,
      status: action === "checkout_started" ? "checkout_started" :
        action === "checkout_reviewed" ? "checkout_reviewed" :
        action === "whatsapp_opened" ? "whatsapp_opened" : "active",
      items_snapshot: items,
      item_count: items.reduce((n, item) => n + item.quantity, 0),
      subtotal,
      last_activity_at: now,
      updated_at: now
    };
    if (action === "checkout_started") snapshot.checkout_started_at = now;
    if (action === "whatsapp_opened") snapshot.whatsapp_opened_at = now;
    if (userId) snapshot.user_id = userId;

    const { data: cart, error: cartError } = await admin.from("cart_sessions")
      .upsert(snapshot, { onConflict: "session_key" })
      .select("id")
      .single();
    if (cartError) throw cartError;

    if (action === "checkout_reviewed") {
      let marketingOptIn = false;
      if (body.customer?.marketingWhatsappOptIn === true) {
        try { marketingOptIn = await recordMarketingConsent(cart.id, userId, body.customer, now); }
        catch (consentError) { console.error("Luxuriosa: falha ao registrar consentimento:", consentError); }
      }
      return response({ ok: true, marketing_opt_in: marketingOptIn }, 200, origin);
    }
    if (action !== "whatsapp_opened") return response({ ok: true }, 200, origin);

    const customerName = cleanText(body.customer?.name, 160);
    const customerPhone = cleanText(body.customer?.phone, 30);
    if (!customerName || !customerPhone || items.length === 0) {
      return response({ error: "Dados do pedido incompletos." }, 400, origin);
    }
    const address = body.customer?.address && typeof body.customer.address === "object"
      ? body.customer.address : {};
    const shipping = body.shipping_amount == null ? null : Number(body.shipping_amount);
    if (shipping !== null && (!Number.isFinite(shipping) || shipping < 0 || shipping > 10000)) {
      return response({ error: "Frete inválido." }, 400, origin);
    }
    const subtotalCents = Math.round(subtotal * 100);
    const shippingCents = shipping === null ? null : Math.round(shipping * 100);
    let isClubMember = false;
    if (userId) {
      const { data: membership, error: membershipError } = await admin.from("club_memberships")
        .select("user_id").eq("user_id", userId).eq("active", true).maybeSingle();
      if (membershipError) throw membershipError;
      isClubMember = Boolean(membership?.user_id);
    }
    const clubDiscountCents = isClubMember && subtotalCents > 10000
      ? Math.round(subtotalCents * 10 / 100)
      : 0;
    const totalCents = subtotalCents - clubDiscountCents + (shippingCents || 0);

    const { data: previousOrder, error: previousOrderError } = await admin.from("orders")
      .select("id, order_number, customer_id, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent")
      .eq("cart_session_id", cart.id)
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
      const sameOrder =
        previousOrder.customer_id === userId &&
        previousOrder.customer_name === customerName &&
        previousOrder.customer_phone === customerPhone &&
        Math.round(Number(previousOrder.subtotal || 0) * 100) === subtotalCents &&
        (previousOrder.shipping_amount == null ? null : Math.round(Number(previousOrder.shipping_amount) * 100)) === shippingCents &&
        Number(previousOrder.club_discount_amount_cents || 0) === clubDiscountCents &&
        Number(previousOrder.club_discount_percent || 0) === (clubDiscountCents > 0 ? 10 : 0) &&
        sameAddress && sameItems;

      if (sameOrder) {
        let marketingOptIn = false;
        if (body.customer?.marketingWhatsappOptIn === true) {
          try { marketingOptIn = await recordMarketingConsent(cart.id, userId, body.customer, now); }
          catch (consentError) { console.error("Luxuriosa: falha ao registrar consentimento:", consentError); }
        }
        return response({
          ok: true,
          order_number: previousOrder.order_number,
          total_amount: Number(previousOrder.total_amount) || 0,
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
      customer_id: userId,
      status: "awaiting_confirmation",
      source: "whatsapp",
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_address: address,
      subtotal: subtotalCents / 100,
      shipping_amount: shippingCents === null ? null : shippingCents / 100,
      total_amount: totalCents / 100,
      club_discount_amount_cents: clubDiscountCents,
      club_discount_percent: clubDiscountCents > 0 ? 10 : 0,
      club_discount_rule_version: clubDiscountCents > 0 ? "clube-10-v1-2026-11" : null,
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
      try { marketingOptIn = await recordMarketingConsent(cart.id, userId, body.customer, now); }
      catch (consentError) { console.error("Luxuriosa: falha ao registrar consentimento:", consentError); }
    }

    return response({
      ok: true,
      order_number: order.order_number,
      subtotal_amount: subtotalCents / 100,
      club_discount_amount: clubDiscountCents / 100,
      club_discount_percent: clubDiscountCents > 0 ? 10 : 0,
      shipping_amount: shippingCents === null ? null : shippingCents / 100,
      total_amount: totalCents / 100,
      marketing_opt_in: marketingOptIn
    }, 200, origin);
  } catch (error) {
    console.error("cart-orders:", error);
    return response({ error: error instanceof Error ? error.message : "Não foi possível registrar." }, 400, origin);
  }
});