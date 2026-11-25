/**
 * Normalize untrusted analytics fields before writing them to the database.
 * This module is dependency-free so the input contract can be verified in
 * both Node tests and the Deno Edge Function.
 */

/**
 * Columns loaded from site_events for visitor intelligence.
 * Keep this projection aligned with every field consumed by readVisitorInsights.
 */
export const VISITOR_EVENT_ANALYTICS_COLUMNS = [
  "visit_id",
  "session_key",
  "event_name",
  "page_type",
  "page_path",
  "page_title",
  "product_id",
  "quantity",
  "created_at"
].join(", ");

const ALLOWED_ANALYTICS_VALUES = {
  traffic_source: ["direct", "search", "instagram", "facebook", "tiktok", "youtube", "referral", "unknown"],
  traffic_medium: ["direct", "organic", "paid", "social", "referral", "email", "unknown"],
  device_category: ["mobile", "desktop", "tablet", "unknown"],
  operating_system: ["android", "ios", "windows", "macos", "linux", "chromeos", "other", "unknown"],
  browser_family: ["chrome", "safari", "firefox", "edge", "samsung_internet", "opera", "other", "unknown"]
};

function normalizeUtm(value, lowercase = false) {
  if (typeof value !== "string") return null;
  const cleaned = value.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[^\p{L}\p{N} ._:/+-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned ? (lowercase ? cleaned.toLowerCase() : cleaned) : null;
}

export function normalizeAnalyticsContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value;
  const normalized = {};
  for (const [key, values] of Object.entries(ALLOWED_ANALYTICS_VALUES)) {
    const candidate = typeof raw[key] === "string" ? raw[key].toLowerCase() : "";
    normalized[key] = values.includes(candidate) ? candidate : "unknown";
  }
  const detail = typeof raw.traffic_source_detail === "string"
    ? raw.traffic_source_detail.toLowerCase().trim().slice(0, 120) : "";
  normalized.traffic_source_detail = /^[a-z0-9.-]{1,120}$/.test(detail) ? detail : null;
  normalized.utm_source = normalizeUtm(raw.utm_source, true);
  normalized.utm_medium = normalizeUtm(raw.utm_medium, true);
  normalized.utm_campaign = normalizeUtm(raw.utm_campaign);
  normalized.utm_content = normalizeUtm(raw.utm_content);
  normalized.utm_term = normalizeUtm(raw.utm_term);
  normalized.utm_id = normalizeUtm(raw.utm_id);
  return normalized;
}

export function applyAnalyticsContext(target, value) {
  const context = normalizeAnalyticsContext(value);
  if (!context) return target;
  Object.assign(target, context);
  return target;
}

export function normalizeAnalyticsPagePath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g, "").slice(0, 300);
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("?") || path.includes("#")) return null;
  return path;
}

export function normalizeAnalyticsPageTitle(value) {
  if (typeof value !== "string") return null;
  const title = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim().slice(0, 180);
  return title || null;
}


/**
 * First write establishes the visit start time and acquisition snapshot.
 * Later activity must not overwrite these attribution fields.
 */
export function buildVisitSessionCreatePatch(visitId, sessionKey, now, pagePath, pageTitle, analyticsContext) {
  const visit = {
    visit_id: visitId,
    session_key: sessionKey,
    started_at: now,
    last_activity_at: now,
    last_page_path: pagePath,
    last_page_title: pageTitle
  };
  return applyAnalyticsContext(visit, analyticsContext);
}

/**
 * Heartbeats and later events may update activity/page information only.
 * Omitting started_at and acquisition fields preserves first-touch attribution.
 */
export function buildVisitSessionActivityPatch(now, pagePath, pageTitle) {
  return {
    last_activity_at: now,
    last_page_path: pagePath,
    last_page_title: pageTitle
  };
}


/**
 * Returns visits whose activity interval overlaps the requested reporting
 * window, plus the subset that started inside it. The full overlapping set
 * keeps page events from ongoing visits linkable at the window boundary.
 */
export function selectVisitorSessionsForPeriod(sessions, from, to) {
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);
  if (!Array.isArray(sessions) || !Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime > toTime) {
    return { sessions: [], sessionsStartedInPeriod: [] };
  }

  const overlapping = [];
  const startedInPeriod = [];
  for (const session of sessions) {
    const startedAt = Date.parse(session?.started_at);
    const lastActivityAt = Date.parse(session?.last_activity_at);
    if (!Number.isFinite(startedAt) || !Number.isFinite(lastActivityAt) || startedAt > toTime || lastActivityAt < fromTime) {
      continue;
    }
    overlapping.push(session);
    if (startedAt >= fromTime && startedAt <= toTime) startedInPeriod.push(session);
  }

  return { sessions: overlapping, sessionsStartedInPeriod: startedInPeriod };
}


/**
 * Measures only the portion of a visit that falls inside the selected
 * reporting window. Both boundaries are clipped so visits crossing either
 * edge do not leak activity from outside the requested period.
 */
export function calculateVisitorSessionDurationWithinPeriod(session, from, to) {
  const periodStart = Date.parse(from);
  const periodEnd = Date.parse(to);
  const sessionStart = Date.parse(session?.started_at);
  const sessionEnd = Date.parse(session?.last_activity_at);

  if (
    !Number.isFinite(periodStart) ||
    !Number.isFinite(periodEnd) ||
    !Number.isFinite(sessionStart) ||
    !Number.isFinite(sessionEnd) ||
    periodStart > periodEnd
  ) {
    return 0;
  }

  const clippedStart = Math.max(sessionStart, periodStart);
  const clippedEnd = Math.min(sessionEnd, periodEnd);
  return clippedEnd > clippedStart ? Math.round((clippedEnd - clippedStart) / 1000) : 0;
}
