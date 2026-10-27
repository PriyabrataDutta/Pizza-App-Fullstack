// Customer-side smoke test of a deployed backend, using only the public API (no admin session is forged). It places a real cash order
// as a test guest and then deletes everything it created. Works before and after the launch-readiness migrations are applied and says
// which state it found.
// Usage (from backend/): BASE=https://pizza-app-fullstack-backend.vercel.app node --env-file=.env.local scripts/prod-smoke-check.mjs
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? (pass++, console.log("  ok   " + name)) : (fail++, console.log("  FAIL " + name + " " + extra)); };

async function call(method, path, { token, body } = {}) {
  const headers = { "content-type": "application/json", "x-app-version": "smoke" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json, headers: res.headers };
}

const customers = [];
try {
  // ---- public ----------------------------------------------------------------------------------------------------------------
  const robots = await fetch(BASE + "/robots.txt");
  ok("robots.txt disallows everything", robots.status === 200 && /Disallow:\s*\//.test(await robots.text()));
  const home = await call("GET", "/api/categories");
  ok("categories answer, with noindex", home.status === 200 && /noindex/.test(home.headers.get("x-robots-tag") ?? ""));
  const status = await call("GET", "/api/restaurant");
  ok("GET /api/restaurant says whether we are open", status.status === 200 && typeof status.json.open === "boolean", JSON.stringify(status.json).slice(0, 200));
  console.log("       restaurant:", JSON.stringify({ open: status.json?.open, reason: status.json?.closed_reason }));
  ok("the admin API still refuses an anonymous caller", (await call("GET", "/api/admin/settings")).status === 401);

  // ---- a guest places an order ----------------------------------------------------------------------------------------------
  const g = await call("POST", "/api/customers/guest");
  ok("a new guest gets a token", g.status === 201 && g.json.token?.startsWith("cc1_"), JSON.stringify(g.json));
  customers.push(g.json.customer_id);
  const T = g.json.token;
  ok("the new token works", (await call("GET", "/api/addresses", { token: T })).status === 200);
  ok("a wrong token is refused", (await call("GET", "/api/addresses", { token: "cc1_" + "x".repeat(43) })).status === 401);

  const migrated = !(await sb.from("customer_devices").select("id").limit(1)).error;
  console.log(`       database: ${migrated ? "launch-readiness migrations APPLIED" : "launch-readiness migrations NOT applied yet"}`);
  if (migrated) {
    const dev = await sb.from("customer_devices").select("id").eq("customer_id", g.json.customer_id);
    ok("the guest has a device row", dev.data?.length === 1);
  }

  const products = (await call("GET", "/api/products?limit=200")).json.items;
  const margherita = products.find((p) => p.name === "Margherita");
  const portion = margherita.portions.find((x) => x.available);
  const item = { product_id: margherita.id, portion_key: portion.key, option_ids: [], quantity: 3 };
  const addr = await call("POST", "/api/addresses", { token: T, body: { label: "Home", line1: "Hohe Straße 12", locality: "Wesel-Mitte", city: "Wesel", postal_code: "46483" } });
  ok("an address can be saved", addr.status === 201, JSON.stringify(addr.json));

  const quote = await call("POST", "/api/pricing/quote", { token: T, body: { items: [item], address_id: addr.json.id } });
  ok("a quote is priced by the server", quote.status === 200 && quote.json.subtotal_minor === portion.price_minor * 3, JSON.stringify(quote.json).slice(0, 200));
  ok("the quote says whether the restaurant is open", quote.json.restaurant === undefined || quote.json.restaurant.open === true);

  const key = `smoke-${Date.now()}`;
  const base = { idempotency_key: key, address_id: addr.json.id, items: [item] };
  ok("online (demo) payment is refused", (await call("POST", "/api/checkout", { token: T, body: { ...base, idempotency_key: key + "d", payment_method: "online_demo" } })).status === 400);
  ok("a bad phone number is refused", (await call("POST", "/api/checkout", { token: T, body: { ...base, idempotency_key: key + "p", payment_method: "cod", contact_name: "Max", contact_phone: "abc" } })).status === 400);

  const placed = await call("POST", "/api/checkout", { token: T, body: { ...base, payment_method: "cod", contact_name: "Max Muster", contact_phone: "+49 281 123456" } });
  ok("a cash order is placed", placed.status === 201 && placed.json.total_minor === quote.json.total_minor && placed.json.payment_status === "pending", JSON.stringify(placed.json).slice(0, 250));
  if (migrated) ok("the order carries the name and phone", placed.json.contact?.name === "Max Muster" && placed.json.contact?.phone === "+49 281 123456", JSON.stringify(placed.json.contact));
  else ok("the order is placed (contact details are not stored until the migration is applied)", placed.json.contact?.name === null || placed.json.contact === undefined);

  const again = await call("POST", "/api/checkout", { token: T, body: { ...base, payment_method: "cod", contact_name: "Max Muster", contact_phone: "+49 281 123456" } });
  ok("repeating the request returns the same order", again.status === 201 && again.json.id === placed.json.id);
  const read = await call("GET", `/api/orders/${placed.json.id}`, { token: T });
  ok("the guest can read the order back", read.status === 200 && read.json.number === placed.json.number);
  const other = await call("POST", "/api/customers/guest");
  customers.push(other.json.customer_id);
  ok("another guest cannot read it", (await call("GET", `/api/orders/${placed.json.id}`, { token: other.json.token })).status === 404);

  if (migrated) {
    const row = (await sb.from("orders").select("contact_name, contact_phone").eq("id", placed.json.id).single()).data;
    ok("the database holds the contact details", row.contact_name === "Max Muster" && row.contact_phone === "+49 281 123456");
    await sb.from("customers").update({ is_blocked: true }).eq("id", g.json.customer_id);
    const blocked = await call("POST", "/api/checkout", { token: T, body: { ...base, idempotency_key: key + "b", payment_method: "cod" } });
    ok("a blocked customer is refused", blocked.status === 403 && blocked.json.error.code === "CUSTOMER_BLOCKED", JSON.stringify(blocked.json));
    const replay = await call("POST", "/api/checkout", { token: T, body: { ...base, payment_method: "cod", contact_name: "Max Muster", contact_phone: "+49 281 123456" } });
    ok("...but its earlier order can still be returned", replay.status === 201 && replay.json.id === placed.json.id);
    await sb.from("customers").update({ is_blocked: false }).eq("id", g.json.customer_id);
  }
} finally {
  if (customers.length) {
    await sb.from("orders").delete().in("customer_id", customers);
    await sb.from("customers").delete().in("id", customers);
    const left = await sb.from("customers").select("id", { count: "exact", head: true }).in("id", customers);
    console.log(`       cleanup: ${left.count === 0 ? "test data removed" : "SOME TEST DATA REMAINS"}`);
  }
}
console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
