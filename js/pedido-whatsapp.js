const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function normalizarTelefoneWhatsApp(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (!/^55[1-9]\d{9,10}$/.test(digits)) return "";
  return digits;
}

export function montarResumoPedidoWhatsApp(order, items, includeProducts = false) {
  const rows = (Array.isArray(items) ? items : []).filter(item => item.order_id === order.id);
  const count = rows.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
  const createdAt = order.paid_at || order.created_at;
  const date = createdAt && !Number.isNaN(new Date(createdAt).getTime())
    ? new Date(createdAt).toLocaleString("pt-BR")
    : "Não informada";
  const paymentMethod = order.payment_method === "pix" ? "Pix"
    : order.payment_method === "credit_card" ? "Cartão de crédito"
    : "Não informado";
  const fulfillment = order.fulfillment_type === "pickup" ? "Retirada agendada"
    : order.fulfillment_type === "scheduled" ? "Entrega agendada"
    : order.fulfillment_type === "express" ? "Entrega"
    : "Conforme combinado com a Luxuriosa";
  const lines = [
    "LUXURIOSA — RESUMO DA COMPRA",
    "Pedido #" + order.order_number,
    "Data: " + date,
    "Pagamento: aprovado",
    "Forma de pagamento: " + paymentMethod,
    "Quantidade: " + count + (count === 1 ? " item" : " itens")
  ];
  if (includeProducts && rows.length) {
    lines.push("", "Produtos:");
    rows.forEach(item => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const lineTotal = Number.isFinite(Number(item.line_total))
        ? Number(item.line_total)
        : (Number(item.unit_price) || 0) * quantity;
      lines.push("• " + quantity + "× " + String(item.product_name || "Produto") + " — " + brl.format(lineTotal));
    });
  }
  lines.push("", "Subtotal: " + brl.format(Number(order.subtotal) || 0));
  const discount = Number(order.club_discount_amount_cents || 0) / 100;
  if (discount > 0) lines.push("Benefício Clube: -" + brl.format(discount));
  lines.push("Entrega: " + (order.shipping_amount == null ? "A combinar" : brl.format(Number(order.shipping_amount) || 0)));
  lines.push("Total do pedido: " + brl.format(Number(order.total_amount) || 0));
  lines.push("Modalidade: " + fulfillment);
  lines.push("", "Agradecemos sua preferência. Em caso de dúvida, fale com a Luxuriosa.");
  return lines.join("\n");
}

export function criarLinkWhatsApp(phone, message) {
  const normalized = normalizarTelefoneWhatsApp(phone);
  if (!normalized) throw new Error("Informe um número de WhatsApp brasileiro válido com DDD.");
  return "https://wa.me/" + normalized + "?text=" + encodeURIComponent(String(message || ""));
}
