// Where does the time go on a deployed backend? Calls the customer endpoints several times as a throwaway guest and prints, for each,
// the time the server says it spent (Server-Timing) next to the time the caller waited. The difference is the network.
// A guest and one saved address are created and removed again. No admin session is used.
// Usage (from backend/): BASE=https://pizza-app-fullstack-backend.vercel.app node --env-file=.env.local scripts/latency-check.mjs
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function call(method, path, { token, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const t0 = performance.now();
  // A dropped keep-alive connection is retried once; it says nothing about the server.
  const send = () => fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await send().catch(() => send());
  const json = await res.json().catch(() => null);
  const waited = Math.round(performance.now() - t0);
  const server = Number(/app;dur=(\d+)/.exec(res.headers.get("server-timing") ?? "")?.[1] ?? NaN);
  return { status: res.status, json, waited, server, region: /::(\w+)::/.exec(res.headers.get("x-vercel-id") ?? "")?.[1] };
}
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const line = (name, rs) => console.log(`  ${name.padEnd(26)} waited ${String(med(rs.map((r) => r.waited))).padStart(4)} ms   server ${Number.isNaN(med(rs.map((r) => r.server))) ? "   -" : String(med(rs.map((r) => r.server))).padStart(4)} ms   (${rs.length} calls, ${rs[0].region ?? "?"})`);

let customer;
try {
  const g = await call("POST", "/api/customers/guest");
  customer = g.json.customer_id;
  const T = g.json.token;
  console.log(`guest sign-up              waited ${g.waited} ms (first call, may include a cold start)`);
  const addr = await call("POST", "/api/addresses", { token: T, body: { label: "Home", line1: "Hohe Straße 12", locality: "Wesel-Mitte", city: "Wesel", postal_code: "46483" } });

  const products = (await call("GET", "/api/products?limit=200")).json.items;
  const m = products.find((p) => p.name === "Margherita");
  const item = { product_id: m.id, portion_key: m.portions.find((x) => x.available).key, option_ids: [], quantity: 2 };

  const N = 7;
  const run = async (fn) => { const out = []; for (let i = 0; i < N; i++) out.push(await fn(i)); return out; };
  console.log("\nmedian of", N, "calls each:");
  line("GET /api/addresses", await run(() => call("GET", "/api/addresses", { token: T })));
  line("GET /api/orders", await run(() => call("GET", "/api/orders", { token: T })));
  line("POST /api/pricing/quote", await run(() => call("POST", "/api/pricing/quote", { token: T, body: { items: [item], address_id: addr.json.id } })));
  const orders = await run((i) => call("POST", "/api/checkout", { token: T, body: { idempotency_key: `latency-${Date.now()}-${i}`, address_id: addr.json.id, payment_method: "cod", items: [item] } }));
  line("POST /api/checkout (cash)", orders);
  console.log(`  checkout statuses: ${orders.map((o) => o.status).join(" ")}`);
} finally {
  if (customer) {
    await sb.from("orders").delete().eq("customer_id", customer);
    await sb.from("customers").delete().eq("id", customer);
    console.log("\ncleanup: test data removed");
  }
}
