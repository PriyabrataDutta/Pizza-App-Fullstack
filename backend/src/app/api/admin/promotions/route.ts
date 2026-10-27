import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { promotionCreate } from "@/modules/promotions/schemas";
import { createPromotion, listPromotions } from "@/modules/promotions/service";

// Every banner, including hidden, scheduled and ended ones, each with where it stands now.
export const GET = adminRoute("offers", "view", async () => listPromotions());

export const POST = adminRoute("offers", "manage", async ({ actor, req }) => createPromotion(actor, await readJson(req, promotionCreate)), 201);
