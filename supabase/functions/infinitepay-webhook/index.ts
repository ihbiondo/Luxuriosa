import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
import {
  sendOrderNotification,
  verifyAndSettlePayment
} from "./_shared/infinitepay-payment.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

function clean(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function finishPaidOrder(orderId: string, eventKey: string, newlyPaid: boolean) {
  try {
    const [syncResult, notification] = await Promise.all([
      admin.rpc("sync_online_order_to_management_sale", { p_order_id: orderId }),
      sendOrderNotification(admin, orderId, eventKey, newlyPaid)
    ]);

    if (syncResult.error) {
      console.error("InfinitePay payment was verified, but management synchronization failed.", {
        orderId,
        error: syncResult.error.message
      });
    } else if (syncResult.data?.synced !== true) {
      console.error("InfinitePay payment was verified, but management synchronization remains pending.", {
        orderId,
        result: syncResult.data
      });
    }

    console.info("infinitepay-webhook.post-settlement", {
      orderId,
      newlyPaid,
      managementSynced: syncResult.data?.synced === true,
      emailNotification: notification.status
    });
  } catch (error) {
    console.error("InfinitePay post-settlement processing failed.", {
      orderId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405);
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return response({ error: "Não foi possível ler a notificação." }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > 16000) {
    return response({ error: "Notificação muito grande." }, 413);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return response({ error: "Corpo JSON inválido." }, 400);
  }

  const orderNsu = clean(payload?.order_nsu, 100);
  const transactionNsu = clean(payload?.transaction_nsu, 200);
  const invoiceSlug = clean(payload?.invoice_slug || payload?.slug, 200);
  const eventName = clean(
    payload?.event || payload?.type || payload?.status || payload?.event_type || payload?.event_name,
    50
  ).toLowerCase();

  const noticeEvents = new Set(["refunded", "canceled", "payment_failed"]);
  if (noticeEvents.has(eventName)) {
    if (!validUuid(orderNsu) || !invoiceSlug) {
      return response({ ok: true, ignored: true, reason: "notice_reference_incomplete" });
    }

    const { data: noticeOrder, error: noticeOrderError } = await admin.from("orders")
      .select("id, order_number, payment_status, payment_transaction_nsu, payment_invoice_slug")
      .eq("id", orderNsu)
      .eq("source", "website")
      .eq("payment_provider", "infinitepay")
      .eq("payment_invoice_slug", invoiceSlug)
      .maybeSingle();
    if (noticeOrderError) throw noticeOrderError;
    if (!noticeOrder) {
      return response({ ok: true, ignored: true, reason: "notice_order_or_invoice_mismatch" });
    }

    if (eventName === "refunded") {
      if (!transactionNsu || noticeOrder.payment_transaction_nsu !== transactionNsu ||
          !["paid", "refunded"].includes(noticeOrder.payment_status)) {
        return response({ ok: true, ignored: true, reason: "refund_transaction_mismatch" });
      }
    } else {
      if (noticeOrder.payment_status !== "pending" ||
          (noticeOrder.payment_transaction_nsu && transactionNsu &&
            noticeOrder.payment_transaction_nsu !== transactionNsu)) {
        return response({ ok: true, ignored: true, reason: "notice_does_not_match_pending_payment" });
      }
    }

    const eventKey = "notice:" + eventName + ":" + noticeOrder.id + ":" + (transactionNsu || invoiceSlug);
    const amountValue = Number(payload?.amount);
    const paidAmountValue = Number(payload?.paid_amount);
    const captureMethod = payload?.capture_method === "pix" || payload?.capture_method === "credit_card"
      ? payload.capture_method : null;
    const { error: noticeInsertError } = await admin.from("payment_provider_events").upsert({
      provider: "infinitepay",
      event_key: eventKey,
      event_type: eventName,
      order_id: noticeOrder.id,
      order_nsu: orderNsu,
      transaction_nsu: transactionNsu || null,
      invoice_slug: invoiceSlug,
      amount_cents: Number.isSafeInteger(amountValue) && amountValue >= 0 ? amountValue : null,
      paid_amount_cents: Number.isSafeInteger(paidAmountValue) && paidAmountValue >= 0 ? paidAmountValue : null,
      capture_method: captureMethod,
      receipt_url: clean(payload?.receipt_url, 1000) || null,
      verified: false,
      processed_at: null,
      processing_error: "Aviso recebido sem assinatura criptográfica. Exige conferência manual na conta InfinitePay antes de qualquer alteração financeira."
    }, { onConflict: "event_key", ignoreDuplicates: true });
    if (noticeInsertError) throw noticeInsertError;

    console.info("infinitepay-webhook.unverified-notice", {
      orderNumber: noticeOrder.order_number,
      eventName,
      eventKey
    });
    return response({
      ok: true,
      notice_received: true,
      requires_manual_review: true,
      event: eventName,
      order_number: noticeOrder.order_number
    });
  }

  // O payload oficial de pagamento aprovado pode não trazer um campo de evento.
  // Quando o evento vem identificado, somente paid/settled seguem para validação.
  // Quando não vem, exigimos as três referências de pagamento e payment_check
  // continua sendo a única autoridade para confirmar a transação.
  const paymentNotice = eventName === "paid" || eventName === "settled" ||
    (!eventName && Boolean(transactionNsu && invoiceSlug));

  if (!paymentNotice) {
    console.info("infinitepay-webhook.ignored", {
      orderNsu: orderNsu || null,
      eventName: eventName || null,
      hasTransaction: Boolean(transactionNsu),
      hasInvoiceSlug: Boolean(invoiceSlug)
    });
    return response({ ok: true, ignored: true, event: eventName || null });
  }

  if (!validUuid(orderNsu) || !transactionNsu || !invoiceSlug) {
    console.warn("infinitepay-webhook.invalid-payment-reference", {
      hasOrderNsu: validUuid(orderNsu),
      hasTransactionNsu: Boolean(transactionNsu),
      hasInvoiceSlug: Boolean(invoiceSlug)
    });
    return response({ error: "Referências de pagamento incompletas." }, 400);
  }

  try {
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id, order_number, source, payment_provider, payment_status, payment_amount_cents, payment_invoice_slug, dispatch_sla_minutes, delivery_sla_minutes")
      .eq("id", orderNsu)
      .eq("source", "website")
      .eq("payment_provider", "infinitepay")
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) {
      console.warn("infinitepay-webhook.order-not-found", { orderNsu });
      return response({ ok: true, ignored: true, reason: "order_not_found" });
    }

    const verification = await verifyAndSettlePayment(admin, order, {
      orderNsu,
      transactionNsu,
      invoiceSlug,
      receiptUrl: clean(payload?.receipt_url, 1000),
      captureMethod: clean(payload?.capture_method, 40)
    });

    if (!verification.confirmed || !verification.settlement) {
      console.info("infinitepay-webhook.payment-not-confirmed", {
        orderNsu,
        eventName: eventName || null
      });
      return response({ ok: true, verified: false, payment_pending: true });
    }

    const settlement = verification.settlement;
    const outcome = clean(settlement?.outcome, 40);
    const eventKey = clean(settlement?.event_key, 300);

    if (outcome === "paid" || outcome === "duplicate") {
      if (!eventKey) throw new Error("A confirmação não retornou a chave de auditoria do pagamento.");
      EdgeRuntime.waitUntil(finishPaidOrder(order.id, eventKey, outcome === "paid" && settlement?.newly_paid === true));
      return response({
        ok: true,
        verified: true,
        outcome,
        order_number: order.order_number
      });
    }

    if (outcome === "review_required") {
      console.warn("infinitepay-webhook.payment-requires-review", {
        orderNsu,
        eventKey: eventKey || null
      });
      return response({
        ok: true,
        verified: true,
        manual_review_required: true,
        order_number: order.order_number
      });
    }

    if (outcome === "not_found") {
      return response({ ok: true, ignored: true, reason: "order_not_found" });
    }

    console.error("infinitepay-webhook.unexpected-settlement-outcome", {
      orderNsu,
      outcome: outcome || null
    });
    return response({ error: "Resultado de confirmação inesperado." }, 500);
  } catch (error) {
    console.error("infinitepay-webhook.processing-failed", {
      orderNsu,
      eventName: eventName || null,
      error: error instanceof Error ? error.message : String(error)
    });
    return response({ error: "Não foi possível validar a notificação de pagamento." }, 500);
  }
});
