// A small in-memory limiter: at most `max` hits per key in a rolling window. Per server instance only; a production setup with
// several instances needs a shared store. It keeps abuse of the open endpoints (guest sign-up, checkout) within reason.

const hits = new Map<string, number[]>();
let lastSweep = 0;

export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, list] of hits) {
      const recent = list.filter((t) => now - t < windowMs * 4);
      if (recent.length === 0) hits.delete(k);
      else hits.set(k, recent);
    }
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function resetRateLimits() {
  hits.clear();
  lastSweep = 0;
}
