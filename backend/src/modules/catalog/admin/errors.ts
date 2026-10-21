// Errors the admin catalog service raises on purpose. Routes turn them into the standard error envelope.

export type AdminErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "SLUG_TAKEN"
  | "CATEGORY_NOT_EMPTY"
  | "DUPLICATE"
  | "IN_USE"
  | "GROUP_RULE_INVALID"
  | "PRICE_INVALID"
  | "CATEGORY_DEPTH"
  | "OPTION_NOT_IN_GROUP"
  | "CHOICE_PRICE"
  | "KIND_LOCKED"
  | "LAST_PORTION"
  | "INVALID_TRANSITION";

const STATUS: Record<AdminErrorCode, number> = {
  VALIDATION_ERROR: 400, NOT_FOUND: 404, SLUG_TAKEN: 409, CATEGORY_NOT_EMPTY: 409, DUPLICATE: 409, IN_USE: 409,
  GROUP_RULE_INVALID: 400, PRICE_INVALID: 400, CATEGORY_DEPTH: 400, OPTION_NOT_IN_GROUP: 400, CHOICE_PRICE: 400,
  KIND_LOCKED: 409, LAST_PORTION: 400, INVALID_TRANSITION: 409,
};

export class AdminError extends Error {
  readonly status: number;
  constructor(readonly code: AdminErrorCode, message: string, readonly details: unknown[] = []) {
    super(message);
    this.name = "AdminError";
    this.status = STATUS[code];
  }
}

interface DbError { code?: string; message?: string; details?: string | null }

/**
 * Turns a database error into something the caller can act on. The database is the last line of defence (unique keys,
 * foreign keys, the rules in the catalog migration); the service checks first, but this catches races and anything it missed.
 * Unknown errors come back as plain Errors, which the route reports as a 500 without leaking details.
 */
export function fromDbError(error: DbError, what: string): Error {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  for (const code of ["CATEGORY_DEPTH", "CHOICE_PRICE", "OPTION_NOT_IN_GROUP"] as const) {
    if (text.includes(code)) {
      const readable = (error.message ?? code).replace(/^[A-Z_]+:\s*/, "");
      return new AdminError(code, readable);
    }
  }
  if (error.code === "23505") {
    if (/slug/.test(text)) return new AdminError("SLUG_TAKEN", "That web address (slug) is already used. Pick another one.");
    return new AdminError("DUPLICATE", `${what}: that already exists.`);
  }
  if (error.code === "23503") return new AdminError("IN_USE", `${what}: it is still used elsewhere. Hide it instead of deleting it.`);
  if (error.code === "23514") return new AdminError("VALIDATION_ERROR", `${what}: a value is out of range.`);
  return new Error(`${what}: ${error.message ?? "database error"}`);
}
