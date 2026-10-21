import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { categoryUpdate } from "@/modules/catalog/admin/schemas";
import { deleteCategory, updateCategory } from "@/modules/catalog/admin/service";

type P = { id: string };

export const PATCH = adminRoute<P>("categories", "manage", async ({ actor, req, params }) => updateCategory(actor, params.id, await readJson(req, categoryUpdate)));

// Only an empty category can be deleted; otherwise hide it (PATCH is_active=false).
export const DELETE = adminRoute<P>("categories", "manage", async ({ actor, params }) => deleteCategory(actor, params.id), 204);
