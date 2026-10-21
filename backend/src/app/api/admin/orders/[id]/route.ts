import { adminRoute } from "@/modules/catalog/admin/http";
import { getOrder } from "@/modules/checkout/admin";

export const GET = adminRoute<{ id: string }>("orders", "view", async ({ params }) => getOrder(params.id));
