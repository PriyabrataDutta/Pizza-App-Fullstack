import { checkout, customerRoute, readBody } from "@/modules/checkout/http";
import { addressCreate } from "@/modules/checkout/schemas";

export const GET = customerRoute(async ({ customer }) => ({ items: await checkout.listAddresses(customer) }));

export const POST = customerRoute(async ({ customer, req }) => checkout.createAddress(customer, await readBody(req, addressCreate)), { status: 201 });
