import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
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
    if (action !== "admin_update_order_status") return response({ error: "Ação inválida." }, 400, origin);
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


    return response({ error: "Ação inválida." }, 400, origin);
  } catch (error) {
    console.error("orders-admin:", error);
    return response({ error: error instanceof Error ? error.message : "Não foi possível atualizar o pedido." }, 400, origin);
  }
});
