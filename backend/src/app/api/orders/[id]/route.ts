import { checkout, customerRoute } from "@/modules/checkout/http";
import { CheckoutError } from "@/modules/checkout/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = customerRoute<{ id: string }>(async ({ customer, params }) => {
  if (!UUID.test(params.id)) throw new CheckoutError(404, "ORDER_NOT_FOUND", "That order does not exist.");
  return checkout.getOrder(customer, params.id);
});
