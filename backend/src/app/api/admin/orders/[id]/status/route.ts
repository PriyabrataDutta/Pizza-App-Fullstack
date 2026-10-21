import { z } from "zod";
import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { changeStatus } from "@/modules/checkout/admin";

const body = z.object({
  status: z.enum(["accepted", "preparing", "ready_for_dispatch", "out_for_delivery", "delivered", "rejected", "cancelled"]),
  reason: z.string().trim().max(200).optional(),
});

// Moves an order along its lifecycle. A move the lifecycle does not allow is refused with 409 INVALID_TRANSITION.
export const PATCH = adminRoute<{ id: string }>("orders", "manage", async ({ actor, req, params }) => {
  const input = await readJson(req, body);
  return changeStatus(actor, params.id, input.status, input.reason);
});
