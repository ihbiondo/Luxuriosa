/**
 * Keep the current cart state consistent when a visitor returns.
 * A newer operational state (checkout or conversion) is not downgraded by
 * background presence and browsing events.
 * @param {string | null | undefined} currentStatus
 * @returns {string}
 */
export function statusAfterVisitorActivity(currentStatus) {
  return !currentStatus || currentStatus === "abandoned" ? "active" : currentStatus;
}

/**
 * Every non-abandoned activity transition clears the current abandonment marker.
 * @param {string} now
 * @param {string} status
 * @returns {{ status: string, abandoned_at: null, updated_at: string }}
 */
export function buildCartActivityStatePatch(now, status) {
  return {
    status,
    abandoned_at: null,
    updated_at: now
  };
}

/**
 * Conversion is a terminal cart state for the current order.
 * @param {string} now
 * @returns {{ status: string, abandoned_at: null, converted_at: string, updated_at: string }}
 */
export function buildCartConvertedStatePatch(now) {
  return {
    status: "converted",
    abandoned_at: null,
    converted_at: now,
    updated_at: now
  };
}
