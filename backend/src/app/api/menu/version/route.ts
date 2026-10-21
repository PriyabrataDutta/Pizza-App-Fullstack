import { catalog, errorResponse } from "@/modules/catalog/http";

// The app asks this first and refetches the menu only when the number changed. Never cached, so it is always current.
export async function GET() {
  try {
    return Response.json({ version: await catalog.version() }, { headers: { "Cache-Control": "no-cache" } });
  } catch (error) {
    console.error("catalog version failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
