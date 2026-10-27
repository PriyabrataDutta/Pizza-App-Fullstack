import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { reorder } from "@/modules/catalog/admin/schemas";
import { reorderPromotions } from "@/modules/promotions/service";

// Body: { "ids": [...] } with every banner once, in the new order.
export const POST = adminRoute("offers", "manage", async ({ actor, req }) => reorderPromotions(actor, (await readJson(req, reorder)).ids));
