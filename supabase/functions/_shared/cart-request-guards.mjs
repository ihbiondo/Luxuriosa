/**
 * Runs independent request guards concurrently while preserving the separate
 * error path for rate-limit failures and the existing authentication behavior.
 */
function settleWithDuration(operation) {
  const startedAt = performance.now();
  return Promise.resolve()
    .then(operation)
    .then(
      value => ({
        status: "fulfilled",
        value,
        elapsedMs: performance.now() - startedAt
      }),
      reason => ({
        status: "rejected",
        reason,
        elapsedMs: performance.now() - startedAt
      })
    );
}

export class RateLimitUnavailableError extends Error {
  constructor(cause) {
    super("Rate limit unavailable", { cause });
    this.name = "RateLimitUnavailableError";
  }
}

export async function runCartRequestGuards(rateLimit, resolveUser) {
  const [rateResult, userResult] = await Promise.all([
    settleWithDuration(rateLimit),
    settleWithDuration(resolveUser)
  ]);

  if (rateResult.status === "rejected") {
    throw new RateLimitUnavailableError(rateResult.reason);
  }
  if (userResult.status === "rejected") {
    throw userResult.reason;
  }

  return {
    withinRateLimit: rateResult.value === true,
    userId: userResult.value ?? null,
    rateLimitMs: Math.round(rateResult.elapsedMs),
    authMs: Math.round(userResult.elapsedMs)
  };
}
