import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/modules/catalog/http";
import { checkout, clientIp, toErrorResponse } from "@/modules/checkout/http";
import { allow } from "@/modules/checkout/rate-limit";

// The first call a new app install makes. Returns a private device token, shown once: the app keeps it and sends it with every
// later request. The server stores only a hash of it.
export async function POST(req: NextRequest) {
  try {
    if (!allow(`guest:${clientIp(req)}`, 100, 60 * 60 * 1000)) return errorResponse(429, "RATE_LIMITED", "Too many new devices from this network. Try again later.");
    return NextResponse.json(await checkout.registerGuest(), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
