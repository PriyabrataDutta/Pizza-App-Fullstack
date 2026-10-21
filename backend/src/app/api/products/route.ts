import type { NextRequest } from "next/server";
import { cachedCatalogGet, catalog } from "@/modules/catalog/http";
import { ValidationError } from "@/modules/catalog/service";

function flag(value: string | null, name: string): boolean | undefined {
  if (value === null || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ValidationError(`${name} must be true or false.`);
}

function whole(value: string | null, name: string): number | undefined {
  if (value === null || value === "") return undefined;
  if (!/^\d{1,4}$/.test(value)) throw new ValidationError(`${name} must be a whole number.`);
  return Number(value);
}

// GET /api/products?category=&search=&tag=&diet=&spicy=&bestseller=&cursor=&limit=
export async function GET(req: NextRequest) {
  return cachedCatalogGet(req, () => {
    const q = req.nextUrl.searchParams;
    return catalog.products({
      category: q.get("category") ?? undefined,
      search: q.get("search") ?? undefined,
      tag: q.get("tag") ?? undefined,
      diet: q.get("diet") ?? undefined,
      spicy: flag(q.get("spicy"), "spicy"),
      bestseller: flag(q.get("bestseller"), "bestseller"),
      cursor: q.get("cursor") ?? undefined,
      limit: whole(q.get("limit"), "limit"),
    });
  });
}
