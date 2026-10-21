import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return v;
}

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

let admin: SupabaseClient | undefined;

/** Service-role client. Bypasses RLS. Server-only: never import from client components. */
export function adminClient(): SupabaseClient {
  return (admin ??= createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), opts));
}

/** Fresh publishable-key client, used only to check a password. Holds no session. */
export function anonClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), opts);
}
