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
  if (req.method === "OPTIONS") {
    if (!allowedOrigins.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS", "vary": "Origin",
      "cache-control": "no-store"
    }});
  }
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405, origin);
  if (!allowedOrigins.has(origin)) return response({ error: "Origem não autorizada." }, 403, origin);
  if (Number(req.headers.get("content-length") || 0) > 16000) return response({ error: "Requisição muito grande." }, 413, origin);
  try {
    const body = await req.json();
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Faça login para alterar pedidos." }, 401, origin);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return response({ error: "Sessão inválida. Entre novamente." }, 401, origin);
    const userId = data.user.id;
    const action = body?.action;
    if (!["admin_confirm_manual_payment", "admin_retry_paid_stock_recovery", "admin_update_order_status", "admin_record_order_lifecycle_event", "admin_orders_list", "admin_search_management_customers", "admin_link_management_customer"].includes(action)) return response({ error: "Ação inválida." }, 400, origin);

    if (action === "admin_search_management_customers") {
      const { data: permission, error: permissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (permissionError) throw permissionError;
      if (permission?.role !== "admin") return response({ error: "Acesso restrito à administração." }, 403, origin);

      const q = cleanText(body.q, 100);
      if (!q || q.length < 2) return response({ ok: true, customers: [] }, 200, origin);
      const pattern = "%" + q + "%";
      const [byName, byPhone, byEmail] = await Promise.all([
        admin.from("management_customers").select("id, full_name, phone, email")
          .eq("created_by", userId).is("archived_at", null)
          .ilike("full_name", pattern).order("full_name").limit(20),
        admin.from("management_customers").select("id, full_name, phone, email")
          .eq("created_by", userId).is("archived_at", null)
          .ilike("phone", pattern).order("full_name").limit(20),
        admin.from("management_customers").select("id, full_name, phone, email")
          .eq("created_by", userId).is("archived_at", null)
          .ilike("email", pattern).order("full_name").limit(20)
      ]);
      for (const result of [byName, byPhone, byEmail]) {
        if (result.error) throw result.error;
      }
      const found = new Map<string, any>();
      for (const customer of [...(byName.data || []), ...(byPhone.data || []), ...(byEmail.data || [])]) {
        found.set(customer.id, customer);
      }
      return response({ ok: true, customers: Array.from(found.values()).slice(0, 25) }, 200, origin);
    }

    if (action === "admin_link_management_customer") {
      const { data: permission, error: permissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (permissionError) throw permissionError;
      if (permission?.role !== "admin") return response({ error: "Acesso restrito à administração." }, 403, origin);

      const orderId = body.order_id;
      const customerId = body.management_customer_id == null ? null : body.management_customer_id;
      const idempotencyKey = body.idempotency_key;
      if (!isUuid(orderId) || (customerId !== null && !isUuid(customerId)) || !isUuid(idempotencyKey)) {
        return response({ error: "Pedido, cadastro comercial ou chave de operação inválidos." }, 400, origin);
      }

      const { data: order, error: orderError } = await admin.from("orders")
        .select("id, order_number, source, customer_name")
        .eq("id", orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order || !["website", "whatsapp"].includes(order.source)) {
        return response({ error: "O vínculo comercial está disponível somente para pedidos originados na loja online." }, 409, origin);
      }
      if (HISTORICAL_TEST_ORDER_IDS.has(String(order.id)) || /^teste\b/i.test(String(order.customer_name || ""))) {
        return response({ error: "Registros de teste não podem ser associados a cadastros comerciais." }, 409, origin);
      }

      const { data: link, error: linkError } = await admin.rpc("admin_set_order_management_customer", {
        p_order_id: orderId,
        p_management_customer_id: customerId,
        p_actor_user_id: userId,
        p_idempotency_key: idempotencyKey
      });
      if (linkError) throw linkError;
      return response({ ok: true, link }, 200, origin);
    }
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


    if (action === "admin_orders_list") {
      if (!userId) return response({ error: "Faça login para acessar os pedidos." }, 401, origin);
      const { data: permission, error: permissionError } = await admin
        .from("user_permissions").select("role").eq("user_id", userId).maybeSingle();
      if (permissionError) throw permissionError;
      if (permission?.role !== "admin") return response({ error: "Acesso restrito à administração." }, 403, origin);

      const query = cleanText(body.q, 100);
      const status = cleanText(body.status, 40);
      const orderColumns = "id, order_number, status, payment_status, payment_method, payment_provider, payment_transaction_nsu, payment_invoice_slug, payment_checkout_url, payment_expires_at, payment_amount_cents, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, created_at, dispatch_due_at, delivery_due_at, dispatch_started_at, dispatched_at, route_started_at, delivered_at, cart_session_id, management_sale_id, management_sales_sync_status, source, management_customer_id";
      let orders: any[] = [];

      if (query) {
        const requests = [
          admin.from("orders").select(orderColumns).ilike("customer_name", "%" + query + "%").order("created_at", { ascending: false }).limit(100),
          admin.from("orders").select(orderColumns).ilike("customer_phone", "%" + query + "%").order("created_at", { ascending: false }).limit(100)
        ];
        if (/^\\d{1,12}$/.test(query)) {
          requests.push(admin.from("orders").select(orderColumns).eq("order_number", Number(query)).order("created_at", { ascending: false }).limit(10));
        }
        const results = await Promise.all(requests);
        for (const result of results) if (result.error) throw result.error;
        const unique = new Map<string, any>();
        for (const result of results) for (const order of result.data || []) unique.set(order.id, order);
        orders = [...unique.values()].sort((x, y) =>
          new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
        ).slice(0, 100);
      } else {
        const { data: recentOrders, error: ordersError } = await admin.from("orders")
          .select(orderColumns).order("created_at", { ascending: false }).limit(100);
        if (ordersError) throw ordersError;
        orders = recentOrders || [];
      }
      if (status) orders = orders.filter(order => order.status === status || order.payment_status === status);

      const orderIds = orders.map(order => order.id);
      const orderItems: any[] = [];
      const stockSalesByOrder = new Map<string, any>();
      const lifecycleByOrder = new Map<string, any[]>();
      if (orderIds.length) {
        const [itemsResult, stockResult, lifecycleResult] = await Promise.all([
          admin.from("order_items")
            .select("order_id, product_id, product_name, quantity, unit_price, product_snapshot")
            .in("order_id", orderIds),
          admin.from("management_sales")
            .select("id, source_order_id, stock_control_status, stock_issue")
            .in("source_order_id", orderIds),
          admin.from("order_lifecycle_events")
            .select("order_id,event_type,reason,amount_cents,reference,created_at")
            .in("order_id", orderIds).order("created_at", { ascending: true })
        ]);
        if (itemsResult.error) throw itemsResult.error;
        if (stockResult.error) throw stockResult.error;
        if (lifecycleResult.error) throw lifecycleResult.error;
        orderItems.push(...(itemsResult.data || []));
        for (const sale of stockResult.data || []) stockSalesByOrder.set(sale.source_order_id, sale);
        for (const event of lifecycleResult.data || []) {
          if (!lifecycleByOrder.has(event.order_id)) lifecycleByOrder.set(event.order_id, []);
          lifecycleByOrder.get(event.order_id)!.push(event);
        }
      }

      const linkedCustomerIds = Array.from(new Set(
        orders.map(order => order.management_customer_id).filter((id): id is string => isUuid(id))
      ));
      const linkedCustomersById = new Map<string, any>();
      if (linkedCustomerIds.length) {
        const { data: linkedCustomers, error: linkedCustomersError } = await admin
          .from("management_customers")
          .select("id, full_name, phone, email, archived_at")
          .in("id", linkedCustomerIds);
        if (linkedCustomersError) throw linkedCustomersError;
        for (const customer of linkedCustomers || []) linkedCustomersById.set(customer.id, customer);
      }

      const enrichedOrders = orders.map(order => ({
        ...order,
        is_test: HISTORICAL_TEST_ORDER_IDS.has(String(order.id || "")),
        stock_control_status: stockSalesByOrder.get(order.id)?.stock_control_status || null,
        stock_issue: stockSalesByOrder.get(order.id)?.stock_issue || null,
        management_customer: linkedCustomersById.get(order.management_customer_id) || null,
        lifecycle_events: lifecycleByOrder.get(order.id) || [],
        items: orderItems.filter(item => item.order_id === order.id).map(item => {
          const snapshot = item.product_snapshot && typeof item.product_snapshot === "object" && !Array.isArray(item.product_snapshot)
            ? item.product_snapshot : {};
          const selected = Array.isArray(snapshot.selected_components) ? snapshot.selected_components[0] : null;
          return {
            ...item,
            selected_dice_product_id: cleanText(snapshot.selected_dice_product_id, 80) || cleanText(selected?.product_id, 80),
            selected_dice_product_name: cleanText(snapshot.selected_dice_product_name, 180) || cleanText(selected?.product_name, 180)
          };
        })
      }));

      return response({ ok: true, orders: enrichedOrders }, 200, origin);
    }

    return response({ error: "Ação inválida." }, 400, origin);
  } catch (error) {
    console.error("orders-admin:", error);
    return response({ error: error instanceof Error ? error.message : "Não foi possível atualizar o pedido." }, 400, origin);
  }
});
