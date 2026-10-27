import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getCurrentUser } from "@/modules/access/current-user";
import { can, type Access, type Module, type Principal } from "@/modules/access/permissions";
import { errorResponse, noStore } from "../http";
import { AdminError } from "./errors";
import { isSameOrigin } from "./origin";
import type { Actor } from "./service";

// Shared wrapper for the admin routes. The dashboard's session cookie proves who is calling, but what they may do is read
// from the database on every request (so changing a role or deactivating a user takes effect at once). Mutations also
// refuse cross-site requests, because a cookie alone would let another website make the browser send them.

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export interface AdminCall<P> {
  actor: Actor;
  principal: Principal;
  req: NextRequest;
  params: P;
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AdminError("VALIDATION_ERROR", "The request body must be valid JSON.");
  }
  return schema.parse(body);
}

export function intParam(value: string | null, name: string, fallback: number, max: number): number {
  if (value === null || value === "") return fallback;
  if (!/^\d{1,6}$/.test(value) || Number(value) > max) throw new AdminError("VALIDATION_ERROR", `${name} must be a whole number up to ${max}.`);
  return Number(value);
}

export function boolParam(value: string | null, name: string): boolean | undefined {
  if (value === null || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AdminError("VALIDATION_ERROR", `${name} must be true or false.`);
}

/**
 * Wraps a handler: 401 when signed out, 403 when the module is not allowed at the needed level, 403 for a cross-site mutation,
 * zod and AdminError mapped to the standard error envelope, and anything else a 500 that leaks nothing.
 */
export function adminRoute<P = Record<string, never>>(
  module: Module,
  need: Access,
  handler: (call: AdminCall<P>) => Promise<unknown>,
  successStatus = 200,
) {
  const handle = async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const me = await getCurrentUser();
      if (!me) return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
      if (me.user.mustChangePassword) return errorResponse(403, "PASSWORD_CHANGE_REQUIRED", "Change your temporary password first.");
      if (!can(me.principal, module, need)) return errorResponse(403, "FORBIDDEN", "You do not have access to this.");
      if (req.method !== "GET" && !isSameOrigin(req)) return errorResponse(403, "CROSS_SITE", "This request must come from the dashboard.");

      const result = await handler({ actor: { id: me.user.id, email: me.user.email }, principal: me.principal, req, params: await ctx.params });
      if (successStatus === 204) return new NextResponse(null, { status: 204 });
      return NextResponse.json(result ?? { ok: true }, { status: successStatus, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error.status, error.code, error.message);
      if (error instanceof AdminError) return errorResponse(error.status, error.code, error.message, error.details);
      if (error instanceof ZodError) {
        const details = error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
        return errorResponse(400, "VALIDATION_ERROR", details[0]?.message ?? "The request is not valid.", details);
      }
      console.error("admin catalog request failed", error);
      return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  };
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => noStore(await handle(req, ctx));
}
