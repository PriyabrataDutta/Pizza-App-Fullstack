import { checkout, customerRoute, readBody } from "@/modules/checkout/http";
import { quoteRequest } from "@/modules/checkout/schemas";

// Prices a cart from ids and quantities only. The response is the one authority on what the customer would pay.
export const POST = customerRoute(async ({ customer, req }) => checkout.quote(customer, await readBody(req, quoteRequest)));
