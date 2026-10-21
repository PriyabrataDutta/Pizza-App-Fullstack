// In-memory limiter: 5 failed attempts per email per 15 minutes. Per-instance only; use a shared store in production.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX = 5;

export function isLocked(email: string): boolean {
  const a = attempts.get(email.trim().toLowerCase());
  return !!a && a.resetAt > Date.now() && a.count >= MAX;
}
export function recordFailure(email: string) {
  const k = email.trim().toLowerCase();
  const a = attempts.get(k);
  if (!a || a.resetAt <= Date.now()) attempts.set(k, { count: 1, resetAt: Date.now() + WINDOW });
  else a.count += 1;
}
export function clearFailures(email: string) {
  attempts.delete(email.trim().toLowerCase());
}

// Per address, across all emails: stops one machine from trying one password against many accounts. Looser than the per-email
// limit because several staff may share the restaurant's connection.
const byIp = new Map<string, { count: number; resetAt: number }>();
const IP_MAX = 30;

export function isIpLocked(ip: string): boolean {
  const a = byIp.get(ip);
  return !!a && a.resetAt > Date.now() && a.count >= IP_MAX;
}
export function recordIpFailure(ip: string) {
  const a = byIp.get(ip);
  if (!a || a.resetAt <= Date.now()) byIp.set(ip, { count: 1, resetAt: Date.now() + WINDOW });
  else a.count += 1;
}
