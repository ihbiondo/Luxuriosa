function normalizeLocality(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Frete grátis somente para pedidos que contenham pelo menos um kit,
 * com entrega em Bauru/SP. Tibiriçá mantém sua tarifa própria.
 */
export function isKitOrderEligibleForFreeBauruDelivery(orderItems, address) {
  const containsKit = Array.isArray(orderItems) && orderItems.some(item =>
    normalizeLocality(item?.product_snapshot?.category) === "kits"
  );

  return containsKit &&
    normalizeLocality(address?.city) === "bauru" &&
    normalizeLocality(address?.state) === "sp" &&
    normalizeLocality(address?.district) !== "tibirica";
}
