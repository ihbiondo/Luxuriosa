import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clean, verifyAndSettlePayment, sendOrderNotification } from "../_shared/infinitepay-payment.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const ALLOWED_ORIGINS = new Set(["https://luxuriosa.com.br", "https://www.luxuriosa.com.br"]);

function reply(body: unknown, status = 200, origin = "") {
  return new Response(status === 204 ? null : JSON.stringify(body), {
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

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return reply({}, 204, origin);
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "Origem não autorizada." }, 403, origin);

  try {
    const body = await req.json();
    const orderNsu = typeof body?.order_nsu === "string" ? body.order_nsu.trim() : "";
    if (!validUuid(orderNsu)) return reply({ error: "Referência do pedido inválida." }, 400, origin);

    const transactionNsu = clean(body?.transaction_nsu, 160);
    const invoiceSlug = clean(body?.slug || body?.invoice_slug, 200);
    const receipt = clean(body?.receipt_url, 1000);
    const captureMethod = clean(body?.capture_method, 30);

    const { data: order, error: orderError } = await admin.from("orders")
      .select("id, order_number, payment_status, paid_at, dispatch_due_at, delivery_due_at, status, payment_provider, payment_expires_at, payment_amount_cents, payment_transaction_nsu, dispatch_sla_minutes, delivery_sla_minutes")
      .eq("id", orderNsu)
      .eq("payment_provider", "infinitepay")
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return reply({ error: "Pedido não encontrado." }, 404, origin);

    let reconciliation = "not_attempted";
    // If the webhook already confirmed the payment but its email notification
    // failed, a later customer return/refresh can safely retry that notification.
    // sendOrderNotification is idempotent for sent/not-configured events.
    if (order.payment_status === "paid" && order.payment_transaction_nsu) {
      const eventKey = "paid:" + orderNsu + ":" + order.payment_transaction_nsu;
      const notificationTask = sendOrderNotification(admin, order.id, eventKey, false);
      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (typeof edgeRuntime?.waitUntil === "function") edgeRuntime.waitUntil(notificationTask);
      else await notificationTask;
      reconciliation = "already_paid";
    }

    if (order.payment_status === "pending" && transactionNsu && invoiceSlug) {
      reconciliation = "pending";
      const result = await verifyAndSettlePayment(admin, order, {
        orderNsu,
        transactionNsu,
        invoiceSlug,
        receiptUrl: receipt,
        captureMethod
      });

      if (result.confirmed) {
        const outcome = result.settlement?.outcome;
        if (outcome === "paid" || outcome === "duplicate") {
          const notificationTask = sendOrderNotification(
            admin, order.id, result.settlement.event_key, result.settlement?.newly_paid === true
          );
          const edgeRuntime = (globalThis as any).EdgeRuntime;
          if (typeof edgeRuntime?.waitUntil === "function") edgeRuntime.waitUntil(notificationTask);
          else await notificationTask;
          reconciliation = outcome;
        } else if (outcome === "review_required") {
          reconciliation = "review_required";
        } else {
          throw new Error("Resultado de conciliação inesperado.");
        }
      }
    }

    const { data: current, error: currentError } = await admin.from("orders")
      .select("order_number, payment_status, paid_at, dispatch_due_at, delivery_due_at, status")
      .eq("id", orderNsu)
      .eq("payment_provider", "infinitepay")
      .single();
    if (currentError) throw currentError;

    return reply({
      ok: true,
      order_number: current.order_number,
      payment_status: current.payment_status,
      paid_at: current.paid_at,
      dispatch_due_at: current.dispatch_due_at,
      delivery_due_at: current.delivery_due_at,
      fulfillment_status: current.status,
      reconciliation
    }, 200, origin);
  } catch (error) {
    console.error("payment-status:", error);
    return reply({ error: "Não foi possível consultar ou conciliar o pagamento agora." }, 503, origin);
  }
});
