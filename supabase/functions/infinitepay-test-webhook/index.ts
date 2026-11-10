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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  try {
    const body = await req.json();
    const orderNsu = clean(body?.order_nsu, 50);
    const transactionNsu = clean(body?.transaction_nsu, 160);
    const slug = clean(body?.invoice_slug || body?.slug, 200);
    const eventName = clean(body?.event || body?.type || body?.status, 40).toLowerCase();

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

    // The provider sends a separate "created" event before payment. Acknowledge it
    // immediately; it is not evidence of payment and must never change the status.
    if (eventName === "created" || (!transactionNsu && !slug)) {
      console.info("infinitepay-test-webhook: non-payment notice acknowledged", {
        eventName: eventName || "unspecified",
        hasTransactionNsu: Boolean(transactionNsu),
        hasInvoiceSlug: Boolean(slug)
      });
      return reply({ ok: true, acknowledged: true, paid: false, test: true });
    }

    if (!transactionNsu || !slug) {
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
      console.warn("InfinitePay test payment_check rejected the verification request.", {
        httpStatus: check.status,
        providerCode: providerCode || null
      });
      return reply({ error: "Consulta de pagamento indisponível; a InfinitePay poderá reenviar o aviso." }, 503);
    }
    if (verified?.success !== true || verified?.paid !== true) {
      return reply({ ok: true, review_required: true, provider_verified: false, fulfillment_released: false });
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
      updated_at: now
    }).eq("order_nsu", orderNsu).eq("status", "pending");
    if (updateError) throw updateError;

    return reply({
      ok: true, test: true, paid: validAmount, review_required: !validAmount,
      fulfillment_released: false
    });
  } catch (error) {
    console.error("infinitepay-test-webhook:", error instanceof Error ? error.message : "unknown error");
    return reply({ error: "Falha ao processar notificação de pagamento de teste." }, 503);
  }
});
