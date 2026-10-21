import type { NextRequest } from "next/server";
import { cachedCatalogGet, catalog } from "@/modules/catalog/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One product, fully resolved: portions, and the extras and choices that apply with every price rule already applied.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return cachedCatalogGet(
    req,
    async () => (UUID.test(id) ? catalog.product(id) : null),
    { code: "PRODUCT_NOT_FOUND", message: "That item is not on the menu." },
  );
}
