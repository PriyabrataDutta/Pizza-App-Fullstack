import { createHash, randomBytes } from "node:crypto";

// Device tokens for guest checkout. The app receives the token once and keeps it; the server stores only its SHA-256 hash, so a
// copy of the database cannot be used to act as a customer. The prefix makes a leaked token easy to spot and revoke.

export const TOKEN_PREFIX = "cc1_";

export function newDeviceToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** "Bearer cc1_..." becomes the token, or null when the header is missing or does not look like one of ours. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1] ?? null;
  return token && token.startsWith(TOKEN_PREFIX) && token.length >= 40 && token.length <= 80 ? token : null;
}
