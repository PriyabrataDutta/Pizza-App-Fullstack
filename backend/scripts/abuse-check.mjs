// Tries to abuse the customer API on the live project (dev server on :3000) and checks that it holds up. Removes everything it creates.
// Usage (from backend/): node --env-file=.env.local scripts/abuse-check.mjs
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? (pass++, console.log("  ok   " + name)) : (fail++, console.log("  FAIL " + name + " " + extra)); };
const call = async (method, path, { token, body, headers = {}, raw } = {}) => {
  const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  let json = null; try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, json, headers: res.headers };
};
const pool = async (n, concurrency, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: concurrency }, async () => { for (; i < n; ) { const k = i++; out[k] = await fn(k); } })); return out; };

const startCustomers = (await sb.from("customers").select("id", { count: "exact", head: true })).count;
try {
  // ---- headers -----------------------------------------------------------------------------------------------------------------
  const h1 = await call("GET", "/api/menu/version");
  ok("API responses forbid sniffing and framing", h1.headers.get("x-content-type-options") === "nosniff" && h1.headers.get("x-frame-options") === "DENY" && (h1.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"));
  ok("and send a referrer policy and a permissions policy", !!h1.headers.get("referrer-policy") && !!h1.headers.get("permissions-policy"));
  const login = await fetch(BASE + "/login");
  ok("the login page cannot be framed by another site", login.headers.get("x-frame-options") === "DENY");

  // ---- bad input ------------------------------------------------------------------------------------------------------------------
  const g = await call("POST", "/api/customers/guest");
  const T = g.json.token;
  const big = "x".repeat(100 * 1024);
  const tooBig = await call("POST", "/api/pricing/quote", { token: T, raw: JSON.stringify({ items: [], note: big }) });
  ok("a 100 KB body is refused with 413", tooBig.status === 413 && tooBig.json.error.code === "PAYLOAD_TOO_LARGE", JSON.stringify([tooBig.status, tooBig.json]));
  const bad = await call("POST", "/api/pricing/quote", { token: T, raw: "{not json" });
  ok("malformed JSON is a clean 400", bad.status === 400 && bad.json.error.code === "VALIDATION_ERROR");
  const empty = await call("POST", "/api/pricing/quote", { token: T, raw: "" });
  ok("an empty body is a clean 400", empty.status === 400);
  const arr = await call("POST", "/api/pricing/quote", { token: T, raw: "[1,2,3]" });
  ok("a body of the wrong shape is a clean 400", arr.status === 400);
  const many = await call("POST", "/api/pricing/quote", { token: T, body: { items: Array.from({ length: 51 }, () => ({ product_id: "00000000-0000-4000-8000-000000000000", portion_key: "gross", option_ids: [], quantity: 1 })) } });
  ok("more than 50 lines is refused", many.status === 400);
  const qty = await call("POST", "/api/pricing/quote", { token: T, body: { items: [{ product_id: "00000000-0000-4000-8000-000000000000", portion_key: "gross", option_ids: [], quantity: 100000 }] } });
  ok("an absurd quantity is refused", qty.status === 400);
  const sql = await call("GET", "/api/orders/' or 1=1 --", { token: T });
  ok("an injection-looking order id is just not found", sql.status === 404);
  const search = await call("GET", "/api/products?search=" + encodeURIComponent("%'),name.ilike.%(x"));
  ok("a search with filter syntax does not break the query", search.status === 200);
  const noAuthHeader = await call("GET", "/api/orders", { headers: { authorization: "Basic abc" } });
  ok("a wrong kind of Authorization header is a 401", noAuthHeader.status === 401);

  // ---- guest sign-up flood ----------------------------------------------------------------------------------------------------------
  const made = await pool(105, 12, () => call("POST", "/api/customers/guest"));
  const created = made.filter((r) => r.status === 201).length;
  const blocked = made.filter((r) => r.status === 429).length;
  ok(`guest sign-up is capped (${created} created, ${blocked} refused with 429)`, blocked >= 1 && created <= 100, "");

  // ---- token guessing flood -----------------------------------------------------------------------------------------------------------
  const t0 = Date.now();
  const guesses = await pool(700, 40, (k) => call("GET", "/api/addresses", { token: "cc1_" + String(k).padStart(43, "g") }));
  const s401 = guesses.filter((r) => r.status === 401).length, s429 = guesses.filter((r) => r.status === 429).length;
  ok(`a flood of wrong tokens is cut off (${s401} x 401, then ${s429} x 429, ${Math.round((Date.now() - t0) / 1000)} s)`, s429 > 0 && guesses.every((r) => r.status === 401 || r.status === 429));
} finally {
  const { data: all } = await sb.from("customers").select("id");
  for (const c of all ?? []) { await sb.from("orders").delete().eq("customer_id", c.id); await sb.from("customers").delete().eq("id", c.id); }
  const left = (await sb.from("customers").select("id", { count: "exact", head: true })).count;
  console.log(`\ncleanup: customers ${startCustomers} before, ${left} after`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
