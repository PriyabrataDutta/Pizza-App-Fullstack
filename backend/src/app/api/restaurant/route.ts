import { NextResponse } from "next/server";
import { errorResponse } from "@/modules/catalog/http";
import { publicRestaurant } from "@/modules/settings/http";

// Whether the restaurant takes orders right now, and why not. The app shows this before the customer fills a cart.
export async function GET() {
  try {
    return NextResponse.json(await publicRestaurant(), { headers: { "Cache-Control": "public, max-age=10, s-maxage=10, stale-while-revalidate=10" } });
  } catch (error) {
    console.error("restaurant status failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
