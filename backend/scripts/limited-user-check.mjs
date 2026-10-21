// Checks what staff with limited access can and cannot do with orders, through the API and in the real dashboard (headless Chrome).
// Creates three temporary staff accounts and one test order, and removes them all at the end.
// Usage (from backend/, dev server on :3000): node --env-file=.env.local scripts/limited-user-check.mjs
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET } = process.env;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? (pass++, console.log("  ok   " + name)) : (fail++, console.log("  FAIL " + name + " " + extra)); };
const sessionFor = (uid) => { const p = Buffer.from(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + 1800 })).toString("base64url"); return `${p}.${createHmac("sha256", SESSION_SECRET).update(p).digest("base64url")}`; };

const authIds = [];
let customerId = null;
async function makeStaff(label, grants) {
  const email = `zz-${label}-${randomBytes(3).toString("hex")}@crustandco.test`;
  const { data, error } = await sb.auth.admin.createUser({ email, password: randomBytes(18).toString("base64url"), email_confirm: true });
  if (error) throw new Error("createUser: " + error.message);
  authIds.push(data.user.id);
  const ins = await sb.from("staff_users").insert({ id: data.user.id, full_name: "ZZ " + label, email, role: "staff", status: "active", must_change_password: false });
  if (ins.error) throw new Error("staff_users: " + ins.error.message);
  if (grants.length) await sb.from("user_modules").insert(grants.map(([module, access]) => ({ user_id: data.user.id, module, access })));
  return data.user.id;
}
const api = async (uid, method, path, body) => {
  const res = await fetch(BASE + "/api/admin" + path, { method, headers: { "content-type": "application/json", cookie: "cc_session=" + sessionFor(uid), origin: BASE }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, json };
};

const profile = mkdtempSync(join(tmpdir(), "chrome-lim-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=9339", `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });
let ws;
try {
  const viewer = await makeStaff("viewer", [["orders", "view"]]);
  const blind = await makeStaff("blind", [["menu", "view"]]);
  const manager = await makeStaff("manager", [["orders", "manage"], ["overview", "view"]]);

  // one test order
  const post = async (path, token, body) => (await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
  const g = await post("/api/customers/guest"); customerId = g.customer_id;
  const addr = await post("/api/addresses", g.token, { label: "Home", line1: "Hohe Straße 12", locality: "Wesel-Mitte", city: "Wesel", postal_code: "46483" });
  const salami = (await (await fetch(`${BASE}/api/products?search=Salami&limit=20`)).json()).items.find((p) => p.name === "Salami");
  const order = await post("/api/checkout", g.token, { idempotency_key: "lim-" + randomBytes(5).toString("hex"), address_id: addr.id, payment_method: "cod", items: [{ product_id: salami.id, portion_key: "gross", option_ids: [], quantity: 2 }] });
  ok("test order " + order.number + " placed", /^CC-/.test(order.number));

  // ---- API ------------------------------------------------------------------------------------------------------------------------
  console.log("API");
  ok("view-only: can read orders", (await api(viewer, "GET", "/orders")).status === 200);
  const patchV = await api(viewer, "PATCH", `/orders/${order.id}/status`, { status: "accepted" });
  ok("view-only: cannot change an order (403)", patchV.status === 403, JSON.stringify(patchV));
  ok("   ...and the order is unchanged", (await sb.from("orders").select("status").eq("id", order.id).single()).data.status === "placed");
  ok("view-only: cannot read the menu admin API (403)", (await api(viewer, "GET", "/categories")).status === 403);
  ok("no orders access: cannot read orders (403)", (await api(blind, "GET", "/orders")).status === 403);
  ok("no orders access: cannot read one order (403)", (await api(blind, "GET", `/orders/${order.id}`)).status === 403);
  ok("no orders access: cannot change an order (403)", (await api(blind, "PATCH", `/orders/${order.id}/status`, { status: "accepted" })).status === 403);
  ok("no orders access: cannot manage users (403)", (await api(blind, "GET", "/categories")).status === 403);
  ok("manager: can accept the order", (await api(manager, "PATCH", `/orders/${order.id}/status`, { status: "accepted" })).status === 200);
  ok("manager: still cannot touch the menu (403)", (await api(manager, "GET", "/categories")).status === 403);
  const inactive = await makeStaff("inactive", [["orders", "manage"]]);
  await sb.from("staff_users").update({ status: "inactive" }).eq("id", inactive);
  ok("a deactivated user is refused at once (401/403)", [401, 403].includes((await api(inactive, "GET", "/orders")).status));
  ok("a session for a user that does not exist is refused", [401, 403].includes((await api("00000000-0000-4000-8000-000000000000", "GET", "/orders")).status));

  // ---- Browser --------------------------------------------------------------------------------------------------------------------
  console.log("Dashboard");
  let url;
  for (let i = 0; i < 40 && !url; i++) { try { url = (await (await fetch("http://127.0.0.1:9339/json/list")).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* starting */ } await sleep(500); }
  ws = new WebSocket(url);
  await new Promise((r) => (ws.onopen = r));
  let id = 1; const pend = new Map(); let orderCalls = 0; const logs = [];
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pend.has(msg.id)) { pend.get(msg.id)(msg.result); pend.delete(msg.id); } if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) logs.push(msg.params.type + ": " + msg.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300)); if (msg.method === "Runtime.exceptionThrown") logs.push("EXC " + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0, 400)); if (msg.method === "Network.responseReceived" && msg.params.response.url.includes("/api/admin/orders")) logs.push("HTTP " + msg.params.response.status + " " + msg.params.response.url); if (msg.method === "Network.requestWillBeSent" && msg.params.request.url.includes("/api/admin/orders")) orderCalls++; };
  const send = (method, params = {}) => new Promise((resolve) => { const i = id++; pend.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
  const waitFor = async (expr, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(300); } return false; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  const as = async (uid) => { await send("Page.navigate", { url: "about:blank" }); await sleep(1500); await send("Network.clearBrowserCookies"); await send("Network.setCookie", { name: "cc_session", value: sessionFor(uid), url: BASE, httpOnly: true, sameSite: "Lax" }); orderCalls = 0; };

  // a second order, still "placed", for the view-only checks
  const g2 = await post("/api/customers/guest"); const addr2 = await post("/api/addresses", g2.token, { label: "Home", line1: "Dorfstraße 3", locality: "Flüren", city: "Wesel", postal_code: "46487" });
  const order2 = await post("/api/checkout", g2.token, { idempotency_key: "lim-" + randomBytes(5).toString("hex"), address_id: addr2.id, payment_method: "cod", items: [{ product_id: salami.id, portion_key: "gross", option_ids: [], quantity: 3 }] });
  const customer2 = g2.customer_id;
  ok("second test order " + order2.number + " placed", /^CC-/.test(order2.number), JSON.stringify(order2).slice(0, 160));

  await as(viewer);
  await send("Page.navigate", { url: BASE + "/orders" });
  const seen = await waitFor(`document.body.innerText.includes(${JSON.stringify(order2.number)})`, 90000);
  ok("view-only: sees the order on the board", seen);
  if (!seen) { const shot = await send("Page.captureScreenshot", { format: "png" }); (await import("node:fs")).writeFileSync(process.env.SHOT ?? "viewer-fail.png", Buffer.from(shot.data, "base64")); }
  if (!seen) console.log("     console/network:", JSON.stringify(logs.slice(0, 8)), "orderCalls:", orderCalls, "resources:", JSON.stringify(await js(`performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/admin/orders')).map(e=>[Math.round(e.startTime),Math.round(e.duration),e.responseStatus])`)));
  if (!seen) console.log("     page text:", (await js(`document.body.innerText.replace(/\s+/g,' ').slice(0,700)`)));
  ok("view-only: sees the view-only notice", await js(`document.body.innerText.includes('view-only access')`));
  ok("view-only: has no action buttons on the tickets", await js(`![...document.querySelectorAll('li.ticket-wrap button')].some(b=>/Accept|Start preparing|Mark ready|Send out|Mark delivered/.test(b.innerText))`));
  await js(`[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.includes(${JSON.stringify(order2.number)}))?.click()`);
  await waitFor(`document.body.innerText.includes('Status history')`, 6000);
  ok("view-only: the drawer shows the order but no Accept / Reject / Cancel", await js(`document.body.innerText.includes('Status history') && ![...document.querySelectorAll('button')].some(b=>/^(Accept order|Reject|Cancel order|Start preparing)$/.test(b.innerText.trim()))`));

  await as(blind);
  await send("Page.navigate", { url: BASE + "/orders" });
  await sleep(6000);
  const where = await js(`location.pathname + ' | ' + document.body.innerText.slice(0, 200).replace(/\\s+/g, ' ')`);
  ok("no orders access: the Orders page is not shown (" + where.slice(0, 60) + "…)", !(await js(`document.body.innerText.includes(${JSON.stringify(order2.number)})`)));
  ok("no orders access: the dashboard never even asks for orders", orderCalls === 0, "calls: " + orderCalls);
  ok("no orders access: the sidebar has no Orders link", await js(`![...document.querySelectorAll('nav a')].some(a=>a.getAttribute('href')==='/orders')`));

  await sb.from("orders").delete().eq("customer_id", customer2); await sb.from("customers").delete().eq("id", customer2);
} finally {
  try { ws?.close(); } catch { /* closed */ }
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* in use */ }
  if (customerId) { await sb.from("orders").delete().eq("customer_id", customerId); await sb.from("customers").delete().eq("id", customerId); }
  for (const id of authIds) await sb.auth.admin.deleteUser(id);
  const left = await sb.from("staff_users").select("id", { count: "exact", head: true }).like("email", "zz-%");
  const o = await sb.from("orders").select("id", { count: "exact", head: true });
  console.log(`\ncleanup: ${left.count} temporary staff left, ${o.count} orders left`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
