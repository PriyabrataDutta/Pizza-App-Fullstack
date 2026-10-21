import { adminRoute } from "@/modules/catalog/admin/http";
import { previewProduct } from "@/modules/catalog/admin/service";

// The product exactly as the app would receive it, even while hidden.
export const GET = adminRoute<{ id: string }>("menu", "view", async ({ params }) => previewProduct(params.id));
