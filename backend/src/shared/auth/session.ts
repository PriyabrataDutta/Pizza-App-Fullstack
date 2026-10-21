// Signed session cookie using Web Crypto, so it works in both middleware (edge) and server code.
// The cookie only proves WHO signed in. What they may do is read from the database on every request,
// so changing someone's role or modules (or deactivating them) takes effect immediately.

export const SESSION_COOKIE = "cc_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export interface Session {
  uid: string;
  exp: number; // unix seconds
}

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  return s;
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function key(usage: KeyUsage) {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signSession(uid: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE } satisfies Session)));
  const sig = await crypto.subtle.sign("HMAC", await key("sign"), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/** Returns the session if the signature is valid and not expired; otherwise null. */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key("verify"), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    return typeof s.uid === "string" && s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}
