import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const ALLOWED_ORIGINS = new Set(["https://luxuriosa.com.br", "https://www.luxuriosa.com.br"]);

function reply(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://luxuriosa.com.br",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function allowPaymentStatusRequest(userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    p_scope: "payment_status_user",
    p_key_hash: await sha256Hex(userId),
    p_window_seconds: 60,
    p_limit: 30
  });
  if (error) throw error;
  return data === true;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin",
      "cache-control": "no-store"
    }});
  }
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405, origin);
  if (!ALLOWED_ORIGINS.has(origin)) return reply({ error: "Origem não autorizada." }, 403, origin);
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) return reply({ error: "Formato de requisição inválido." }, 415, origin);
  if (Number(req.headers.get("content-length") || 0) > 4 * 1024) return reply({ error: "Solicitação muito grande." }, 413, origin);
  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4 * 1024) return reply({ error: "Solicitação muito grande." }, 413, origin);
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return reply({ error: "Corpo da solicitação inválido." }, 400, origin); }
    const orderNsu = typeof body?.order_nsu === "string" ? body.order_nsu.trim() : "";
    if (!validUuid(orderNsu)) return reply({ error: "Referência do pedido inválida." }, 400, origin);
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return reply({ error: "Entre na conta utilizada neste pedido para acompanhar o pagamento." }, 401, origin);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Sua sessão expirou. Entre novamente para consultar este pedido." }, 401, origin);
    let withinRateLimit = false;
    try { withinRateLimit = await allowPaymentStatusRequest(authData.user.id); }
    catch (rateError) {
      console.error("payment-status rate limiter unavailable:", rateError);
      return reply({ error: "Proteção contra abuso temporariamente indisponível. Tente novamente." }, 503, origin);
    }
    if (!withinRateLimit) return reply({ error: "Muitas consultas em sequência. Aguarde um minuto e tente novamente." }, 429, origin);
    const { data: order, error } = await admin.from("orders")
      .select("order_number, payment_status, paid_at, dispatch_due_at, delivery_due_at, status, management_sales_sync_status")
      .eq("id", orderNsu)
      .eq("customer_id", authData.user.id)
      .eq("payment_provider", "infinitepay")
      .maybeSingle();
    if (error) throw error;
    if (!order) return reply({ error: "Pedido não encontrado para esta conta." }, 404, origin);
    const reconciliation = order.payment_status === "paid"
      ? (order.management_sales_sync_status === "synced" ? "sale_synced" : "sale_sync_pending")
      : "manual_confirmation_required";
    return reply({
      ok: true,
      order_number: order.order_number,
      payment_status: order.payment_status,
      paid_at: order.paid_at,
      dispatch_due_at: order.dispatch_due_at,
      delivery_due_at: order.delivery_due_at,
      fulfillment_status: order.status,
      management_sales_sync_status: order.management_sales_sync_status,
      reconciliation,
      manual_confirmation_required: order.payment_status === "pending" || order.payment_status === "review_required"
    }, 200, origin);
  } catch (error) {
    console.error("payment-status:", error);
    return reply({ error: "Não foi possível consultar o status do pedido agora." }, 503, origin);
  }
});
