import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { promotionUpdate } from "@/modules/promotions/schemas";
import { deletePromotion, updatePromotion } from "@/modules/promotions/service";

type P = { id: string };

export const PATCH = adminRoute<P>("offers", "manage", async ({ actor, req, params }) => updatePromotion(actor, params.id, await readJson(req, promotionUpdate)));

export const DELETE = adminRoute<P>("offers", "manage", async ({ actor, params }) => deletePromotion(actor, params.id), 204);
