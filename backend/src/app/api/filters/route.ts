import type { NextRequest } from "next/server";
import { cachedCatalogGet, catalog } from "@/modules/catalog/http";

export async function GET(req: NextRequest) {
  return cachedCatalogGet(req, () => catalog.filters());
}
