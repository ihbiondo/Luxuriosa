import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INFINITEPAY_API_KEY = Deno.env.get("INFINITEPAY_API_KEY") || "";
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const ALLOWED_ORIGINS = new Set(["https://luxuriosa.com.br", "https://www.luxuriosa.com.br"]);

function reply(body: unknown, status = 200, origin = "") {
  return new Response(status === 204 || status === 205 || status === 304 ? null : JSON.stringify(body), {
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

function normalizeCity(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function clean(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
async function getAdminEmailRecipients(): Promise<string[]> {
  const { data: admins, error } = await admin.from("user_permissions")
    .select("user_id").eq("role", "admin");
  if (error) throw error;
  const recipients: string[] = [];
  for (const row of admins || []) {
    const { data, error: userError } = await admin.auth.admin.getUserById(row.user_id);
    if (userError) continue;
    const email = clean(data.user?.email, 254);
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) recipients.push(email);
  }
  return Array.from(new Set(recipients));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char] || char));
}

async function notifyOwnerByEmail(order: any, items: any[]) {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    return { status: "not_configured", messageId: null, error: null };
  }
  try {
    const recipients = await getAdminEmailRecipients();
    if (!recipients.length) {
      return { status: "failed", messageId: null, error: "Nenhum e-mail de administrador foi encontrado." };
    }
    const money = (value: unknown) => Number(value || 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL"
    });
    const address = order.delivery_address && typeof order.delivery_address === "object"
      ? order.delivery_address : {};
    const addressText = [
      address.street, address.number, address.complement, address.district || address.neighborhood,
      [address.city, address.state].filter(Boolean).join("/"), address.zip ? "CEP " + address.zip : ""
    ].filter(Boolean).join(", ") || "Endereço não informado";
    const itemRows = (items || []).map((item: any) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.unit_price) || 0;
      const lineTotal = Number(item.line_total ?? quantity * unitPrice) || 0;
      return "<tr><td style='padding:8px;border-bottom:1px solid #eee'>" +
        escapeHtml(item.product_name) + "</td><td style='padding:8px;text-align:center;border-bottom:1px solid #eee'>" +
        quantity + "</td><td style='padding:8px;text-align:right;border-bottom:1px solid #eee'>" +
        money(lineTotal) + "</td></tr>";
    }).join("");
    const method = order.payment_method === "pix" ? "Pix" :
      order.payment_method === "credit_card" ? "Cartão de crédito" : "Não informado";
    const total = Number(order.payment_amount_cents ?? Math.round(Number(order.total_amount || 0) * 100)) / 100;
    const subject = "Pagamento confirmado — Pedido #" + order.order_number + " | Luxuriosa";
    const html = "<div style='font-family:Arial,sans-serif;color:#21171b;max-width:640px;margin:auto'>" +
      "<div style='background:#0b0b0b;padding:22px;color:#d4af7c'><strong style='font-size:22px'>LUXURIOSA</strong><div style='color:#f7d7d9;font-size:12px'>LINGERIE &amp; INTIMIDADE</div></div>" +
      "<div style='padding:22px;border:1px solid #eee'><h2 style='margin-top:0'>Novo pagamento confirmado</h2>" +
      "<p>O pedido <strong>#" + escapeHtml(order.order_number) + "</strong> foi confirmado pela InfinitePay.</p>" +
      "<p><strong>Cliente:</strong> " + escapeHtml(order.customer_name || "Não informado") + "<br>" +
      "<strong>Telefone:</strong> " + escapeHtml(order.customer_phone || "Não informado") + "<br>" +
      "<strong>Pagamento:</strong> " + method + "<br>" +
      "<strong>Destino:</strong> " + escapeHtml(addressText) + "</p>" +
      "<table style='width:100%;border-collapse:collapse'><thead><tr><th style='text-align:left;padding:8px'>Produto</th><th>Qtd.</th><th style='text-align:right'>Total</th></tr></thead><tbody>" +
      (itemRows || "<tr><td colspan='3' style='padding:8px'>Itens não disponíveis.</td></tr>") +
      "</tbody></table><p><strong>Produtos:</strong> " + money(order.subtotal) +
      "<br><strong>Entrega:</strong> " + money(order.shipping_amount) +
      "<br><strong>Total pago:</strong> <span style='font-size:20px;color:#8b1e3f'><strong>" + money(total) +
      "</strong></span></p><p style='color:#666;font-size:12px'>Acompanhe o pedido na Central de Operações.</p></div></div>";
    const textBody = [
      "LUXURIOSA — Novo pagamento confirmado",
      "Pedido #" + order.order_number,
      "Cliente: " + (order.customer_name || "Não informado"),
      "Telefone: " + (order.customer_phone || "Não informado"),
      "Pagamento: " + method,
      "Destino: " + addressText,
      "Itens: " + ((items || []).map((item: any) => (Number(item.quantity) || 1) + "x " + item.product_name).join("; ") || "Não disponíveis"),
      "Produtos: " + money(order.subtotal),
      "Entrega: " + money(order.shipping_amount),
      "Total pago: " + money(total)
    ].join("\n");
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "authorization": "Bearer " + RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: recipients, subject, html, text: textBody })
    });
    const result = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      const message = result?.message || result?.error || "Resend retornou HTTP " + emailResponse.status;
      return { status: "failed", messageId: null, error: String(message).slice(0, 500) };
    }
    return { status: "sent", messageId: clean(result?.id, 200) || null, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar e-mail de venda.";
    return { status: "failed", messageId: null, error: message.slice(0, 500) };
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return reply({}, 204, origin);
  }
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405, origin);
  if (!ALLOWED_ORIGINS.has(origin)) return reply({ error: "Origem não autorizada." }, 403, origin);
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) {
    return reply({ error: "Formato de requisição inválido." }, 415, origin);
  }
  if (Number(req.headers.get("content-length") || 0) > 16 * 1024) {
    return reply({ error: "Solicitação muito grande." }, 413, origin);
  }

  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Faça login com a conta administrativa." }, 401, origin);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Sessão inválida. Entre novamente." }, 401, origin);

    const { data: permission, error: permissionError } = await admin.from("user_permissions")
      .select("role").eq("user_id", authData.user.id).maybeSingle();
    if (permissionError) throw permissionError;
    if (permission?.role !== "admin") return reply({ error: "Acesso restrito à administração." }, 403, origin);
    const { data: assurance, error: assuranceError } = await admin.auth.mfa.getAuthenticatorAssuranceLevel(token);
    if (assuranceError) return reply({ error: "Não foi possível validar o segundo fator de autenticação." }, 503, origin);
    if (assurance.currentLevel !== "aal2") {
      return reply({ code: "mfa_required", error: "Confirme o código do seu autenticador para continuar." }, 403, origin);
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) {
      return reply({ error: "Solicitação muito grande." }, 413, origin);
    }
    let body: any;
    try { body = JSON.parse(rawBody); }
    catch { return reply({ error: "Corpo da solicitação inválido." }, 400, origin); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply({ error: "Corpo da solicitação inválido." }, 400, origin);
    }
    const action = body?.action;


    if (action === "reconcile_payment") {
      const orderId = clean(body.order_id, 100);
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(orderId)) return reply({ error: "Pedido inválido." }, 400, origin);
      const { data: order, error: orderError } = await admin.from("orders")
        .select("id, order_number, payment_status, status, payment_provider")
        .eq("id", orderId).eq("payment_provider", "infinitepay").maybeSingle();
      if (orderError) throw orderError;
      if (!order) return reply({ error: "Pedido InfinitePay não encontrado." }, 404, origin);
      if (order.payment_status !== "pending" || order.status !== "awaiting_confirmation") {
        return reply({ error: "Somente pedidos pendentes e ainda não liberados para expedição podem passar por esta conciliação.",
          payment_status: order.payment_status, order_status: order.status }, 409, origin);
      }
      let transactionNsu = clean(body.transaction_nsu, 160);
      let invoiceSlug = clean(body.invoice_slug || body.slug, 200);
      let receiptUrl = clean(body.receipt_url, 1000);
      let captureMethod = clean(body.capture_method, 30);
      let referenceSource = "manual";
      if (!transactionNsu || !invoiceSlug) {
        const { data: event, error: eventError } = await admin.from("payment_provider_events")
          .select("transaction_nsu, invoice_slug, receipt_url, capture_method")
          .eq("provider", "infinitepay").eq("order_id", orderId).eq("verified", false)
          .not("transaction_nsu", "is", null).not("invoice_slug", "is", null)
          .order("received_at", { ascending: false }).limit(1).maybeSingle();
        if (eventError) throw eventError;
        if (event && event.transaction_nsu && event.invoice_slug) {
          transactionNsu = clean(event.transaction_nsu, 160);
          invoiceSlug = clean(event.invoice_slug, 200);
          receiptUrl = receiptUrl || clean(event.receipt_url, 1000);
          captureMethod = captureMethod || clean(event.capture_method, 30);
          referenceSource = "webhook";
        } else {
          return reply({ ok: false, code: "references_required",
            error: "Ainda não recebemos as referências da InfinitePay para este pedido. Cole transaction_nsu e invoice_slug do retorno do checkout ou da notificação recebida."
          }, 409, origin);
        }
      }
      if (!transactionNsu || !invoiceSlug) {
        return reply({ ok: false, code: "references_required", error: "Informe os dois dados: transaction_nsu e invoice_slug." }, 400, origin);
      }
      if (captureMethod !== "pix" && captureMethod !== "credit_card") captureMethod = "";
      try { if (receiptUrl && new URL(receiptUrl).protocol !== "https:") receiptUrl = ""; }
      catch { receiptUrl = ""; }
      const eventKey = "paid:" + orderId + ":" + transactionNsu;
      const { error: insertError } = await admin.from("payment_provider_events").insert({
        provider: "infinitepay", event_key: eventKey, event_type: "paid",
        order_id: orderId, order_nsu: orderId, transaction_nsu: transactionNsu,
        invoice_slug: invoiceSlug, capture_method: captureMethod || null,
        receipt_url: receiptUrl || null, verified: false,
        processing_error: "Conciliação administrativa iniciada; aguardando verificação no payment_check."
      });
      if (insertError && insertError.code !== "23505") throw insertError;
      const responseFromVerifier = await fetch(SUPABASE_URL + "/functions/v1/payment-status", {
        method: "POST",
        headers: { "content-type": "application/json", "apikey": SERVICE_ROLE_KEY, "authorization": "Bearer " + SERVICE_ROLE_KEY },
        body: JSON.stringify({ order_nsu: orderId, transaction_nsu: transactionNsu, slug: invoiceSlug,
          receipt_url: receiptUrl, capture_method: captureMethod })
      });
      const verification = await responseFromVerifier.json().catch(() => ({}));
      if (!responseFromVerifier.ok || verification.ok !== true) {
        const message = clean(verification.error, 300) || "Não foi possível consultar a InfinitePay agora.";
        await admin.from("payment_provider_events").update({ processing_error: message })
          .eq("event_key", eventKey).eq("verified", false);
        return reply({ error: message, code: "payment_check_unavailable" }, 503, origin);
      }
      const { data: savedEvent, error: savedEventError } = await admin.from("payment_provider_events")
        .select("verified, processing_error").eq("event_key", eventKey).maybeSingle();
      if (savedEventError) throw savedEventError;
      if (verification.payment_status === "pending" && savedEvent?.verified !== true) {
        await admin.from("payment_provider_events")
          .update({ processing_error: "A InfinitePay ainda não retornou success=true e paid=true. Nenhum pagamento foi liberado." })
          .eq("event_key", eventKey).eq("verified", false);
      }
      return reply({ ok: true, order_number: verification.order_number, payment_status: verification.payment_status,
        fulfillment_status: verification.fulfillment_status, management_sales_sync_status: verification.management_sales_sync_status,
        reconciliation: verification.reconciliation, reference_source: referenceSource,
        provider_verified: savedEvent?.verified === true }, 200, origin);
    }

    if (action === "status") {
      return reply({
        ok: true,
        infinitepay_api_key_configured: Boolean(INFINITEPAY_API_KEY),
        infinitepay_handle_configured: Boolean(INFINITEPAY_HANDLE),
        email_notification_configured: Boolean(RESEND_API_KEY && EMAIL_FROM),
        route_calculation_configured: Boolean(GOOGLE_MAPS_API_KEY),
        checkout_endpoint: "create-payment-order",
        webhook_endpoint: "infinitepay-webhook"
      }, 200, origin);
    }

    if (action === "test_email_notification") {
      if (!RESEND_API_KEY || !EMAIL_FROM) {
        return reply({ error: "Configure RESEND_API_KEY e EMAIL_FROM nos Secrets do Supabase." }, 409, origin);
      }
      const notification = await notifyOwnerByEmail({
        order_number: "TESTE",
        customer_name: "Teste da Central de Operações",
        customer_phone: "Não se aplica",
        delivery_address: { city: "Bauru", state: "SP" },
        subtotal: 15,
        shipping_amount: 0,
        total_amount: 15,
        payment_amount_cents: 1500,
        payment_method: "pix"
      }, [{
        product_name: "Mensagem de teste",
        quantity: 1,
        unit_price: 15,
        line_total: 15
      }]);
      if (notification.status !== "sent") {
        return reply({ ok: false, error: notification.error || "Não foi possível enviar o e-mail de teste." }, 502, origin);
      }
      return reply({ ok: true, notification_status: "sent" }, 200, origin);
    }

    if (action === "list") {
      const { data, error } = await admin.from("fulfillment_sla_rules")
        .select("id, city_normalized, state, fulfillment_mode, dispatch_minutes, delivery_minutes, dispatch_target_minutes, delivery_target_minutes, delivery_fee_cents, free_delivery_if_contains_kit, scheduled_delivery_enabled, scheduled_discount_percent, scheduled_delivery_weekdays, scheduled_window_start, scheduled_window_end, freight_origin_cep, express_fee_up_to_12km_cents, express_fee_up_to_35km_cents, express_fee_up_to_55km_cents, scheduled_fee_up_to_12km_cents, scheduled_fee_up_to_35km_cents, scheduled_fee_up_to_55km_cents, minimum_order_up_to_12km_cents, minimum_order_up_to_35km_cents, minimum_order_up_to_55km_cents, scheduled_max_advance_hours, automatic_payment_enabled, active, updated_at")
        .order("state", { ascending: true })
        .order("city_normalized", { ascending: true });
      if (error) throw error;
      return reply({ ok: true, rules: data || [] }, 200, origin);
    }

    if (action === "save") {
      const city = typeof body.city === "string" ? body.city.trim().slice(0, 100) : "";
      const state = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
      const mode = body.fulfillment_mode === "pickup" ? "pickup" : "delivery";
      const dispatchMinutes = Math.trunc(Number(body.dispatch_minutes));
      const deliveryMinutes = Math.trunc(Number(body.delivery_minutes));
      const dispatchTarget = body.dispatch_target_minutes === null || body.dispatch_target_minutes === "" || body.dispatch_target_minutes === undefined ? null : Math.trunc(Number(body.dispatch_target_minutes));
      const deliveryTarget = body.delivery_target_minutes === null || body.delivery_target_minutes === "" || body.delivery_target_minutes === undefined ? null : Math.trunc(Number(body.delivery_target_minutes));
      const feeReais = Number(String(body.delivery_fee_reais ?? "").replace(",", "."));
      const originCep = clean(body.freight_origin_cep, 12).replace(/\D/g, "");
      const expressFees = [body.express_fee_up_to_12km_reais, body.express_fee_up_to_35km_reais, body.express_fee_up_to_55km_reais]
        .map(value => Number(String(value ?? "").replace(",", ".")));
      const scheduledFees = [body.scheduled_fee_up_to_12km_reais, body.scheduled_fee_up_to_35km_reais, body.scheduled_fee_up_to_55km_reais]
        .map(value => Number(String(value ?? "").replace(",", ".")));
      const minimumOrders = [body.minimum_order_up_to_12km_reais, body.minimum_order_up_to_35km_reais, body.minimum_order_up_to_55km_reais]
        .map(value => Number(String(value ?? "").replace(",", ".")));
      const scheduledMaxAdvanceHours = Math.trunc(Number(body.scheduled_max_advance_hours ?? 72));
      const freeKit = body.free_delivery_if_contains_kit === true;
      const scheduledEnabled = body.scheduled_delivery_enabled === true;
      const scheduledDiscount = Number(body.scheduled_discount_percent ?? 0);
      const scheduledWeekdays = Array.isArray(body.scheduled_delivery_weekdays)
        ? Array.from(new Set(body.scheduled_delivery_weekdays.map((day: unknown) => Math.trunc(Number(day))).filter((day: number) => Number.isInteger(day) && day >= 1 && day <= 7))).sort()
        : [1, 2, 3];
      const scheduledWindowStart = clean(body.scheduled_window_start, 5);
      const scheduledWindowEnd = clean(body.scheduled_window_end, 5);
      const automaticEnabled = body.automatic_payment_enabled === true;
      const active = body.active !== false;

      if (city.length < 2 || !/^[A-Z]{2}$/.test(state)) {
        return reply({ error: "Informe uma cidade e uma UF válidas." }, 400, origin);
      }
      if (!Number.isInteger(dispatchMinutes) || dispatchMinutes < 1 || dispatchMinutes > 10080 ||
          !Number.isInteger(deliveryMinutes) || deliveryMinutes < (mode === "pickup" ? 0 : 1) || deliveryMinutes > 10080) {
        return reply({ error: "Informe prazos válidos em minutos. Expedição deve ser de pelo menos 1 minuto." }, 400, origin);
      }
      if ((dispatchTarget !== null && (!Number.isInteger(dispatchTarget) || dispatchTarget < 0 || dispatchTarget > dispatchMinutes)) ||
          (deliveryTarget !== null && (!Number.isInteger(deliveryTarget) || deliveryTarget < 0 || deliveryTarget > deliveryMinutes))) {
        return reply({ error: "As metas operacionais devem ser números inteiros entre zero e o prazo máximo correspondente." }, 400, origin);
      }
      if ((dispatchTarget === null) !== (deliveryTarget === null)) {
        return reply({ error: "Preencha as duas metas operacionais ou deixe ambas em branco." }, 400, origin);
      }
      if (!Number.isFinite(scheduledDiscount) || scheduledDiscount < 0 || scheduledDiscount > 100) {
        return reply({ error: "O desconto do agendamento deve ficar entre 0% e 100%." }, 400, origin);
      }
      if (scheduledEnabled && (!scheduledWeekdays.length || !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledWindowStart) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledWindowEnd) || scheduledWindowEnd <= scheduledWindowStart)) {
        return reply({ error: "Para ativar agendamentos, escolha os dias e uma janela de horário válida." }, 400, origin);
      }
      if (!/^\d{8}$/.test(originCep) ||
          expressFees.some(value => !Number.isFinite(value) || value < 0 || value > 10000) ||
          scheduledFees.some(value => !Number.isFinite(value) || value < 0 || value > 10000) ||
          minimumOrders.some(value => !Number.isFinite(value) || value < 0 || value > 100000) ||
          !Number.isInteger(scheduledMaxAdvanceHours) || scheduledMaxAdvanceHours < 1 || scheduledMaxAdvanceHours > 168) {
        return reply({ error: "Informe o CEP de origem, os fretes por faixa, os pedidos mínimos e o limite de agendamento." }, 400, origin);
      }
      if (!Number.isFinite(feeReais) || feeReais < 0 || feeReais > 10000) {
        return reply({ error: "Informe um valor de frete válido." }, 400, origin);
      }
      if (automaticEnabled && (!INFINITEPAY_API_KEY || !INFINITEPAY_HANDLE)) {
        return reply({ error: "Para liberar pagamentos automáticos, configure a API Key e a InfiniteTag nos Secrets do Supabase." }, 409, origin);
      }
      const { data, error } = await admin.from("fulfillment_sla_rules").upsert({
        city_normalized: normalizeCity(city),
        state,
        fulfillment_mode: mode,
        dispatch_minutes: dispatchMinutes,
        delivery_minutes: deliveryMinutes,
        dispatch_target_minutes: dispatchTarget,
        delivery_target_minutes: deliveryTarget,
        scheduled_delivery_enabled: scheduledEnabled,
        scheduled_discount_percent: scheduledDiscount,
        scheduled_delivery_weekdays: scheduledWeekdays,
        scheduled_window_start: scheduledEnabled ? scheduledWindowStart : null,
        scheduled_window_end: scheduledEnabled ? scheduledWindowEnd : null,
        delivery_fee_cents: Math.round(feeReais * 100),
        freight_origin_cep: originCep,
        express_fee_up_to_12km_cents: Math.round(expressFees[0] * 100),
        express_fee_up_to_35km_cents: Math.round(expressFees[1] * 100),
        express_fee_up_to_55km_cents: Math.round(expressFees[2] * 100),
        scheduled_fee_up_to_12km_cents: Math.round(scheduledFees[0] * 100),
        scheduled_fee_up_to_35km_cents: Math.round(scheduledFees[1] * 100),
        scheduled_fee_up_to_55km_cents: Math.round(scheduledFees[2] * 100),
        minimum_order_up_to_12km_cents: Math.round(minimumOrders[0] * 100),
        minimum_order_up_to_35km_cents: Math.round(minimumOrders[1] * 100),
        minimum_order_up_to_55km_cents: Math.round(minimumOrders[2] * 100),
        scheduled_max_advance_hours: scheduledMaxAdvanceHours,
        free_delivery_if_contains_kit: freeKit,
        automatic_payment_enabled: automaticEnabled,
        active,
        updated_at: new Date().toISOString()
      }, { onConflict: "city_normalized,state,fulfillment_mode" })
      .select("id, city_normalized, state, fulfillment_mode, dispatch_minutes, delivery_minutes, dispatch_target_minutes, delivery_target_minutes, delivery_fee_cents, free_delivery_if_contains_kit, scheduled_delivery_enabled, scheduled_discount_percent, scheduled_delivery_weekdays, scheduled_window_start, scheduled_window_end, freight_origin_cep, express_fee_up_to_12km_cents, express_fee_up_to_35km_cents, express_fee_up_to_55km_cents, scheduled_fee_up_to_12km_cents, scheduled_fee_up_to_35km_cents, scheduled_fee_up_to_55km_cents, minimum_order_up_to_12km_cents, minimum_order_up_to_35km_cents, minimum_order_up_to_55km_cents, scheduled_max_advance_hours, automatic_payment_enabled, active, updated_at")
      .single();
      if (error) throw error;
      return reply({ ok: true, rule: data }, 200, origin);
    }

    if (action === "fulfillment_queue") {
      const { data: orders, error: ordersError } = await admin.from("orders")
        .select("id, order_number, status, payment_status, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, payment_method, payment_amount_cents, paid_at, dispatch_sla_minutes, delivery_sla_minutes, dispatch_due_at, delivery_due_at, dispatch_started_at, dispatched_at, delivered_at, fulfillment_type, scheduled_delivery_date, scheduled_window_start, scheduled_window_end, scheduled_discount_amount, created_at")
        .eq("payment_status", "paid")
        .in("status", ["confirmed", "processing", "out_for_delivery"])
        .order("dispatch_due_at", { ascending: true })
        .limit(100);
      if (ordersError) throw ordersError;
      const orderIds = (orders || []).map((order: any) => order.id);
      let items: any[] = [];
      let events: any[] = [];
      if (orderIds.length) {
        const [itemResult, eventResult] = await Promise.all([
          admin.from("order_items")
            .select("order_id, product_id, product_name, quantity, unit_price, line_total")
            .in("order_id", orderIds),
          admin.from("payment_provider_events")
            .select("id, order_id, email_notification_status, email_notification_sent_at, email_notification_error")
            .in("order_id", orderIds)
            .eq("verified", true)
            .order("received_at", { ascending: false })
        ]);
        if (itemResult.error) throw itemResult.error;
        if (eventResult.error) throw eventResult.error;
        items = itemResult.data || [];
        events = eventResult.data || [];
      }
      const latestEvent = new Map<string, any>();
      for (const event of events) if (!latestEvent.has(event.order_id)) latestEvent.set(event.order_id, event);
      return reply({
        ok: true,
        orders: (orders || []).map((order: any) => ({
          ...order,
          items: items.filter((item: any) => item.order_id === order.id),
          notification: latestEvent.get(order.id) || null
        }))
      }, 200, origin);
    }

    if (action === "fulfillment_update") {
      const orderId = clean(body.order_id, 100);
      const nextStatus = clean(body.status, 40);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        return reply({ error: "Pedido inválido." }, 400, origin);
      }
      const { data: current, error: currentError } = await admin.from("orders")
        .select("id, order_number, status, payment_status")
        .eq("id", orderId).maybeSingle();
      if (currentError) throw currentError;
      if (!current || current.payment_status !== "paid") {
        return reply({ error: "Somente pedidos pagos podem avançar na expedição." }, 409, origin);
      }
      const transitions: Record<string, string[]> = {
        confirmed: ["processing"],
        processing: ["out_for_delivery"],
        out_for_delivery: ["delivered"]
      };
      if (!transitions[current.status]?.includes(nextStatus)) {
        return reply({ error: "Etapa inválida. Atualize o painel e tente novamente." }, 409, origin);
      }
      const now = new Date().toISOString();
      const update: Record<string, unknown> = { status: nextStatus, updated_at: now };
      if (nextStatus === "processing") update.dispatch_started_at = now;
      if (nextStatus === "out_for_delivery") update.dispatched_at = now;
      if (nextStatus === "delivered") update.delivered_at = now;
      const { data: updated, error: updateError } = await admin.from("orders")
        .update(update)
        .eq("id", orderId)
        .eq("status", current.status)
        .eq("payment_status", "paid")
        .select("id, order_number, status, dispatch_started_at, dispatched_at, delivered_at")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return reply({ error: "O pedido foi alterado em outra operação. Atualize e tente novamente." }, 409, origin);
      return reply({ ok: true, order: updated }, 200, origin);
    }

    if (action === "resend_email_notification") {
      const eventId = clean(body.event_id, 100);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
        return reply({ error: "Notificação inválida." }, 400, origin);
      }
      if (!RESEND_API_KEY || !EMAIL_FROM) {
        return reply({ error: "Configure RESEND_API_KEY e EMAIL_FROM nos Secrets do Supabase." }, 409, origin);
      }
      const { data: event, error: eventError } = await admin.from("payment_provider_events")
        .select("id, order_id, verified")
        .eq("id", eventId).maybeSingle();
      if (eventError) throw eventError;
      if (!event || event.verified !== true) return reply({ error: "Evento de pagamento não verificado." }, 404, origin);
      const { data: order, error: orderError } = await admin.from("orders")
        .select("order_number, payment_status, payment_amount_cents, payment_method, delivery_address, customer_name, customer_phone, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent")
        .eq("id", event.order_id).maybeSingle();
      if (orderError) throw orderError;
      if (!order || order.payment_status !== "paid") return reply({ error: "O pedido ainda não está confirmado como pago." }, 409, origin);
      const { data: items, error: itemsError } = await admin.from("order_items")
        .select("product_name, quantity, unit_price, line_total")
        .eq("order_id", event.order_id);
      if (itemsError) throw itemsError;
      const notification = await notifyOwnerByEmail(order, items || []);
      const { error: updateError } = await admin.from("payment_provider_events").update({
        email_notification_status: notification.status,
        email_notification_sent_at: notification.status === "sent" ? new Date().toISOString() : null,
        email_notification_message_id: notification.messageId,
        email_notification_error: notification.error
      }).eq("id", event.id);
      if (updateError) throw updateError;
      if (notification.status === "failed") return reply({ ok: false, error: notification.error || "Falha ao enviar e-mail." }, 502, origin);
      if (notification.status === "not_configured") return reply({ ok: false, error: "Configuração de e-mail ausente." }, 409, origin);
      return reply({ ok: true, notification_status: notification.status }, 200, origin);
    }

    return reply({ error: "Ação inválida." }, 400, origin);
  } catch (error) {
    console.error("payment-admin:", error);
    return reply({ error: error instanceof Error ? error.message : "Não foi possível processar a configuração." }, 400, origin);
  }
});
