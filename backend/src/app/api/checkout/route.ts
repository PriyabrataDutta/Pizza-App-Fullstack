import { checkout, customerRoute, readBody } from "@/modules/checkout/http";
import { checkoutRequest } from "@/modules/checkout/schemas";

// Places an order. Everything is priced again on the server; repeating the request with the same idempotency_key returns the same order.
export const POST = customerRoute(
  async ({ customer, req }) => checkout.checkout(customer, await readBody(req, checkoutRequest)),
  { status: 201, shared: true, limit: { max: 30, windowMs: 60 * 60 * 1000, name: "checkout" }, ipLimit: { max: 60, windowMs: 60 * 60 * 1000, name: "checkout" } },
);
