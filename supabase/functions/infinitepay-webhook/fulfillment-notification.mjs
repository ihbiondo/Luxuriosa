const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatDateTime(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date).replace(", ", " às ");
}

function formatDate(value) {
  const date = text(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? match[3] + "/" + match[2] + "/" + match[1] : "Não informado";
}

function formatTime(value) {
  const time = text(value);
  return /^\d{2}:\d{2}(?::\d{2})?$/.test(time) ? time.slice(0, 5) : "";
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "Não informado";
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatAddress(address) {
  const value = address && typeof address === "object" ? address : {};
  const zipDigits = text(value.zip).replace(/\D/g, "");
  const zip = zipDigits.length === 8
    ? "CEP " + zipDigits.slice(0, 5) + "-" + zipDigits.slice(5)
    : zipDigits ? "CEP " + zipDigits : "";
  return [
    text(value.street),
    text(value.number),
    text(value.complement),
    text(value.district || value.neighborhood),
    [text(value.city), text(value.state).toUpperCase()].filter(Boolean).join("/"),
    zip
  ].filter(Boolean).join(", ") || "Endereço não informado";
}

/**
 * Formata a modalidade e o destino para a notificação administrativa.
 * Não executa consultas, não envia e-mail e não modifica dados do pedido.
 */
export function buildFulfillmentNotification(order = {}) {
  const type = text(order.fulfillment_type).toLowerCase() || "express";
  const isPickup = type === "pickup";
  const isScheduled = type === "scheduled";
  const address = formatAddress(order.delivery_address);

  let scheduleLabel = "";
  let scheduleText = "";
  if (isPickup) {
    scheduleLabel = "Data/hora pretendida para retirada";
    scheduleText = formatDateTime(order.pickup_requested_at);
  } else if (isScheduled) {
    scheduleLabel = "Janela de entrega";
    const date = formatDate(order.scheduled_delivery_date);
    const start = formatTime(order.scheduled_window_start);
    const end = formatTime(order.scheduled_window_end);
    scheduleText = date !== "Não informado" && start && end
      ? date + ", das " + start + " às " + end
      : "Não informado";
  }

  return {
    fulfillmentLabel: isPickup ? "Retirada agendada" : isScheduled ? "Entrega agendada" : "Entrega imediata",
    destinationLabel: isPickup ? "Local de retirada" : "Endereço de entrega",
    destinationText: address,
    scheduleLabel,
    scheduleText,
    freightLabel: isPickup ? "Frete na retirada" : "Frete",
    freightText: isPickup || Number(order.shipping_amount || 0) === 0
      ? "Gratuito"
      : formatMoney(order.shipping_amount)
  };
}
