// Live check of the customer and admin order API against the real project. Creates test guests and orders, then removes them.
// Usage (from backend/, dev server on :3000): node --env-file=.env.local scripts/checkout-live-check.mjs
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE ?? "http://localhost:3000";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET } = process.env;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: admin } = await sb.from("staff_users").select("id,email").eq("role", "super_admin").eq("status", "active").limit(1).single();
const payload = Buffer.from(JSON.stringify({ uid: admin.id, exp: Math.floor(Date.now() / 1000) + 900 })).toString("base64url");
const sessionCookie = `cc_session=${payload}.${createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url")}`;

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? (pass++, console.log("  ok   " + name)) : (fail++, console.log("  FAIL " + name + " " + extra)); };

async function call(method, path, { token, body, admin: asAdmin, headers = {} } = {}) {
  const h = { "content-type": "application/json" };
  if (token) h.authorization = `Bearer ${token}`;
  if (asAdmin) { h.cookie = sessionCookie; h.origin = BASE; }
  Object.assign(h, headers);
  const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { /* 204 */ }
  return { status: res.status, json };
}
const guestToken = async () => (await call("POST", "/api/customers/guest")).json;

const customers = [];
try {
  // ---- Identity ----------------------------------------------------------------------------------------------------------
  const g1 = await call("POST", "/api/customers/guest");
  ok("a new guest gets a token and an id", g1.status === 201 && g1.json.token.startsWith("cc1_") && !!g1.json.customer_id, JSON.stringify(g1.json).slice(0, 120));
  customers.push(g1.json.customer_id);
  const T1 = g1.json.token;
  const stored = (await sb.from("customers").select("token_hash").eq("id", g1.json.customer_id).single()).data;
  ok("only a hash of the token is stored", /^[0-9a-f]{64}$/.test(stored.token_hash) && !stored.token_hash.includes(T1.slice(4, 20)));
  ok("no token -> 401", (await call("GET", "/api/addresses")).status === 401);
  ok("a made-up token -> 401", (await call("GET", "/api/addresses", { token: "cc1_" + "x".repeat(43) })).status === 401);
  ok("a bad-looking token -> 401", (await call("GET", "/api/addresses", { token: "not-a-token" })).status === 401);

  // ---- Addresses --------------------------------------------------------------------------------------------------------------
  const a1 = await call("POST", "/api/addresses", { token: T1, body: { label: "Home", line1: "Hohe Straße 12", locality: "Wesel-Mitte", city: "Wesel", postal_code: "46483" } });
  ok("create an address; the first is the default", a1.status === 201 && a1.json.is_default === true && a1.json.one_line === "Hohe Straße 12, Wesel-Mitte, 46483 Wesel", JSON.stringify(a1.json));
  const bad = await call("POST", "/api/addresses", { token: T1, body: { label: "X", line1: "y", locality: "z", city: "Wesel", postal_code: "4648" } });
  ok("a 4-digit postcode -> 400 with a clear message", bad.status === 400 && bad.json.error.message.includes("5-digit"), JSON.stringify(bad.json));
  const a2 = await call("POST", "/api/addresses", { token: T1, body: { label: "Randbezirk", line1: "Dorfstraße 3", locality: "Flüren", city: "Wesel", postal_code: "46487" } });
  const a3 = await call("POST", "/api/addresses", { token: T1, body: { label: "Köln", line1: "Domplatz 1", locality: "Altstadt", city: "Köln", postal_code: "50667" } });
  ok("more addresses are not default", a2.json.is_default === false && a3.json.is_default === false);
  const patched = await call("PATCH", `/api/addresses/${a2.json.id}`, { token: T1, body: { instructions: "Hintertür" } });
  ok("PATCH changes only what was sent", patched.json.instructions === "Hintertür" && patched.json.line1 === "Dorfstraße 3");
  ok("an empty PATCH -> 400", (await call("PATCH", `/api/addresses/${a2.json.id}`, { token: T1, body: {} })).status === 400);
  const list = await call("GET", "/api/addresses", { token: T1 });
  ok("list addresses, default first", list.json.items.length === 3 && list.json.items[0].is_default === true);

  // ---- Products (public API) ----------------------------------------------------------------------------------------------------
  const find = async (name) => (await (await fetch(`${BASE}/api/products?search=${encodeURIComponent(name)}&limit=100`)).json()).items.find((p) => p.name === name);
  const salami = await find("Salami");
  const detail = await (await fetch(`${BASE}/api/products/${salami.id}`)).json();
  const champ = detail.groups[0].options.find((o) => o.name === "Champignons").id;
  const beer = await find("Margherita");
  const cola = await find("Softdrinks");
  const colaDetail = await (await fetch(`${BASE}/api/products/${cola.id}`)).json();
  const cocaCola = colaDetail.groups[0].options.find((o) => o.name === "Coca-Cola").id;
  const item = (over = {}) => ({ product_id: salami.id, portion_key: "gross", option_ids: [champ], quantity: 2, ...over });

  // ---- Quote ----------------------------------------------------------------------------------------------------------------------
  const q1 = await call("POST", "/api/pricing/quote", { token: T1, body: { items: [item()] } });
  ok("quote: Salami Groß 9,00 + Champignons 1,00, twice = 20,00 €", q1.status === 200 && q1.json.subtotal_minor === 2000 && q1.json.total_minor === 2000 && q1.json.lines[0].unit_price_minor === 1000, JSON.stringify(q1.json).slice(0, 300));
  const forged = await call("POST", "/api/pricing/quote", { token: T1, body: { items: [{ ...item(), price: 1, total_minor: 1, unit_price_minor: 1 }], total_minor: 1 } });
  ok("a price sent by the client is ignored", forged.status === 200 && forged.json.total_minor === 2000);
  const klein = await call("POST", "/api/pricing/quote", { token: T1, body: { items: [item({ portion_key: "klein", quantity: 1 })] } });
  ok("the extra's price follows the size (klein: 7,00 + 0,50)", klein.json.total_minor === 750, JSON.stringify(klein.json.lines));
  const c5 = await call("POST", "/api/pricing/quote", { token: T1, body: { items: [item()], coupon_code: "welcome5" } });
  ok("WELCOME5 takes 5 € off 20 € (code is case-insensitive)", c5.json.discount_minor === 500 && c5.json.total_minor === 1500 && c5.json.coupon_code === "WELCOME5");
  const small = await call("POST", "/api/pricing/quote", { token: T1, body: { items: [item({ quantity: 1 })], coupon_code: "WELCOME5" } });
  ok("a coupon under its minimum says how much more to add", small.status === 400 && small.json.error.code === "COUPON_MINIMUM" && small.json.error.message === "Add 10,00 € more to use WELCOME5.", JSON.stringify(small.json));
  ok("an expired coupon is refused", (await call("POST", "/api/pricing/quote", { token: T1, body: { items: [item()], coupon_code: "WINTER15" } })).json.error.code === "INVALID_OR_EXPIRED".replace("INVALID_OR_EXPIRED", "COUPON_INVALID"));
  ok("an unknown coupon is refused", (await call("POST", "/api/pricing/quote", { token: T1, body: { items: [item()], coupon_code: "NOPE" } })).json.error.code === "COUPON_INVALID");
  ok("an unknown product -> ITEM_UNAVAILABLE", (await call("POST", "/api/pricing/quote", { token: T1, body: { items: [item({ product_id: "00000000-0000-4000-8000-000000000000" })] } })).json.error.code === "ITEM_UNAVAILABLE");
  // The seed has no pickup-only item, so one is switched for a moment and put back.
  await sb.from("products").update({ fulfillment: "pickup_only" }).eq("id", beer.id);
  await call("GET", "/api/menu/version"); await new Promise((r) => setTimeout(r, 3500)); // the server re-reads the menu within 3 s of an edit
  const pickup = await call("POST", "/api/pricing/quote", { token: T1, body: { items: [{ product_id: beer.id, portion_key: "gross", option_ids: [], quantity: 1 }] } });
  await sb.from("products").update({ fulfillment: "delivery_and_pickup" }).eq("id", beer.id);
  ok("a pickup-only item cannot be ordered for delivery", pickup.status === 400 && pickup.json.error.message.includes("only available for pickup"), JSON.stringify(pickup.json));
  ok("a required choice must be made (Softdrinks need a brand)", (await call("POST", "/api/pricing/quote", { token: T1, body: { items: [{ product_id: cola.id, portion_key: "0_33l", option_ids: [], quantity: 1 }] } })).status === 400);
  ok("an empty cart is refused", (await call("POST", "/api/pricing/quote", { token: T1, body: { items: [] } })).status === 400);
  const near = await call("POST", "/api/pricing/quote", { token: T1, body: { items: [item({ quantity: 1 })], address_id: a1.json.id } });
  ok("with a saved address the quote knows the minimum and estimate", near.json.delivery.minimum_order_minor === 1000 && near.json.delivery.meets_minimum === true && near.json.delivery.estimated_minutes === 35, JSON.stringify(near.json.delivery));
  ok("a postcode we do not serve -> 422 NOT_DELIVERED", (await call("POST", "/api/pricing/quote", { token: T1, body: { items: [item()], address_id: a3.json.id } })).status === 422);

  // ---- Checkout ---------------------------------------------------------------------------------------------------------------------
  const key = () => "live-" + Math.random().toString(36).slice(2, 12);
  const k1 = key();
  const order = await call("POST", "/api/checkout", { token: T1, body: { idempotency_key: k1, address_id: a1.json.id, payment_method: "cod", items: [item()], instructions: "Ring twice" } });
  ok("checkout places an order", order.status === 201 && /^CC-\d+$/.test(order.json.number) && order.json.status === "placed" && order.json.total_minor === 2000, JSON.stringify(order.json).slice(0, 300));
  ok("it carries the snapshot: lines, options, address, cash pending", order.json.lines[0].name === "Salami" && order.json.lines[0].options[0] === "Champignons" && order.json.delivery.instructions === "Ring twice" && order.json.payment_status === "pending" && order.json.history[0].status === "placed", JSON.stringify(order.json.lines));
  const replay = await call("POST", "/api/checkout", { token: T1, body: { idempotency_key: k1, address_id: a1.json.id, payment_method: "cod", items: [item()] } });
  ok("repeating the request returns the same order", replay.status === 201 && replay.json.id === order.json.id);
  const conflict = await call("POST", "/api/checkout", { token: T1, body: { idempotency_key: k1, address_id: a1.json.id, payment_method: "cod", items: [item({ quantity: 5 })] } });
  ok("the same key for a different cart -> 409 IDEMPOTENCY_CONFLICT", conflict.status === 409 && conflict.json.error.code === "IDEMPOTENCY_CONFLICT");
  ok("only one order exists", (await sb.from("orders").select("id").eq("customer_id", g1.json.customer_id)).data.length === 1);

  const tooSmall = await call("POST", "/api/checkout", { token: T1, body: { idempotency_key: key(), address_id: a2.json.id, payment_method: "cod", items: [item({ quantity: 1 })] } });
  ok("below the outer districts' 20 € minimum -> 400 with the amount short", tooSmall.status === 400 && tooSmall.json.error.code === "MINIMUM_ORDER" && tooSmall.json.error.details[0].short_by_minor === 1000, JSON.stringify(tooSmall.json));
  const outerOk = await call("POST", "/api/checkout", { token: T1, body: { idempotency_key: key(), address_id: a2.json.id, payment_method: "online_demo", coupon_code: "WELCOME5", items: [item()] } });
  ok("20 € to an outer district works, with a coupon and the demo payment", outerOk.status === 201 && outerOk.json.estimated_minutes === 45 && outerOk.json.discount_minor === 500 && outerOk.json.total_minor === 1500 && outerOk.json.payment_status === "demo_paid", JSON.stringify(outerOk.json).slice(0, 300));
  ok("outside the areas -> 422", (await call("POST", "/api/checkout", { token: T1, body: { idempotency_key: key(), address_id: a3.json.id, payment_method: "cod", items: [item()] } })).status === 422);
  ok("a missing idempotency key -> 400", (await call("POST", "/api/checkout", { token: T1, body: { address_id: a1.json.id, payment_method: "cod", items: [item()] } })).status === 400);
  ok("an unknown payment method -> 400", (await call("POST", "/api/checkout", { token: T1, body: { idempotency_key: key(), address_id: a1.json.id, payment_method: "bitcoin", items: [item()] } })).status === 400);
  const drink = await call("POST", "/api/checkout", { token: T1, body: { idempotency_key: key(), address_id: a1.json.id, payment_method: "cod", items: [{ product_id: cola.id, portion_key: "1_0l", option_ids: [cocaCola], quantity: 4 }] } });
  ok("a choice-only item prices correctly (4 x 1 l Cola = 10,00 €)", drink.status === 201 && drink.json.total_minor === 1000, JSON.stringify(drink.json).slice(0, 200));

  // ---- Reading orders; another guest sees nothing -----------------------------------------------------------------------------------
  const mine = await call("GET", "/api/orders", { token: T1 });
  ok("my orders are listed, newest first", mine.json.items.length === 3 && mine.json.items[0].created_at >= mine.json.items[2].created_at);
  const g2 = await call("POST", "/api/customers/guest");
  customers.push(g2.json.customer_id);
  const T2 = g2.json.token;
  ok("another guest sees no orders", (await call("GET", "/api/orders", { token: T2 })).json.items.length === 0);
  ok("...cannot open mine -> 404", (await call("GET", `/api/orders/${order.json.id}`, { token: T2 })).status === 404);
  ok("...cannot use my address -> 404", (await call("POST", "/api/checkout", { token: T2, body: { idempotency_key: key(), address_id: a1.json.id, payment_method: "cod", items: [item()] } })).status === 404);
  ok("...cannot change or delete my address -> 404", (await call("PATCH", `/api/addresses/${a1.json.id}`, { token: T2, body: { label: "x" } })).status === 404 && (await call("DELETE", `/api/addresses/${a1.json.id}`, { token: T2 })).status === 404);
  ok("a non-UUID order id -> 404", (await call("GET", "/api/orders/abc", { token: T1 })).status === 404);
  const detailRead = await call("GET", `/api/orders/${order.json.id}`, { token: T1 });
  ok("I can open my own order", detailRead.status === 200 && detailRead.json.number === order.json.number);
  const delAddr = await call("DELETE", `/api/addresses/${a1.json.id}`, { token: T1 });
  const afterDel = await call("GET", "/api/addresses", { token: T1 });
  ok("deleting the default address promotes another; old orders keep the address", delAddr.status === 204 && afterDel.json.items.filter((a) => a.is_default).length === 1 && (await call("GET", `/api/orders/${order.json.id}`, { token: T1 })).json.delivery.line1 === "Hohe Straße 12");

  // ---- The restaurant side ---------------------------------------------------------------------------------------------------------------
  ok("admin orders need a dashboard session -> 401", (await call("GET", "/api/admin/orders")).status === 401);
  ok("a customer token does not open the admin API", (await call("GET", "/api/admin/orders", { token: T1 })).status === 401);
  const adminList = await call("GET", `/api/admin/orders?status=placed&limit=10`, { admin: true });
  ok("the dashboard lists new orders", adminList.status === 200 && adminList.json.items.some((o) => o.id === order.json.id), JSON.stringify(adminList.json).slice(0, 150));
  const step = async (to, reason) => call("PATCH", `/api/admin/orders/${order.json.id}/status`, { admin: true, body: { status: to, reason } });
  const skip = await step("delivered");
  ok("skipping a step -> 409 INVALID_TRANSITION", skip.status === 409 && skip.json.error.code === "INVALID_TRANSITION", JSON.stringify(skip.json));
  for (const s of ["accepted", "preparing", "ready_for_dispatch", "out_for_delivery"]) ok(`order moves to ${s}`, (await step(s)).json.status === s);
  const seen = await call("GET", `/api/orders/${order.json.id}`, { token: T1 });
  ok("the customer sees the new status", seen.json.status === "out_for_delivery");
  const done = await step("delivered");
  ok("delivered, and the cash is marked paid", done.json.status === "delivered" && done.json.payment_status === "paid");
  ok("history lists every step in order", done.json.history.map((h) => h.status).join(">") === "placed>accepted>preparing>ready_for_dispatch>out_for_delivery>delivered", done.json.history.map((h) => h.status).join(">"));
  ok("a delivered order cannot change -> 409", (await step("cancelled")).status === 409);
  const rejectedOrder = outerOk.json.id;
  const rej = await call("PATCH", `/api/admin/orders/${rejectedOrder}/status`, { admin: true, body: { status: "rejected", reason: "kitchen closed" } });
  ok("an order can be rejected with a reason", rej.json.status === "rejected" && rej.json.history.at(-1).reason === "kitchen closed");
  ok("a status the lifecycle does not know -> 400", (await call("PATCH", `/api/admin/orders/${rejectedOrder}/status`, { admin: true, body: { status: "teleporting" } })).status === 400);
  ok("an unknown order -> 404", (await call("PATCH", `/api/admin/orders/00000000-0000-4000-8000-000000000000/status`, { admin: true, body: { status: "accepted" } })).status === 404);
  ok("a cross-site status change is refused", (await call("PATCH", `/api/admin/orders/${order.json.id}/status`, { admin: true, body: { status: "accepted" }, headers: { origin: "https://evil.example" } })).status === 403);
  const audit = (await sb.from("audit_log").select("action").eq("action", "order_status_changed").order("created_at", { ascending: false }).limit(1)).data;
  ok("status changes are in the audit log", audit.length === 1);
} finally {
  // Remove every test order, address and guest.
  for (const id of customers) {
    await sb.from("orders").delete().eq("customer_id", id);
    await sb.from("customers").delete().eq("id", id);
  }
  const left = await sb.from("customers").select("id", { count: "exact", head: true });
  const orders = await sb.from("orders").select("id", { count: "exact", head: true });
  console.log(`\ncleanup: ${left.count} customers and ${orders.count} orders left in the database`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
