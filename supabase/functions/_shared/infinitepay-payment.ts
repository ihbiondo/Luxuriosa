import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const INFINITEPAY_API_KEY = Deno.env.get("INFINITEPAY_API_KEY") || "";
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "";

const BUSINESS_TZ = "America/Sao_Paulo";
const BUSINESS_HOURS: Record<string, { open: number; close: number }> = {
  Mon: { open: 600, close: 1260 }, Tue: { open: 600, close: 1260 }, Wed: { open: 600, close: 1260 },
  Thu: { open: 600, close: 1380 }, Fri: { open: 600, close: 1380 }, Sat: { open: 600, close: 1380 },
  Sun: { open: 600, close: 1200 }
};
const businessClock = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

export function clean(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asInteger(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function isWithinDeliveryHours(date: Date): boolean {
  const parts = Object.fromEntries(businessClock.formatToParts(date).map((part) => [part.type, part.value]));
  const schedule = BUSINESS_HOURS[parts.weekday];
  if (!schedule) return false;
  const minuteOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  return minuteOfDay >= schedule.open && minuteOfDay < schedule.close;
}

function addBusinessMinutes(start: Date, minutes: number): Date {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080) {
    throw new Error("Prazo operacional inválido.");
  }
  let cursor = new Date(Math.ceil(start.getTime() / 60000) * 60000);
  let remaining = minutes;
  let guard = 0;
  while (remaining > 0) {
    if (isWithinDeliveryHours(cursor)) remaining--;
    cursor = new Date(cursor.getTime() + 60000);
    if (++guard > 30 * 24 * 60) {
      throw new Error("Não foi possível calcular o prazo dentro do calendário de entrega.");
    }
  }
  return cursor;
}

function safeReceiptUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1000) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function verifyAndSettlePayment(
  admin: any,
  order: any,
  input: {
    orderNsu: string;
    transactionNsu: string;
    invoiceSlug: string;
    receiptUrl?: string;
    captureMethod?: string;
  }
) {
  if (!INFINITEPAY_API_KEY || !INFINITEPAY_HANDLE) {
    throw new Error("Configuração da InfinitePay indisponível no servidor.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  let verificationResponse: Response;
  try {
    verificationResponse = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Api-Key": INFINITEPAY_API_KEY
      },
      body: JSON.stringify({
        handle: INFINITEPAY_HANDLE,
        order_nsu: input.orderNsu,
        transaction_nsu: input.transactionNsu,
        slug: input.invoiceSlug
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  const verification = await verificationResponse.json().catch(() => ({}));
  if (!verificationResponse.ok) {
    throw new Error("A InfinitePay não respondeu à consulta de pagamento.");
  }
  if (verification?.success !== true || verification?.paid !== true) {
    return { confirmed: false, settlement: null };
  }

  const now = new Date();
  const dispatchDue = addBusinessMinutes(now, Number(order.dispatch_sla_minutes || 0));
  const deliveryDue = addBusinessMinutes(dispatchDue, Number(order.delivery_sla_minutes || 0));
  const verifiedMethod = verification.capture_method === "pix" || verification.capture_method === "credit_card"
    ? verification.capture_method
    : (input.captureMethod === "pix" || input.captureMethod === "credit_card" ? input.captureMethod : null);
  const installments = Number(verification.installments);
  const { data: settlement, error } = await admin.rpc("confirm_infinitepay_payment", {
    p_order_nsu: input.orderNsu,
    p_transaction_nsu: input.transactionNsu,
    p_invoice_slug: input.invoiceSlug,
    p_amount_cents: asInteger(verification.amount),
    p_paid_amount_cents: asInteger(verification.paid_amount),
    p_capture_method: verifiedMethod,
    p_receipt_url: safeReceiptUrl(input.receiptUrl),
    p_installments: Number.isInteger(installments) && installments >= 1 && installments <= 12
      ? installments : null,
    p_dispatch_due_at: dispatchDue.toISOString(),
    p_delivery_due_at: deliveryDue.toISOString()
  });
  if (error) {
    console.error("Atomic InfinitePay settlement RPC failed.", error);
    throw new Error("Não foi possível registrar a confirmação do pagamento.");
  }
  return { confirmed: true, settlement };
}

async function getAdminEmailRecipients(admin: any): Promise<string[]> {
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

export async function notifyOwnerByEmail(admin: any, order: any, items: any[]) {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    return { status: "not_configured", messageId: null, error: null };
  }
  try {
    const recipients = await getAdminEmailRecipients(admin);
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
      (Number(order.club_discount_amount_cents || 0) > 0
        ? "<br><strong>Desconto Clube (" + escapeHtml(order.club_discount_percent || 10) + "%):</strong> -" + money(Number(order.club_discount_amount_cents) / 100)
        : "") +
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
      ...(Number(order.club_discount_amount_cents || 0) > 0
        ? ["Desconto Clube (" + (order.club_discount_percent || 10) + "%): -" + money(Number(order.club_discount_amount_cents) / 100)]
        : []),
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


export async function sendOrderNotification(
  admin: any,
  orderId: string,
  eventKey: string,
  newlyPaid: boolean
) {
  try {
    const { data: event, error: eventError } = await admin.from("payment_provider_events")
      .select("processed_at, email_notification_status")
      .eq("event_key", eventKey)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return { status: "missing_event" };

    const status = event.email_notification_status;
    const processedAt = event.processed_at ? new Date(event.processed_at).getTime() : 0;
    const stalePending = status === "pending" && processedAt > 0 &&
      Date.now() - processedAt >= 2 * 60 * 1000;
    if (!newlyPaid && status !== "failed" && !stalePending) {
      return { status: status || "not_configured" };
    }

    const { data: order, error: orderError } = await admin.from("orders")
      .select("order_number, customer_name, customer_phone, delivery_address, subtotal, shipping_amount, total_amount, club_discount_amount_cents, club_discount_percent, payment_amount_cents, payment_method")
      .eq("id", orderId)
      .single();
    if (orderError) throw orderError;
    const { data: items, error: itemsError } = await admin.from("order_items")
      .select("product_name, quantity, unit_price, line_total")
      .eq("order_id", orderId);
    if (itemsError) throw itemsError;

    const notification = await notifyOwnerByEmail(admin, order, items || []);
    const { error: updateError } = await admin.from("payment_provider_events").update({
      email_notification_status: notification.status,
      email_notification_sent_at: notification.status === "sent" ? new Date().toISOString() : null,
      email_notification_message_id: notification.messageId,
      email_notification_error: notification.error
    }).eq("event_key", eventKey);
    if (updateError) console.error("Email notification result could not be persisted.", updateError);
    return { status: notification.status };
  } catch (error) {
    console.error("Payment notification failed without reverting the payment.", error);
    return { status: "failed" };
  }
}
