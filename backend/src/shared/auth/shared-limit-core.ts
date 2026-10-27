// A rate limiter whose counters live where every server instance can see them (the database function rate_limit_hit). An in-memory
// counter is per instance, and serverless runs many instances, so it stops almost nothing. If the shared store is slow or fails, the
// in-memory counter takes over for that call: a hiccup in the database must not block every login and order.

export interface SharedLimiterDeps {
  /** Counts one hit for the key and says whether it is still within the limit. Throws when the store cannot be reached. */
  hit: (key: string, max: number, windowSeconds: number) => Promise<boolean>;
  /** Per-instance fallback, same shape as modules/checkout/rate-limit `allow`. */
  fallback: (key: string, max: number, windowMs: number) => boolean;
  /** How long to wait for the shared store before using the fallback. */
  timeoutMs?: number;
  onError?: (error: unknown) => void;
}

export function createSharedLimiter({ hit, fallback, timeoutMs = 800, onError }: SharedLimiterDeps) {
  return async function allowShared(key: string, max: number, windowMs: number): Promise<boolean> {
    try {
      const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("rate limit store timed out")), timeoutMs); });
      try {
        return await Promise.race([hit(key, max, windowSeconds), timeout]);
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      onError?.(error);
      return fallback(key, max, windowMs);
    }
  };
}
