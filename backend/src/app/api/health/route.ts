import { NextResponse } from "next/server";
import { adminClient } from "@/shared/supabase/server";

export const dynamic = "force-dynamic";

// For an uptime monitor: 200 when the server can reach its database, 503 when it cannot (or takes over 3 seconds). It returns no data and
// needs no login, so anyone may call it. Point a monitor at it and get a message the moment ordering would fail.
export async function GET() {
  const started = performance.now();
  const headers = { "Cache-Control": "no-store" };
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 3000); });
    try {
      const { error } = await Promise.race([adminClient().from("catalog_meta").select("version").eq("id", 1).single(), timeout]);
      if (error) throw new Error(error.message);
    } finally {
      clearTimeout(timer);
    }
    return NextResponse.json({ ok: true, database: "up", ms: Math.round(performance.now() - started) }, { headers });
  } catch {
    return NextResponse.json({ ok: false, database: "down" }, { status: 503, headers });
  }
}
