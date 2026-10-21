/** Browsers always send Origin on a non-GET request; when present it must be this site. Other clients (scripts) carry no browser cookies. */
export function isSameOrigin(req: { headers: Pick<Headers, "get"> }): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === req.headers.get("host");
    } catch {
      return false;
    }
  }
  const site = req.headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "none";
}
