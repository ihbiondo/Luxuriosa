import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const HISTORICAL_TEST_ORDER_IDS = new Set([
  "e17943d3-a651-4fcd-a34f-c3d96ca06a4f",
  "33ef69ad-188a-44a9-bdf1-6adc3abc9bc4",
  "763bedaa-3f0a-44f2-beae-6ee55b202fc8",
  "55429912-f824-42dd-966b-a1e8f8c4cd7c",
  "4fba6f8f-ef04-46a2-b157-647616ab42c3",
  "3089cb19-6dc1-4d0c-a364-dc40b5ac6e10",
  "0de325e6-56ca-4497-9a1f-647659d9611c",
  "40e0bd61-dc05-4569-b822-2af3fbe0cf17",
  "4fb9fbfc-20e4-46d2-8535-86d7054fd1a1"
]);

const allowedOrigins = new Set(["https://luxuriosa.com.br", "https://www.luxuriosa.com.br"]);
function response(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), { status, headers: {
    "content-type": "application/json",
    "access-control-allow-origin": allowedOrigins.has(origin) ? origin : "https://luxuriosa.com.br",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS", "vary": "Origin"
  }});
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function cleanText(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, max);
  return result || null;
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": allowedOrigins.has(origin) ? origin : "https://luxuriosa.com.br",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS", "vary": "Origin"
  }});
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return response({ error: "Origem não autorizada." }, 403, origin);
  if (Number(req.headers.get("content-length") || 0) > 16000) return response({ error: "Requisição muito grande." }, 413, origin);
  try {
    const body = await req.json();
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Faça login para alterar pedidos." }, 401, origin);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return response({ error: "Sessão inválida. Entre novamente." }, 401, origin);
    const userId = data.user.id;
    const action = body?.action;
    if (!["admin_confirm_manual_payment", "admin_retry_paid_stock_recovery", "admin_update_order_status", "admin_record_order_lifecycle_event", "admin_dashboard"].includes(action)) return response({ error: "Ação inválida." }, 400, origin);
    if (action === "admin_retry_paid_stock_recovery") {
      const { data: permission, error: permissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (permissionError) throw permissionError;
      if (permission?.role !== "admin") return response({ error: "Acesso restrito à administração." }, 403, origin);

      const orderId = body.order_id;
      if (!isUuid(orderId)) return response({ error: "Pedido inválido." }, 400, origin);
      const { data: order, error: orderError } = await admin.from("orders")
        .select("id, order_number, source, payment_provider, payment_status, status, management_sale_id, management_sales_sync_status")
        .eq("id", orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order || order.source !== "website" || order.payment_provider !== "infinitepay") {
        return response({ error: "Pedido online não encontrado." }, 404, origin);
      }
      if (order.payment_status !== "paid") {
        return response({ error: "A recuperação de estoque exige pagamento já confirmado." }, 409, origin);
      }
      if (order.status !== "confirmed") {
        return response({ error: "A recuperação automática só pode ocorrer antes do início da separação. Pedido que já avançou na expedição exige conferência física e ajuste auditável." }, 409, origin);
      }

      const { data: sync, error: syncError } = await admin.rpc("sync_online_order_to_management_sale", {
        p_order_id: orderId
      });
      if (syncError) throw syncError;
      if (sync?.synced !== true) {
        return response({ ok: false, error: "O pagamento está preservado, mas a venda ainda não foi sincronizada. Tente reconciliar novamente.", sync }, 409, origin);
      }

      const { data: linkedOrder, error: linkedError } = await admin.from("orders")
        .select("management_sale_id, management_sales_sync_status")
        .eq("id", orderId).single();
      if (linkedError) throw linkedError;
      if (!linkedOrder.management_sale_id || linkedOrder.management_sales_sync_status !== "synced") {
        return response({ ok: false, error: "Não foi possível localizar a venda gerencial vinculada.", sync }, 409, origin);
      }

      const { data: recovery, error: recoveryError } = await admin.rpc("management_retry_paid_sale_stock", {
        p_sale_id: linkedOrder.management_sale_id,
        p_actor_user_id: userId
      });
      if (recoveryError) throw recoveryError;

      const { data: stockSale, error: stockError } = await admin.from("management_sales")
        .select("stock_control_status, stock_issue")
        .eq("id", linkedOrder.management_sale_id).single();
      if (stockError) throw stockError;

      return response({
        ok: true,
        order_number: order.order_number,
        sync,
        recovery,
        stock_control_status: stockSale.stock_control_status,
        stock_issue: stockSale.stock_issue
      }, 200, origin);
    }

    if (action === "admin_confirm_manual_payment") {
      const { data: manualPermission, error: manualPermissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (manualPermissionError) throw manualPermissionError;
      if (manualPermission?.role !== "admin") {
        return response({ error: "Acesso restrito à administração." }, 403, origin);
      }
      const orderId = body.order_id;
      if (!isUuid(orderId)) return response({ error: "Pedido inválido." }, 400, origin);
      const { data: current, error: currentError } = await admin.from("orders")
        .select("id, order_number, source, payment_provider, status, payment_status, payment_amount_cents, total_amount, cart_session_id")
        .eq("id", orderId).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return response({ error: "Pedido não encontrado." }, 404, origin);
      if (current.source !== "website" || current.payment_provider !== "infinitepay") {
        return response({ error: "A confirmação manual está disponível apenas para pedidos online da InfinitePay." }, 409, origin);
      }
      if (current.payment_status === "paid") {
        const { data: sync, error: syncError } = await admin.rpc("sync_online_order_to_management_sale", { p_order_id: orderId });
        if (syncError) throw syncError;
        const { data: stockSale, error: stockError } = await admin.from("management_sales")
          .select("stock_control_status, stock_issue")
          .eq("source_order_id", orderId).maybeSingle();
        if (stockError) throw stockError;
        return response({
          ok: true, reused: true, payment_status: "paid", sync,
          management_sales_sync_status: sync?.synced === true ? "synced" : "error",
          stock_control_status: stockSale?.stock_control_status || null,
          stock_issue: stockSale?.stock_issue || null
        }, 200, origin);
      }
      if (current.payment_status !== "pending" || current.status !== "awaiting_confirmation") {
        return response({ error: "Este pedido não está pendente e elegível para confirmação manual." }, 409, origin);
      }
      const now = new Date().toISOString();
      const amountCents = Number(current.payment_amount_cents ?? Math.round(Number(current.total_amount || 0) * 100));
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        return response({ error: "O valor do pedido é inválido. Nenhuma alteração foi feita." }, 409, origin);
      }
      const { data: updated, error: updateError } = await admin.from("orders")
        .update({
          payment_status: "paid",
          payment_paid_amount_cents: amountCents,
          payment_confirmation_source: "manual_admin",
          payment_confirmed_by: userId,
          paid_at: now,
          status: "confirmed",
          confirmed_at: now,
          updated_at: now
        })
        .eq("id", orderId)
        .eq("payment_status", "pending")
        .eq("status", "awaiting_confirmation")
        .select("id, order_number, status, payment_status, paid_at, management_sales_sync_status")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return response({ error: "O pedido foi alterado em outra operação. Atualize a tela antes de continuar." }, 409, origin);

      if (current.cart_session_id) {
        const { error: cartError } = await admin.from("cart_sessions").update({
          status: "converted", converted_at: now, updated_at: now
        }).eq("id", current.cart_session_id);
        if (cartError) throw cartError;
      }
      const { data: sync, error: syncError } = await admin.rpc("sync_online_order_to_management_sale", { p_order_id: orderId });
      if (syncError) throw syncError;
      const { data: stockSale, error: stockError } = await admin.from("management_sales")
        .select("stock_control_status, stock_issue")
        .eq("source_order_id", orderId).maybeSingle();
      if (stockError) throw stockError;
      return response({
        ok: true,
        order: updated,
        payment_status: "paid",
        sync,
        management_sales_sync_status: sync?.synced === true ? "synced" : "error",
        stock_control_status: stockSale?.stock_control_status || null,
        stock_issue: stockSale?.stock_issue || null
      }, 200, origin);
    }

    if (action === "admin_record_order_lifecycle_event") {
      const { data: permission, error: permissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (permissionError) throw permissionError;
      if (permission?.role !== "admin") return response({ error: "Acesso restrito à administração." }, 403, origin);
      const orderId = body.order_id;
      const idempotencyKey = body.idempotency_key;
      const eventType = body.event_type;
      const reason = cleanText(body.reason, 500);
      const reference = cleanText(body.reference, 160);
      const amountCents = body.amount_cents == null ? null : Number(body.amount_cents);
      const allowedEvents = ["cancelled_unpaid", "refund_requested", "refund_confirmed", "return_received", "restock_approved"];
      if (!isUuid(orderId) || !isUuid(idempotencyKey) || !allowedEvents.includes(eventType) || !reason) {
        return response({ error: "Dados da ocorrência inválidos. Informe pedido, tipo, motivo e chave idempotente." }, 400, origin);
      }
      if (amountCents !== null && (!Number.isSafeInteger(amountCents) || amountCents <= 0)) {
        return response({ error: "Valor informado inválido." }, 400, origin);
      }
      const { data: result, error: lifecycleError } = await admin.rpc("admin_record_order_lifecycle_event", {
        p_order_id: orderId, p_actor_user_id: userId, p_event_type: eventType,
        p_reason: reason, p_amount_cents: amountCents, p_reference: reference,
        p_idempotency_key: idempotencyKey
      });
      if (lifecycleError) return response({ error: lifecycleError.message || "Não foi possível registrar a ocorrência." }, 409, origin);
      return response({ ok: true, lifecycle: result }, 200, origin);
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
        .select("id, order_number, status, cart_session_id, payment_status, dispatch_started_at, dispatched_at, delivered_at, management_sale_id, management_sales_sync_status").eq("id", orderId).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return response({ error: "Pedido não encontrado." }, 404, origin);
      const paidStatuses = ["confirmed", "processing", "dispatched", "out_for_delivery", "delivered"];
      if (current.status === "cancelled") {
        return response({ error: "Pedido cancelado não pode ser reaberto por este painel." }, 409, origin);
      }
      const allowedTransitions: Record<string, string[]> = {
        confirmed: ["processing"],
        processing: ["dispatched"],
        dispatched: ["out_for_delivery"],
        out_for_delivery: ["delivered"]
      };
      if (nextStatus !== "cancelled" && !(allowedTransitions[current.status] || []).includes(nextStatus)) {
        return response({ error: "Avance o pedido uma etapa por vez: confirmação, separação, rota e entrega." }, 409, origin);
      }
      if (["processing", "dispatched", "out_for_delivery", "delivered"].includes(nextStatus)) {
        if (current.management_sales_sync_status !== "synced" || !current.management_sale_id) {
          return response({
            error: "Expedição bloqueada: a venda ainda não foi sincronizada com o Lux-Gestão. Atualize o painel e tente novamente.",
            stock_control_status: "pending_sync"
          }, 409, origin);
        }
        const { data: stockSale, error: stockSaleError } = await admin
          .from("management_sales")
          .select("id, stock_control_status, stock_issue")
          .eq("id", current.management_sale_id)
          .eq("source_order_id", orderId)
          .maybeSingle();
        if (stockSaleError) throw stockSaleError;
        if (!stockSale) {
          return response({ error: "Expedição bloqueada: não foi localizado o lançamento de estoque vinculado ao pedido." }, 409, origin);
        }
        if (stockSale.stock_control_status !== "deducted") {
          const detail = stockSale.stock_issue
            ? " " + stockSale.stock_issue
            : " Regularize a contagem ou o vínculo dos componentes no inventário.";
          const reason = stockSale.stock_control_status === "insufficient_stock"
            ? "Estoque insuficiente."
            : stockSale.stock_control_status === "partially_tracked"
              ? "Controle de estoque incompleto."
              : "Estoque ainda não controlado.";
          return response({
            error: "Expedição bloqueada: " + reason + detail,
            stock_control_status: stockSale.stock_control_status,
            stock_issue: stockSale.stock_issue
          }, 409, origin);
        }
      }
      if (nextStatus === "cancelled") {
        return response({ error: "Use o registro auditável de cancelamento/estorno para encerrar pedidos." }, 409, origin);
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
        update.route_started_at = null;
        update.delivered_at = null;
      }
      if (nextStatus === "processing") {
        update.dispatch_started_at = now;
        update.dispatched_at = null;
        update.route_started_at = null;
        update.delivered_at = null;
      }
      if (nextStatus === "dispatched") {
        update.dispatched_at = now;
        update.route_started_at = null;
        update.delivered_at = null;
      }
      if (nextStatus === "out_for_delivery") {
        update.route_started_at = now;
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
            admin.from("orders").select("id, order_number, status, payment_status, payment_method, payment_provider, payment_transaction_nsu, payment_invoice_slug, payment_checkout_url, payment_expires_at, payment_amount_cents, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, created_at, dispatch_due_at, delivery_due_at, dispatch_started_at, dispatched_at, route_started_at, delivered_at, cart_session_id, management_sale_id, management_sales_sync_status").order("created_at", { ascending: false }).limit(100),
            admin.from("site_events").select("session_key,event_name,page_type,product_id,quantity,created_at").gte("created_at", new Date(Date.now()-24*60*60*1000).toISOString()).order("created_at", { ascending: false }).limit(80),
            admin.from("cart_sessions").select("session_key,status,item_count,subtotal,last_activity_at,items_snapshot").gte("last_activity_at", new Date(Date.now()-5*60*1000).toISOString()).order("last_activity_at", { ascending: false }).limit(100)
          ]);
          for (const result of [activeCount, abandonedCount, pendingCount, optInCount, recentCarts, periodOrders, allRecentOrders, liveEvents, liveSessions]) {
            if (result.error) throw result.error;
          }
    
          let orders = allRecentOrders.data || [];
          if (q) {
            const nameSearch = admin.from("orders").select("id, order_number, status, payment_status, payment_method, payment_provider, payment_transaction_nsu, payment_invoice_slug, payment_checkout_url, payment_expires_at, payment_amount_cents, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, created_at, dispatch_due_at, delivery_due_at, dispatch_started_at, dispatched_at, route_started_at, delivered_at, cart_session_id, management_sale_id, management_sales_sync_status").ilike("customer_name", "%" + q + "%").order("created_at", { ascending: false }).limit(100);
            const phoneSearch = admin.from("orders").select("id, order_number, status, payment_status, payment_method, payment_provider, payment_transaction_nsu, payment_invoice_slug, payment_checkout_url, payment_expires_at, payment_amount_cents, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, created_at, dispatch_due_at, delivery_due_at, dispatch_started_at, dispatched_at, route_started_at, delivered_at, cart_session_id, management_sale_id, management_sales_sync_status").ilike("customer_phone", "%" + q + "%").order("created_at", { ascending: false }).limit(100);
            const [byName, byPhone] = await Promise.all([nameSearch, phoneSearch]);
            if (byName.error) throw byName.error;
            if (byPhone.error) throw byPhone.error;
            const found = new Map<string, any>();
            for (const order of [...(byName.data || []), ...(byPhone.data || [])]) found.set(order.id, order);
            if (/^\\d+$/.test(q)) {
              const { data, error } = await admin.from("orders").select("id, order_number, status, payment_status, payment_method, payment_provider, payment_transaction_nsu, payment_invoice_slug, payment_checkout_url, payment_expires_at, payment_amount_cents, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, created_at, dispatch_due_at, delivery_due_at, dispatch_started_at, dispatched_at, route_started_at, delivered_at, cart_session_id, management_sale_id, management_sales_sync_status").eq("order_number", Number(q)).limit(1);
              if (error) throw error;
              for (const order of data || []) found.set(order.id, order);
            }
            orders = Array.from(found.values()).sort((a,b) => new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
          }
          if (status) orders = orders.filter((order: any) => order.status === status);
          const orderIds = orders.map((order: any) => order.id);
          let orderItems: any[] = [];
          const stockSalesByOrder = new Map<string, any>();
          if (orderIds.length) {
            const { data, error } = await admin.from("order_items")
              .select("order_id, product_name, quantity, unit_price, product_snapshot").in("order_id", orderIds);
            if (error) throw error;
            orderItems = data || [];
            const { data: stockSales, error: stockError } = await admin.from("management_sales")
              .select("id, source_order_id, stock_control_status, stock_issue")
              .in("source_order_id", orderIds);
            if (stockError) throw stockError;
            for (const sale of stockSales || []) stockSalesByOrder.set(sale.source_order_id, sale);
          }
          const lifecycleByOrder = new Map<string, any[]>();
          if (orderIds.length) {
            const { data: lifecycleRows, error: lifecycleError } = await admin.from("order_lifecycle_events")
              .select("order_id,event_type,reason,amount_cents,reference,created_at")
              .in("order_id", orderIds).order("created_at", { ascending: true });
            if (lifecycleError) throw lifecycleError;
            for (const event of lifecycleRows || []) {
              if (!lifecycleByOrder.has(event.order_id)) lifecycleByOrder.set(event.order_id, []);
              lifecycleByOrder.get(event.order_id)!.push(event);
            }
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
          orders = orders.map((order: any) => {
            const stockSale = stockSalesByOrder.get(order.id);
            return {
              ...order,
              is_test: HISTORICAL_TEST_ORDER_IDS.has(String(order.id || "")),
              stock_control_status: stockSale?.stock_control_status || null,
              stock_issue: stockSale?.stock_issue || null,
              lifecycle_events: lifecycleByOrder.get(order.id) || [],
              items: orderItems.filter((item: any) => item.order_id === order.id).map((item: any) => {
                const snapshot = item.product_snapshot && typeof item.product_snapshot === "object" && !Array.isArray(item.product_snapshot)
                  ? item.product_snapshot : {};
                const selected = Array.isArray(snapshot.selected_components) ? snapshot.selected_components[0] : null;
                return {
                  ...item,
                  selected_dice_product_id: cleanText(snapshot.selected_dice_product_id, 80) || cleanText(selected?.product_id, 80),
                  selected_dice_product_name: cleanText(snapshot.selected_dice_product_name, 180) || cleanText(selected?.product_name, 180)
                };
              })
            };
          });

          const { data: managementSales, error: managementSalesError } = await admin
            .from("management_sales")
            .select("id, sale_number, created_at, customer_name, items, subtotal_cents, discount_cents, total_cents, payment_method, payment_status, source, shipping_cents, stock_control_status")
            .eq("created_by", userId)
            .order("created_at", { ascending: false })
            .limit(100);
          if (managementSalesError) throw managementSalesError;
    
          const validOrders = (periodOrders.data || []).filter((order: any) =>
            order.payment_status === "paid" &&
            ["confirmed", "processing", "dispatched", "out_for_delivery", "delivered"].includes(order.status)
          );
          const revenue = validOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
          const averageTicket = validOrders.length ? revenue / validOrders.length : 0;
          const byDay = new Map<string, { date: string; orders: number; revenue: number }>();
          for (const order of periodOrders.data || []) {
            const date = String(order.created_at).slice(0, 10);
            if (!byDay.has(date)) byDay.set(date, { date, orders: 0, revenue: 0 });
            const day = byDay.get(date)!;
            day.orders += 1;
            if (["confirmed", "processing", "dispatched", "out_for_delivery", "delivered"].includes(order.status)) day.revenue += Number(order.total_amount || 0);
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
              if (!order || order.payment_status !== "paid" ||
                  !["confirmed", "processing", "dispatched", "out_for_delivery", "delivered"].includes(order.status)) continue;
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
            orders,
            sales: managementSales || []
          }, 200, origin);
        }

    return response({ error: "Ação inválida." }, 400, origin);
  } catch (error) {
    console.error("orders-admin:", error);
    return response({ error: error instanceof Error ? error.message : "Não foi possível atualizar o pedido." }, 400, origin);
  }
});
