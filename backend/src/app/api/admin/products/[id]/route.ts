import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { productUpdate } from "@/modules/catalog/admin/schemas";
import { getProductForEditing, updateProduct } from "@/modules/catalog/admin/service";

type P = { id: string };

// Products are hidden (PATCH is_active=false), never deleted: old orders keep referring to them.
export const GET = adminRoute<P>("menu", "view", async ({ params }) => getProductForEditing(params.id));

export const PATCH = adminRoute<P>("menu", "manage", async ({ actor, req, params }) => updateProduct(actor, params.id, await readJson(req, productUpdate)));
