import { ensureThumbnail } from "@/modules/catalog/thumbnails";
import { adminRoute, boolParam, intParam, readJson } from "@/modules/catalog/admin/http";
import { productCreate } from "@/modules/catalog/admin/schemas";
import { createProduct, listProducts } from "@/modules/catalog/admin/service";

// GET /api/admin/products?category=&search=&active=&offset=&limit=   (includes hidden products)
export const GET = adminRoute("menu", "view", async ({ req }) => {
  const q = req.nextUrl.searchParams;
  return listProducts({
    categoryId: q.get("category") ?? undefined,
    search: q.get("search")?.trim() || undefined,
    active: boolParam(q.get("active"), "active"),
    offset: intParam(q.get("offset"), "offset", 0, 100000),
    limit: intParam(q.get("limit"), "limit", 50, 200),
  });
});

export const POST = adminRoute("menu", "manage", async ({ actor, req }) => {
  const input = await readJson(req, productCreate);
  const created = await createProduct(actor, input);
  await ensureThumbnail(input.image_path);
  return created;
}, 201);
