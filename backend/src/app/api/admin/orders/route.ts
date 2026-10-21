import { adminRoute, intParam } from "@/modules/catalog/admin/http";
import { listOrders } from "@/modules/checkout/admin";

// GET /api/admin/orders?status=&offset=&limit=   Newest first. `status` may be one status or a comma-separated list.
export const GET = adminRoute("orders", "view", async ({ req }) => {
  const q = req.nextUrl.searchParams;
  return listOrders({
    statuses: q.get("status")?.split(",").map((s) => s.trim()).filter(Boolean),
    offset: intParam(q.get("offset"), "offset", 0, 100000),
    limit: intParam(q.get("limit"), "limit", 50, 200),
  });
});
