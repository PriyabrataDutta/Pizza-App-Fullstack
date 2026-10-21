import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { reorder } from "@/modules/catalog/admin/schemas";
import { reorderCategories } from "@/modules/catalog/admin/service";

// Body: { "ids": [...] } in the new order. Only categories with the same parent can be reordered together.
export const POST = adminRoute("categories", "manage", async ({ actor, req }) => {
  await reorderCategories(actor, (await readJson(req, reorder)).ids);
  return { ok: true };
});
