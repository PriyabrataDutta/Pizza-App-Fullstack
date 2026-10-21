import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { catalog, catalogSnapshot, errorResponse } from "../catalog/http";
import { allow } from "./rate-limit";
import { supabaseCheckoutRepository } from "./repository";
import { CheckoutError, createCheckoutService } from "./service";
import { bearerToken } from "./token";
import type { Customer } from "./types";

// Shared plumbing for the customer API: the service wired to Supabase and the product catalog, token sign-in, rate limits, and the
// standard error envelope. Customers are guests identified by a device token (Authorization: Bearer cc1_...).

export const checkout = createCheckoutService({ repo: supabaseCheckoutRepository, loadProduct: async (id) => {
    // Orders are priced from the freshest menu: re-check the version (at most every half second) so a price changed a moment ago counts.
    await catalogSnapshot.refresh(500);
    return catalog.product(id);
  }, });

export interface CustomerCall<P> {
  customer: Customer;
  req: NextRequest;
  params: P;
}

async function readBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new CheckoutError(400, "VALIDATION_ERROR", "The request body must be valid JSON.");
  }
  return schema.parse(body);
}
export { readBody };

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Maps anything thrown by a handler to the error envelope. Unknown errors are logged and reported without details. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof CheckoutError) return errorResponse(error.status, error.code, error.message, error.details);
  if (error instanceof ZodError) {
    const details = error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return errorResponse(400, "VALIDATION_ERROR", details[0]?.message ?? "The request is not valid.", details);
  }
  console.error("checkout request failed", error);
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

/**
 * Wraps a handler for signed-in guests: 401 without a valid device token, 429 when someone sends too many requests, and the
 * standard errors. Responses are never cached, because they are private to the customer.
 */
export function customerRoute<P = Record<string, never>>(
  handler: (call: CustomerCall<P>) => Promise<unknown>,
  opts: { status?: number; limit?: { max: number; windowMs: number; name: string } } = {},
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const token = bearerToken(req.headers.get("authorization"));
      if (!token) return errorResponse(401, "UNAUTHENTICATED", "Open the app again to continue.");
      const customer = await checkout.authenticate(token);
      if (!customer) return errorResponse(401, "UNAUTHENTICATED", "Open the app again to continue.");
      const limit = opts.limit ?? { max: 300, windowMs: 60_000, name: "api" };
      if (!allow(`${limit.name}:${customer.id}`, limit.max, limit.windowMs)) return errorResponse(429, "RATE_LIMITED", "Too many requests. Wait a moment and try again.");

      const result = await handler({ customer, req, params: await ctx.params });
      if (opts.status === 204) return new NextResponse(null, { status: 204 });
      return NextResponse.json(result ?? { ok: true }, { status: opts.status ?? 200, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
