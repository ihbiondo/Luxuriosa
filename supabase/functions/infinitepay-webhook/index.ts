import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clean, verifyAndSettlePayment, sendOrderNotification } from "../_shared/infinitepay-payment.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asInteger(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function receiptUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1000) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.toString() : null;
  } catch { return null; }
}

async function recordEvent(order: any, eventKey: string, eventType: string, payload: any, errorMessage: string) {
  const method = clean(payload?.capture_method, 30);
  const { error: insertError } = await admin.from("payment_provider_events").insert({
    provider: "infinitepay",
    event_key: eventKey,
    event_type: eventType,
    order_id: order.id,
    order_nsu: order.id,
    transaction_nsu: clean(payload?.transaction_nsu, 160) || null,
    invoice_slug: clean(payload?.invoice_slug || payload?.slug, 200) || null,
    amount_cents: asInteger(payload?.amount),
    paid_amount_cents: asInteger(payload?.paid_amount),
    capture_method: method === "pix" || method === "credit_card" ? method : null,
    receipt_url: receiptUrl(payload?.receipt_url),
    verified: false,
    processing_error: errorMessage
  });
  if (insertError && insertError.code !== "23505") throw insertError;
  if (errorMessage) {
    const { error } = await admin.from("payment_provider_events")
      .update({ processing_error: errorMessage })
      .eq("event_key", eventKey)
      .eq("verified", false);
    if (error) throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405);

  try {
    const payload = await req.json();
    const orderNsu = clean(payload?.order_nsu, 100);
    const transactionNsu = clean(payload?.transaction_nsu, 160);
    const invoiceSlug = clean(payload?.invoice_slug || payload?.slug, 200);
    const receipt = receiptUrl(payload?.receipt_url);
    const eventName = clean(payload?.event || payload?.type || payload?.status, 50).toLowerCase();

    if (!validUuid(orderNsu)) {
      return response({ ok: true, ignored: true });
    }

    let eventType = "";
    if (eventName.includes("refund")) eventType = "refunded";
    else if (eventName.includes("cancel")) eventType = "canceled";
    else if (eventName.includes("fail")) eventType = "payment_failed";
    else if (eventName === "paid" || eventName === "settled" || (!eventName && transactionNsu && invoiceSlug)) {
      eventType = "paid";
    } else {
      return response({ ok: true, ignored: true });
    }

    const { data: order, error: orderError } = await admin.from("orders")
      .select("id, payment_status, status, payment_amount_cents, payment_provider, payment_expires_at, dispatch_sla_minutes, delivery_sla_minutes")
      .eq("id", orderNsu)
      .eq("payment_provider", "infinitepay")
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return response({ ok: true, ignored: true });

    const eventKey = [eventType, orderNsu, transactionNsu || invoiceSlug || "no-reference"].join(":");

    // InfinitePay webhooks are unsigned. Non-payment notices are recorded but
    // never allowed to cancel, fail, refund, or otherwise mutate an order.
    if (eventType !== "paid") {
      await recordEvent(order, eventKey, eventType, payload,
        "Notificação sem assinatura criptográfica. Pedido preservado; conferir diretamente na InfinitePay.");
      return response({ ok: true, order_unchanged: true, review_required: eventType === "refunded" });
    }

    if (!transactionNsu || !invoiceSlug) {
      await recordEvent(order, eventKey, eventType, payload, "Dados insuficientes para verificar a transação.");
      return response({ ok: true, review_required: true, order_unchanged: true });
    }

    await recordEvent(order, eventKey, eventType, payload, "");
    const result = await verifyAndSettlePayment(admin, order, {
      orderNsu, transactionNsu, invoiceSlug, receiptUrl: receipt || undefined,
      captureMethod: clean(payload?.capture_method, 30)
    });

    if (!result.confirmed) {
      await admin.from("payment_provider_events")
        .update({ processing_error: "payment_check ainda não confirmou success=true e paid=true." })
        .eq("event_key", eventKey).eq("verified", false);
      return response({ error: "A InfinitePay ainda não confirmou o pagamento." }, 503);
    }

    const outcome = result.settlement?.outcome;
    if (outcome === "paid" || outcome === "duplicate") {
      const notificationTask = sendOrderNotification(
        admin, order.id, eventKey, result.settlement?.newly_paid === true
      );
      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (typeof edgeRuntime?.waitUntil === "function") edgeRuntime.waitUntil(notificationTask);
      else await notificationTask;
      return response({ ok: true, duplicate: outcome === "duplicate", email_notification: "queued" });
    }
    if (outcome === "review_required") {
      return response({ ok: true, review_required: true, fulfillment_released: false });
    }
    return response({ error: "Não foi possível concluir a conciliação do pedido." }, 503);
  } catch (error) {
    console.error("infinitepay-webhook:", error);
    return response({ error: "Falha ao processar notificação de pagamento." }, 503);
  }
});
