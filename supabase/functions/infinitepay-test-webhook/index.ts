import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("INFINITEPAY_API_KEY") || "";
const HANDLE = Deno.env.get("INFINITEPAY_HANDLE") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
function clean(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function uuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function saveDiagnostic(orderNsu: string, values: Record<string, unknown>) {
  const { error } = await admin.from("infinitepay_test_payments")
    .update(values)
    .eq("order_nsu", orderNsu)
    .eq("status", "pending");
  if (error) console.error("Could not persist InfinitePay test webhook diagnostic.", error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  let diagnosticOrderNsu = "";
  let diagnosticEventName = "";
  try {
    const body = await req.json();
    const orderNsu = clean(body?.order_nsu, 50);
    const transactionNsu = clean(body?.transaction_nsu, 160);
    const slug = clean(body?.invoice_slug || body?.slug, 200);
    const eventName = clean(body?.event || body?.type || body?.status, 40).toLowerCase();
    diagnosticOrderNsu = orderNsu;
    diagnosticEventName = eventName || "unspecified";

    if (!uuid(orderNsu)) {
      console.info("infinitepay-test-webhook ignored: invalid order reference", { eventName });
      return reply({ ok: true, ignored: true });
    }

    const { data: session, error: lookupError } = await admin.from("infinitepay_test_payments")
      .select("order_nsu, amount_cents, status")
      .eq("order_nsu", orderNsu).maybeSingle();
    if (lookupError) throw lookupError;
    if (!session) return reply({ ok: true, ignored: true });
    if (session.status === "paid") {
      return reply({ ok: true, duplicate: true, test: true, fulfillment_released: false });
    }

    await saveDiagnostic(orderNsu, {
      last_webhook_attempt_at: new Date().toISOString(),
      last_webhook_event: diagnosticEventName,
      last_payment_check_http_status: null,
      last_payment_check_provider_code: null,
      last_webhook_error: null
    });

    // The provider sends a separate "created" event before payment. Acknowledge it
    // immediately; it is not evidence of payment and must never change the status.
    if (eventName === "created" || (!transactionNsu && !slug)) {
      await saveDiagnostic(orderNsu, {
        last_webhook_error: "Aviso de criação recebido; nenhuma confirmação de pagamento foi verificada."
      });
      console.info("infinitepay-test-webhook: non-payment notice acknowledged", {
        eventName: eventName || "unspecified",
        hasTransactionNsu: Boolean(transactionNsu),
        hasInvoiceSlug: Boolean(slug)
      });
      return reply({ ok: true, acknowledged: true, paid: false, test: true });
    }

    if (!transactionNsu || !slug) {
      await saveDiagnostic(orderNsu, {
        last_webhook_error: "Notificação de pagamento recebida sem transaction_nsu ou invoice_slug."
      });
      console.warn("infinitepay-test-webhook: paid notice missing verification identifiers", {
        eventName, hasTransactionNsu: Boolean(transactionNsu), hasInvoiceSlug: Boolean(slug)
      });
      return reply({ ok: true, review_required: true, fulfillment_released: false });
    }
    if (!API_KEY || !HANDLE) throw new Error("Credenciais InfinitePay indisponíveis.");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    let check: Response;
    try {
      check = await fetch("https://api.checkout.infinitepay.io/payment_check", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Api-Key": API_KEY },
        body: JSON.stringify({
          handle: HANDLE,
          order_nsu: orderNsu,
          transaction_nsu: transactionNsu,
          slug
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const verified = await check.json().catch(() => ({}));
    const rawProviderError = verified?.error?.code ?? verified?.error ?? verified?.code;
    const providerCode = typeof rawProviderError === "string" ? clean(rawProviderError, 100) : "";
    await saveDiagnostic(orderNsu, {
      last_payment_check_http_status: check.status,
      last_payment_check_provider_code: providerCode || null
    });
    console.info("infinitepay-test-webhook payment_check result", {
      httpStatus: check.status,
      success: verified?.success === true,
      paid: verified?.paid === true,
      providerCode: providerCode || null,
      amount: Number.isSafeInteger(Number(verified?.amount)) ? Number(verified.amount) : null,
      paidAmount: Number.isSafeInteger(Number(verified?.paid_amount)) ? Number(verified.paid_amount) : null,
      responseKeys: verified && typeof verified === "object" ? Object.keys(verified).slice(0, 12) : []
    });

    if (!check.ok) {
      await saveDiagnostic(orderNsu, {
        last_webhook_error: "InfinitePay payment_check HTTP " + check.status +
          (providerCode ? " (" + providerCode + ")" : "") + "."
      });
      console.warn("InfinitePay test payment_check rejected the verification request.", {
        httpStatus: check.status,
        providerCode: providerCode || null
      });
      return reply({ error: "Consulta de pagamento indisponível; a InfinitePay poderá reenviar o aviso." }, 503);
    }
    if (verified?.success !== true || verified?.paid !== true) {
      await saveDiagnostic(orderNsu, {
        last_webhook_error: "payment_check não confirmou success=true e paid=true."
      });
      return reply({ error: "A InfinitePay ainda não confirmou o pagamento. O aviso poderá ser reenviado." }, 503);
    }

    const amount = Number(verified.amount);
    const paidAmount = Number(verified.paid_amount);
    const method = verified.capture_method === "pix" || verified.capture_method === "credit_card"
      ? verified.capture_method : null;
    const receipt = clean(body?.receipt_url, 1000);
    let safeReceipt: string | null = null;
    try {
      const parsed = new globalThis.URL(receipt);
      if (parsed.protocol === "https:") safeReceipt = parsed.toString();
    } catch {}

    // InfinitePay documents paid_amount as the amount actually charged; it can
    // differ from amount (for example, when fees are passed to the buyer).
    const validAmount = Number.isSafeInteger(amount) && amount === 100 &&
      Number.isSafeInteger(paidAmount) && paidAmount >= amount;
    const now = new Date().toISOString();
    const { error: updateError } = await admin.from("infinitepay_test_payments").update({
      status: validAmount ? "paid" : "review_required",
      provider_verified: true,
      transaction_nsu: transactionNsu,
      invoice_slug: slug,
      paid_amount_cents: Number.isSafeInteger(paidAmount) ? paidAmount : null,
      capture_method: method,
      receipt_url: safeReceipt,
      webhook_received_at: now,
      paid_at: validAmount ? now : null,
      last_payment_check_http_status: check.status,
      last_payment_check_provider_code: providerCode || null,
      last_webhook_error: validAmount ? null : "Pagamento verificado, mas o valor cobrado não corresponde ao teste de R$ 1,00.",
      updated_at: now
    }).eq("order_nsu", orderNsu).eq("status", "pending");
    if (updateError) throw updateError;

    return reply({
      ok: true, test: true, paid: validAmount, review_required: !validAmount,
      fulfillment_released: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido no processamento do webhook.";
    if (diagnosticOrderNsu && uuid(diagnosticOrderNsu)) {
      await saveDiagnostic(diagnosticOrderNsu, {
        last_webhook_attempt_at: new Date().toISOString(),
        last_webhook_event: diagnosticEventName,
        last_webhook_error: clean(message, 300)
      });
    }
    console.error("infinitepay-test-webhook:", message);
    return reply({ error: "Falha ao processar notificação de pagamento de teste." }, 503);
  }
});
