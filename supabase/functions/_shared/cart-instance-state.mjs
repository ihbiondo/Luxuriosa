const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidCartInstanceId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function resolveCartInstanceId(requestedId, legacyCartSessionId) {
  if (requestedId === null || requestedId === undefined) {
    return { id: legacyCartSessionId, isLegacy: true };
  }
  if (!isValidCartInstanceId(requestedId)) {
    throw new Error("Identificador do carrinho inválido.");
  }
  return { id: requestedId, isLegacy: false };
}

export function canReuseCartInstance(status, action, itemCount, isLegacy = false) {
  if (isLegacy) return true;
  if (status === "converted") return false;
  if (status !== "cleared") return true;
  return action === "cart_snapshot" && Number(itemCount) === 0;
}

export function cartInstanceStatusForAction(action, itemCount, isLegacy = false, currentStatus = null) {
  if (!isLegacy && action === "cart_snapshot" && Number(itemCount) === 0) return "cleared";
  if (action === "checkout_started") return "checkout_started";
  if (action === "checkout_reviewed") return "checkout_reviewed";
  if (action === "whatsapp_opened") return "whatsapp_opened";
  if (!isLegacy && action === "cart_snapshot" &&
      ["checkout_started", "checkout_reviewed", "whatsapp_opened", "converted"].includes(currentStatus)) {
    return currentStatus;
  }
  return "active";
}
