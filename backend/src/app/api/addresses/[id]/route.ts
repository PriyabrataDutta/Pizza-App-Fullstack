import { checkout, customerRoute, readBody } from "@/modules/checkout/http";
import { addressUpdate } from "@/modules/checkout/schemas";

type P = { id: string };

export const PATCH = customerRoute<P>(async ({ customer, req, params }) => checkout.updateAddress(customer, params.id, await readBody(req, addressUpdate)));

export const DELETE = customerRoute<P>(async ({ customer, params }) => checkout.deleteAddress(customer, params.id), { status: 204 });
