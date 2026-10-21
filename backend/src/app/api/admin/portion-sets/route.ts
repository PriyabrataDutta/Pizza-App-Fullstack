import { adminRoute } from "@/modules/catalog/admin/http";
import { listPortionSets } from "@/modules/catalog/admin/service";

// The size templates ("Pizza sizes", "Drink sizes", ...) a category can offer. Readable with the categories module.
export const GET = adminRoute("categories", "view", async () => ({ items: await listPortionSets() }));
