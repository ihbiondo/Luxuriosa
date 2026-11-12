import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const allowedOrigins = new Set(["https://luxuriosa.com.br", "https://www.luxuriosa.com.br"]);

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
const KITS_WITH_DICE_CHOICE = new Set(["22", "23", "24", "27", "28", "29"]);
const DICE_OPTIONS: Record<string, string> = {
  "1": "Dado do Prazer — Gay",
  "2": "Dado do Prazer — Hétero",
  "3": "Dado do Prazer — Lésbico"
};

function cleanItems(value: unknown) {
  if (!Array.isArray(value) || value.length > 80) throw new Error("Carrinho inválido.");
  return value.map((raw: any) => {
    const name = cleanText(raw?.nome, 180);
    const quantity = Math.trunc(Number(raw?.quantidade));
    const price = Number(raw?.preco);
    if (!name || !Number.isInteger(quantity) || quantity < 1 || quantity > 999 ||
        !Number.isFinite(price) || price < 0 || price > 100000) throw new Error("Item inválido.");
    const productId = cleanText(raw?.id, 100);
    const rawSelected = Array.isArray(raw?.selected_components) ? raw.selected_components : [];
    const selectedComponents = rawSelected.map((component: any) => {
      const id = cleanText(component?.product_id, 10) || "";
      const componentQuantity = Number(component?.quantity);
      if (!Object.prototype.hasOwnProperty.call(DICE_OPTIONS, id) ||
          !Number.isSafeInteger(componentQuantity) || componentQuantity !== 1) {
        throw new Error("A versão do Dado do Prazer selecionada no kit é inválida.");
      }
      return { product_id: id, product_name: DICE_OPTIONS[id], quantity: 1 };
    });
    if (KITS_WITH_DICE_CHOICE.has(productId || "") && selectedComponents.length !== 1) {
      throw new Error("Escolha a versão do Dado do Prazer antes de continuar com este kit.");
    }
    if (!KITS_WITH_DICE_CHOICE.has(productId || "") && selectedComponents.length) {
      throw new Error("A seleção de componente não corresponde ao produto informado.");
    }
    return {
      product_id: productId,
      product_name: name,
      sku: cleanText(raw?.sku, 80),
      quantity,
      unit_price: Math.round(price * 100) / 100,
      product_snapshot: selectedComponents.length ? { selected_components: selectedComponents } : {}
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

    if (action === "admin_update_order_status") {
      if (!userId) return response({ error: "Faça login para alterar pedidos." }, 401, origin);
      const { data: permission, error: permissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (permissionError) throw permissionError;
      if (permission?.role !== "admin") return response({ error: "Acesso restrito à administração." }, 403, origin);
      const orderId = body.order_id;
      const nextStatus = body.status;
      const allowedStatuses = ["awaiting_confirmation", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"];
      if (!isUuid(orderId) || !allowedStatuses.includes(nextStatus)) {
        return response({ error: "Pedido ou status inválido." }, 400, origin);
      }
      const { data: current, error: currentError } = await admin.from("orders")
        .select("id, order_number, status, cart_session_id, payment_status, dispatch_started_at, dispatched_at, delivered_at").eq("id", orderId).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return response({ error: "Pedido não encontrado." }, 404, origin);
      const paidStatuses = ["confirmed", "processing", "out_for_delivery", "delivered"];
      if (current.status === "cancelled") {
        return response({ error: "Pedido cancelado não pode ser reaberto por este painel." }, 409, origin);
      }
      if (nextStatus === "cancelled") {
        if (current.payment_status === "paid") {
          return response({ error: "O pagamento já foi aprovado. Faça a conferência e o estorno na InfinitePay antes de encerrar este pedido." }, 409, origin);
        }
        if (current.payment_status === "review_required") {
          return response({ error: "Este pagamento está em conferência. Resolva a conciliação antes de cancelar o pedido." }, 409, origin);
        }
      } else if (!paidStatuses.includes(nextStatus) || current.payment_status !== "paid") {
        return response({ error: "A etapa de expedição só pode ser editada depois que a InfinitePay confirmar o pagamento." }, 409, origin);
      }
      if (nextStatus === current.status) {
        return response({ ok: true, order: current, previous_status: current.status }, 200, origin);
      }
      const now = new Date().toISOString();
      const update: Record<string, unknown> = { status: nextStatus, updated_at: now };
      if (nextStatus === "confirmed") {
        update.confirmed_at = now;
        update.dispatch_started_at = null;
        update.dispatched_at = null;
        update.delivered_at = null;
      }
      if (nextStatus === "processing") {
        update.dispatch_started_at = now;
        update.dispatched_at = null;
        update.delivered_at = null;
      }
      if (nextStatus === "out_for_delivery") {
        update.dispatched_at = now;
        update.delivered_at = null;
      }
      if (nextStatus === "delivered") update.delivered_at = now;
      const { data: updated, error: updateError } = await admin.from("orders")
        .update(update).eq("id", orderId).eq("status", current.status)
        .select("id, order_number, status, updated_at, confirmed_at").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) {
        return response({ error: "O pedido foi alterado por outra operação. Atualize o painel e tente novamente." }, 409, origin);
      }
      if (nextStatus === "confirmed" && current.cart_session_id) {
        const { error: cartError } = await admin.from("cart_sessions").update({
          status: "converted", converted_at: now, updated_at: now
        }).eq("id", current.cart_session_id);
        if (cartError) throw cartError;
      }
      return response({ ok: true, order: updated, previous_status: current.status }, 200, origin);
    }

    if (action === "admin_intelligence") {
      if (!userId) return response({ error: "Faça login para acessar o painel." }, 401, origin);
      const { data: permission, error: permissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (permissionError) throw permissionError;
      if (permission?.role !== "admin") return response({ error: "Acesso restrito à administração." }, 403, origin);
      const days = Math.min(90, Math.max(7, Number(body.days) || 30));
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const base = () => admin.from("site_events").select("id", { count: "exact", head: true }).gte("created_at", since);
      const [views, productViews, adds, checkouts, reviewed, whatsapp, eventTotal] = await Promise.all([
        base().eq("event_name", "page_view"), base().eq("event_name", "product_view"),
        base().eq("event_name", "add_to_cart"), base().eq("event_name", "checkout_started"),
        base().eq("event_name", "checkout_reviewed"), base().eq("event_name", "whatsapp_opened"),
        base()
      ]);
      for (const result of [views, productViews, adds, checkouts, reviewed, whatsapp, eventTotal]) {
        if (result.error) throw result.error;
      }
      const pageCount = Math.min(10, Math.ceil((eventTotal.count || 0) / 1000));
      const eventPages = await Promise.all(Array.from({ length: pageCount }, (_, page) =>
        admin.from("site_events").select("session_key,event_name,page_type,product_id,quantity,created_at")
          .gte("created_at", since).order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(page * 1000, page * 1000 + 999)
      ));
      for (const result of eventPages) if (result.error) throw result.error;
      const rows = eventPages.flatMap(result => result.data || []);
      const sessions = new Set(rows.map((event: any) => event.session_key));
      const daily = new Map<string, any>(), products = new Map<string, any>(), pages = new Map<string, number>();
      for (const event of rows) {
        const day = String(event.created_at).slice(0, 10);
        if (!daily.has(day)) daily.set(day, { date: day, visits: 0, product_views: 0, adds: 0, checkouts: 0, whatsapp: 0 });
        const d = daily.get(day);
        if (event.event_name === "page_view") d.visits += 1;
        if (event.event_name === "product_view") d.product_views += 1;
        if (event.event_name === "add_to_cart") d.adds += 1;
        if (event.event_name === "checkout_started" || event.event_name === "checkout_reviewed") d.checkouts += 1;
        if (event.event_name === "whatsapp_opened") d.whatsapp += 1;
        if (event.event_name === "page_view") pages.set(event.page_type, (pages.get(event.page_type) || 0) + 1);
        if (event.event_name === "product_view" && event.product_id) {
          if (!products.has(event.product_id)) products.set(event.product_id, { product_id: event.product_id, views: 0, adds: 0, quantity_added: 0 });
          products.get(event.product_id).views += 1;
        }
        if (event.event_name === "add_to_cart" && event.product_id) {
          if (!products.has(event.product_id)) products.set(event.product_id, { product_id: event.product_id, views: 0, adds: 0, quantity_added: 0 });
          products.get(event.product_id).adds += 1;
          products.get(event.product_id).quantity_added += Number(event.quantity || 1);
        }
      }
      return response({
        ok: true, period_days: days, truncated: (eventTotal.count || 0) > rows.length,
        summary: { total_events: eventTotal.count || 0, visits: views.count || 0, unique_sessions: sessions.size,
          product_views: productViews.count || 0, add_to_cart: adds.count || 0,
          checkout_started: checkouts.count || 0, checkout_reviewed: reviewed.count || 0,
          whatsapp_opened: whatsapp.count || 0 },
        daily: Array.from(daily.values()).sort((a: any, b: any) => a.date.localeCompare(b.date)),
        top_products: Array.from(products.values()).sort((a: any,b: any) => b.views - a.views || b.adds - a.adds).slice(0, 12),
        pages: Array.from(pages.entries()).map(([page_type, count]) => ({ page_type, count }))
      }, 200, origin);
    }

    if (action === "admin_live_activity") {
      if (!userId) return response({ error: "Faça login para acessar o painel." }, 401, origin);
      const { data: permission, error: permissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (permissionError) throw permissionError;
      if (permission?.role !== "admin") return response({ error: "Acesso restrito à administração." }, 403, origin);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const activeSince = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const [events, sessions] = await Promise.all([
        admin.from("site_events").select("session_key,event_name,page_type,product_id,quantity,created_at")
          .gte("created_at", since).order("created_at", { ascending: false }).limit(60),
        admin.from("cart_sessions").select("session_key,status,item_count,subtotal,last_activity_at,items_snapshot")
          .gte("last_activity_at", activeSince).order("last_activity_at", { ascending: false }).limit(100)
      ]);
      if (events.error) throw events.error;
      if (sessions.error) throw sessions.error;
      return response({
        ok: true,
        active_visitors: new Set((sessions.data || []).map((row: any) => row.session_key)).size,
        sessions: (sessions.data || []).map((row: any) => ({
          session_key: row.session_key, status: row.status, item_count: row.item_count,
          subtotal: row.subtotal, last_activity_at: row.last_activity_at,
          items_snapshot: row.items_snapshot
        })),
        events: (events.data || []).map((row: any) => ({
          session_key: row.session_key, event_name: row.event_name, page_type: row.page_type,
          product_id: row.product_id, quantity: row.quantity, created_at: row.created_at
        }))
      }, 200, origin);
    }

    if (action === "admin_dashboard") {
      if (!userId) return response({ error: "Faça login para acessar o painel." }, 401, origin);
      const { data: permission, error: permissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (permissionError) throw permissionError;
      if (permission?.role !== "admin") return response({ error: "Acesso restrito à administração." }, 403, origin);

      const days = Math.min(90, Math.max(7, Number(body.days) || 30));
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const q = cleanText(body.q, 100);
      const status = cleanText(body.status, 40);
      const [activeCount, abandonedCount, pendingCount, optInCount, recentCarts, periodOrders, allRecentOrders, liveEvents, liveSessions] = await Promise.all([
        admin.from("cart_sessions").select("id", { count: "exact", head: true }).in("status", ["active", "checkout_started", "checkout_reviewed"]),
        admin.from("cart_sessions").select("id", { count: "exact", head: true }).eq("status", "abandoned"),
        admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "awaiting_confirmation"),
        admin.from("contact_consents").select("id", { count: "exact", head: true }).eq("channel", "whatsapp").eq("purpose", "marketing").eq("granted", true).is("revoked_at", null),
        admin.from("cart_sessions").select("id, status, item_count, subtotal, customer_name, customer_phone, city, state, marketing_whatsapp_opt_in, last_activity_at, abandoned_at, items_snapshot").in("status", ["active", "checkout_started", "checkout_reviewed", "abandoned"]).order("last_activity_at", { ascending: false }).limit(60),
        admin.from("orders").select("id, order_number, status, subtotal, total_amount, club_discount_amount_cents, club_discount_percent, created_at").gte("created_at", since).neq("status", "cancelled").order("created_at", { ascending: true }).limit(1000),
        admin.from("orders").select("id, order_number, status, payment_status, payment_method, payment_provider, payment_transaction_nsu, payment_invoice_slug, payment_checkout_url, payment_expires_at, payment_amount_cents, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, created_at, cart_session_id").order("created_at", { ascending: false }).limit(100),
        admin.from("site_events").select("session_key,event_name,page_type,product_id,quantity,created_at").gte("created_at", new Date(Date.now()-24*60*60*1000).toISOString()).order("created_at", { ascending: false }).limit(80),
        admin.from("cart_sessions").select("session_key,status,item_count,subtotal,last_activity_at,items_snapshot").gte("last_activity_at", new Date(Date.now()-5*60*1000).toISOString()).order("last_activity_at", { ascending: false }).limit(100)
      ]);
      for (const result of [activeCount, abandonedCount, pendingCount, optInCount, recentCarts, periodOrders, allRecentOrders, liveEvents, liveSessions]) {
        if (result.error) throw result.error;
      }

      let orders = allRecentOrders.data || [];
      if (q) {
        const nameSearch = admin.from("orders").select("id, order_number, status, payment_status, payment_method, payment_provider, payment_transaction_nsu, payment_invoice_slug, payment_checkout_url, payment_expires_at, payment_amount_cents, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, created_at, cart_session_id").ilike("customer_name", "%" + q + "%").order("created_at", { ascending: false }).limit(100);
        const phoneSearch = admin.from("orders").select("id, order_number, status, payment_status, payment_method, payment_provider, payment_transaction_nsu, payment_invoice_slug, payment_checkout_url, payment_expires_at, payment_amount_cents, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, created_at, cart_session_id").ilike("customer_phone", "%" + q + "%").order("created_at", { ascending: false }).limit(100);
        const [byName, byPhone] = await Promise.all([nameSearch, phoneSearch]);
        if (byName.error) throw byName.error;
        if (byPhone.error) throw byPhone.error;
        const found = new Map<string, any>();
        for (const order of [...(byName.data || []), ...(byPhone.data || [])]) found.set(order.id, order);
        if (/^\\d+$/.test(q)) {
          const { data, error } = await admin.from("orders").select("id, order_number, status, payment_status, payment_method, payment_provider, payment_transaction_nsu, payment_invoice_slug, payment_checkout_url, payment_expires_at, payment_amount_cents, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, created_at, cart_session_id").eq("order_number", Number(q)).limit(1);
          if (error) throw error;
          for (const order of data || []) found.set(order.id, order);
        }
        orders = Array.from(found.values()).sort((a,b) => new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
      }
      if (status) orders = orders.filter((order: any) => order.status === status);
      const orderIds = orders.map((order: any) => order.id);
      let orderItems: any[] = [];
      if (orderIds.length) {
        const { data, error } = await admin.from("order_items")
          .select("order_id, product_name, quantity, unit_price").in("order_id", orderIds);
        if (error) throw error;
        orderItems = data || [];
      }

      const cartIds = (recentCarts.data || []).map((cart: any) => cart.id);
      let activeConsentCartIds = new Set<string>();
      if (cartIds.length) {
        const { data, error } = await admin.from("contact_consents")
          .select("cart_session_id").in("cart_session_id", cartIds)
          .eq("channel", "whatsapp").eq("purpose", "marketing")
          .eq("granted", true).is("revoked_at", null);
        if (error) throw error;
        activeConsentCartIds = new Set((data || []).map((consent: any) => consent.cart_session_id).filter(Boolean));
      }
      const carts = (recentCarts.data || []).map((cart: any) => {
        const recoveryAllowed = activeConsentCartIds.has(cart.id);
        return {
          ...cart,
          customer_phone: recoveryAllowed ? cart.customer_phone : null,
          recovery_allowed: recoveryAllowed
        };
      });
      orders = orders.map((order: any) => ({
        ...order,
        items: orderItems.filter((item: any) => item.order_id === order.id)
      }));

      const validOrders = (periodOrders.data || []).filter((order: any) =>
        ["confirmed", "processing", "out_for_delivery", "delivered"].includes(order.status)
      );
      const revenue = validOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
      const averageTicket = validOrders.length ? revenue / validOrders.length : 0;
      const byDay = new Map<string, { date: string; orders: number; revenue: number }>();
      for (const order of periodOrders.data || []) {
        const date = String(order.created_at).slice(0, 10);
        if (!byDay.has(date)) byDay.set(date, { date, orders: 0, revenue: 0 });
        const day = byDay.get(date)!;
        day.orders += 1;
        if (["confirmed", "processing", "out_for_delivery", "delivered"].includes(order.status)) day.revenue += Number(order.total_amount || 0);
      }
      const topProducts = new Map<string, { name: string; quantity: number; revenue: number }>();
      const periodOrderRows = periodOrders.data || [];
      const periodIds = periodOrderRows.map((order: any) => order.id);
      if (periodIds.length) {
        const { data, error } = await admin.from("order_items").select("order_id, product_name, quantity, unit_price").in("order_id", periodIds);
        if (error) throw error;
        const periodOrderMap = new Map(periodOrderRows.map((order: any) => [order.id, order]));
        for (const item of data || []) {
          const order: any = periodOrderMap.get(item.order_id);
          if (!order || !["confirmed", "processing", "out_for_delivery", "delivered"].includes(order.status)) continue;
          const key = item.product_name;
          if (!topProducts.has(key)) topProducts.set(key, { name: key, quantity: 0, revenue: 0 });
          const product = topProducts.get(key)!;
          const grossLine = Number(item.quantity || 0) * Number(item.unit_price || 0);
          const orderSubtotal = Number(order.subtotal) || 0;
          const orderDiscount = Number(order.club_discount_amount_cents || 0) / 100;
          const discountShare = orderSubtotal > 0 ? orderDiscount * (grossLine / orderSubtotal) : 0;
          product.quantity += Number(item.quantity || 0);
          product.revenue += Math.max(0, grossLine - discountShare);
        }
      }
      return response({
        ok: true,
        period_days: days,
        live: {
          active_visitors: new Set((liveSessions.data || []).map((row: any) => row.session_key)).size,
          sessions: (liveSessions.data || []).map((row: any) => ({
            session_key: row.session_key, status: row.status, item_count: row.item_count,
            subtotal: row.subtotal, last_activity_at: row.last_activity_at,
            items_snapshot: row.items_snapshot
          })),
          events: (liveEvents.data || []).map((row: any) => ({
            session_key: row.session_key, event_name: row.event_name, page_type: row.page_type,
            product_id: row.product_id, quantity: row.quantity, created_at: row.created_at
          }))
        },
        summary: {
          active_carts: activeCount.count || 0,
          abandoned_carts: abandonedCount.count || 0,
          pending_orders: pendingCount.count || 0,
          carts_with_marketing_opt_in: optInCount.count || 0,
          orders_period: (periodOrders.data || []).length,
          confirmed_orders_period: validOrders.length,
          revenue_period: Math.round(revenue * 100) / 100,
          average_ticket: Math.round(averageTicket * 100) / 100
        },
        daily: Array.from(byDay.values()),
        top_products: Array.from(topProducts.values()).sort((a,b) => b.quantity-a.quantity).slice(0,8),
        carts,
        orders
      }, 200, origin);
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
      const { data: memberProfile, error: memberError } = await admin.from("profiles")
        .select("id").eq("id", userId).maybeSingle();
      if (memberError) throw memberError;
      isClubMember = Boolean(memberProfile?.id);
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
        .select("product_id, product_name, sku, quantity, unit_price")
        .eq("order_id", previousOrder.id);
      if (previousItemsError) throw previousItemsError;
      const normalizeItems = (rows: any[]) => rows.map(item => ({
        product_id: item.product_id || null,
        product_name: item.product_name || "",
        sku: item.sku || null,
        quantity: Number(item.quantity),
        unit_price: Math.round(Number(item.unit_price) * 100)
      })).sort((a,b) =>
        String(a.product_id).localeCompare(String(b.product_id)) ||
        String(a.product_name).localeCompare(String(b.product_name)) ||
        String(a.sku).localeCompare(String(b.sku)) ||
        a.quantity - b.quantity ||
        a.unit_price - b.unit_price
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