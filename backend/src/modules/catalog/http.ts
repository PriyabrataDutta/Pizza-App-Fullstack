import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseCatalogSource } from "./repository";
import { createSnapshotRepository } from "./snapshot";
import { createCatalogService, ValidationError } from "./service";

// Shared plumbing for the public catalog routes: the service wired to Supabase, the error envelope from docs/api-contract.md,
// and caching. Reads are cacheable because the catalog carries a version that changes on every edit:
// the ETag is derived from that version plus the request URL, so an unchanged menu answers 304 after one cheap query.

function imageUrl(path: string | null): string | null {
  const base = process.env.SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/product-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// Every read is answered from one in-memory copy of the menu (snapshot.ts); the database is asked only when the catalog version changes.
export const catalogSnapshot = createSnapshotRepository(supabaseCatalogSource);
export const catalog = createCatalogService(catalogSnapshot, imageUrl);

export function errorResponse(status: number, code: string, message: string, details: unknown[] = []) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

// Built responses are kept per URL for as long as the catalog version is unchanged, so a repeat request costs one small version
// query instead of six. The version is read before the body is built, so a body is never stored under a version newer than it.
const MEMO_MAX = 300;
const memo = new Map<string, { version: number; body: unknown }>();

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

    const key = req.nextUrl.pathname + req.nextUrl.search;
    const hit = memo.get(key);
    let body: unknown | null;
    if (hit && hit.version === version) {
      body = hit.body;
    } else {
      body = await build();
      if (body !== null) {
        if (memo.size >= MEMO_MAX) memo.clear();
        memo.set(key, { version, body });
      }
    }
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
