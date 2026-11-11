export function normalizeInventoryMovementDelta(
  movementType: unknown,
  quantity: unknown,
  quantityDelta: unknown
): number | null {
  const type = typeof movementType === "string" ? movementType.trim() : "";

  if (type === "adjustment") {
    const delta = Number(quantityDelta);
    return Number.isSafeInteger(delta) && delta !== 0 && Math.abs(delta) <= 1_000_000
      ? delta
      : null;
  }

  const signs: Record<string, number> = {
    opening: 1,
    inbound: 1,
    return: 1,
    outbound: -1,
    loss: -1
  };
  const sign = signs[type];
  const amount = Number(quantity);

  if (sign === undefined || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000) {
    return null;
  }

  return amount * sign;
}
