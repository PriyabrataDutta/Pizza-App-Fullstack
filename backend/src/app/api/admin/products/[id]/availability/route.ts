import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { availability } from "@/modules/catalog/admin/schemas";
import { setAvailability } from "@/modules/catalog/admin/service";

// Quick switches: { "is_active": false } hides the product; { "portion_key": "gross", "is_available": false } marks one size sold out.
export const PATCH = adminRoute<{ id: string }>("menu", "manage", async ({ actor, req, params }) => setAvailability(actor, params.id, await readJson(req, availability)));
