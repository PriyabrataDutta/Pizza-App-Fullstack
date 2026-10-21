import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { categoryCreate } from "@/modules/catalog/admin/schemas";
import { createCategory, listCategories } from "@/modules/catalog/admin/service";

// Includes hidden categories and a product count for each.
export const GET = adminRoute("categories", "view", async () => ({ items: await listCategories() }));

export const POST = adminRoute("categories", "manage", async ({ actor, req }) => createCategory(actor, await readJson(req, categoryCreate)), 201);
