import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseCatalogRepository } from "./repository";
import { createCatalogService, ValidationError } from "./service";

// Shared plumbing for the public catalog routes: the service wired to Supabase, the error envelope from docs/api-contract.md,
// and caching. Reads are cacheable because the catalog carries a version that changes on every edit:
// the ETag is derived from that version plus the request URL, so an unchanged menu answers 304 after one cheap query.

function imageUrl(path: string | null): string | null {
  const base = process.env.SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/product-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export const catalog = createCatalogService(supabaseCatalogRepository, imageUrl);

export function errorResponse(status: number, code: string, message: string, details: unknown[] = []) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/** Wraps a GET handler: 304 when the client's copy is current, ETag and Cache-Control otherwise, and the standard error envelope. */
export async function cachedCatalogGet(req: NextRequest, build: () => Promise<unknown | null>, notFound?: { code: string; message: string }) {
  try {
    const version = await catalog.version();
    const etag = `W/"${version}-${createHash("sha1").update(req.nextUrl.pathname + req.nextUrl.search).digest("hex").slice(0, 16)}"`;
    const headers = {
      ETag: etag,
      "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
      "X-Catalog-Version": String(version),
    };
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });

    const body = await build();
    if (body === null) {
      return errorResponse(404, notFound?.code ?? "NOT_FOUND", notFound?.message ?? "Not found.");
    }
    return NextResponse.json(body, { headers });
  } catch (error) {
    if (error instanceof ValidationError) return errorResponse(400, "VALIDATION_ERROR", error.message);
    console.error("catalog request failed", error); // never expose internals to the client
    return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
