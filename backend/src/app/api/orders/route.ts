import { checkout, customerRoute } from "@/modules/checkout/http";

export const GET = customerRoute(async ({ customer }) => checkout.listOrders(customer));
