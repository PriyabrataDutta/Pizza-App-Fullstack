import { adminRoute } from "@/modules/catalog/admin/http";
import { duplicateProduct } from "@/modules/catalog/admin/service";

// The copy starts hidden.
export const POST = adminRoute<{ id: string }>("menu", "manage", async ({ actor, params }) => duplicateProduct(actor, params.id), 201);
