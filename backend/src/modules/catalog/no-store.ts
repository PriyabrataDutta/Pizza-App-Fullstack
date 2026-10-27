/**
 * Private responses (a customer's own data, anything in the dashboard) must never be stored by a CDN or a shared cache, errors included.
 * Success responses already say so; this covers the error paths, which are built in many places.
 */
export function noStore<T extends Response>(res: T): T {
  if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
  return res;
}
