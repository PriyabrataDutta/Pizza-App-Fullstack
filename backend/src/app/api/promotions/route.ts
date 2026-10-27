import { NextResponse } from "next/server";
import { errorResponse } from "@/modules/catalog/http";
import { publicPromotions } from "@/modules/promotions/service";

// The offer banners on the app's Home screen: switched on, started and not ended, in the restaurant's order. Anonymous and cacheable:
// a change in the dashboard reaches phones within about a minute.
export async function GET() {
  try {
    return NextResponse.json(await publicPromotions(), { headers: { "Cache-Control": "public, max-age=30, s-maxage=20, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("promotions failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
