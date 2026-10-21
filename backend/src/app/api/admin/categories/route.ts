import { ensureThumbnail } from "@/modules/catalog/thumbnails";
import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { categoryCreate } from "@/modules/catalog/admin/schemas";
import { createCategory, listCategories } from "@/modules/catalog/admin/service";

// Includes hidden categories and a product count for each.
export const GET = adminRoute("categories", "view", async () => ({ items: await listCategories() }));

export const POST = adminRoute("categories", "manage", async ({ actor, req }) => {
  const input = await readJson(req, categoryCreate);
  const created = await createCategory(actor, input);
  await ensureThumbnail(input.image_path);
  return created;
}, 201);
