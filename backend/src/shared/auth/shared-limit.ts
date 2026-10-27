import "server-only";
import { allow } from "@/modules/checkout/rate-limit";
import { adminClient } from "@/shared/supabase/server";
import { createSharedLimiter } from "./shared-limit-core";

/** Rate limit shared by every server instance (see shared-limit-core). Use it for the endpoints worth abusing: sign-in, guest sign-up, checkout. */
export const allowShared = createSharedLimiter({
  hit: async (key, max, windowSeconds) => {
    const { data, error } = await adminClient().rpc("rate_limit_hit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    if (error) throw new Error(error.message);
    return data === true;
  },
  fallback: allow,
  onError: (error) => console.warn("shared rate limit unavailable, using the per-instance limit", error instanceof Error ? error.message : error),
});
