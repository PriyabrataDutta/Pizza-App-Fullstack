// Drives the dashboard's Orders screen in headless Chrome against the real project, as the restaurant.
// Places test orders through the customer API, then checks the board, accepting, the drawer, a live arrival and a stale click.
// Removes every test guest and order at the end. Usage (from backend/, dev server on :3000): node --env-file=.env.local scripts/orders-ui-check.mjs <screenshot folder>
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const OUT = process.argv[2];
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET } = process.env;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? (pass++, console.log("  ok   " + name)) : (fail++, console.log("  FAIL " + name + " " + extra)); };

// ---- customer side: place an order as a fresh guest ---------------------------------------------------------------------------
const customers = [];
async function placeOrder(label, line1) {
  const post = async (path, token, body) => (await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
  const g = await post("/api/customers/guest");
  customers.push(g.customer_id);
  const addr = await post("/api/addresses", g.token, { label: label, line1, locality: "Wesel-Mitte", city: "Wesel", postal_code: "46483", instructions: "Bitte zweimal klingeln" });
  const salami = (await (await fetch(`${BASE}/api/products?search=Salami&limit=20`)).json()).items.find((p) => p.name === "Salami");
  const order = await post("/api/checkout", g.token, {
    idempotency_key: "ui-" + Math.random().toString(36).slice(2, 12), address_id: addr.id, payment_method: "cod",
    items: [{ product_id: salami.id, portion_key: "gross", option_ids: [], quantity: 2 }],
  });
  return order;
}

// ---- restaurant side: a forged session for the super admin --------------------------------------------------------------------
const { data: admin } = await sb.from("staff_users").select("id").eq("role", "super_admin").eq("status", "active").limit(1).single();
const payload = Buffer.from(JSON.stringify({ uid: admin.id, exp: Math.floor(Date.now() / 1000) + 1800 })).toString("base64url");
const cookie = `${payload}.${createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url")}`;

const profile = mkdtempSync(join(tmpdir(), "chrome-orders-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=9337", `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });
let ws, send;
try {
  let url;
  for (let i = 0; i < 40 && !url; i++) { try { url = (await (await fetch("http://127.0.0.1:9337/json/list")).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* starting */ } await sleep(500); }
  ws = new WebSocket(url);
  await new Promise((r) => (ws.onopen = r));
  let id = 1; const pend = new Map();
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pend.has(msg.id)) { pend.get(msg.id)(msg.result); pend.delete(msg.id); } };
  send = (method, params = {}) => new Promise((resolve) => { const i = id++; pend.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async (name) => { if (OUT) writeFileSync(join(OUT, name + ".png"), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64")); };
  const waitFor = async (expr, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(300); } return false; };

  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Network.setCookie", { name: "cc_session", value: cookie, url: BASE, httpOnly: true, sameSite: "Lax" });

  // 1. an order exists before the dashboard is opened
  const first = await placeOrder("Home", "Hohe Straße 12");
  ok("customer placed order " + first.number, /^CC-\d+$/.test(first.number));

  await send("Page.navigate", { url: BASE + "/orders" });
  ok("the board loads the real order", await waitFor(`document.body.innerText.includes(${JSON.stringify(first.number)})`, 40000));
  const lane = (name) => `(() => { const s=[...document.querySelectorAll('section')].find(x=>x.querySelector('h2')?.innerText.trim().startsWith(${JSON.stringify(name)})); return s ? s.innerText : ''; })()`;
  ok("it is in the Placed lane", (await js(lane("Placed"))).includes(first.number));
  ok("the ticket shows what to make and the money in euros", await js(`(() => { const t=${lane("Placed")}; return t.includes('Salami') && t.includes('2×') && /\\d,\\d\\d\\s?€/.test(t); })()`));
  ok("the ticket identifies the guest by street", (await js(lane("Placed"))).includes("Hohe Straße 12"));
  ok("the demo notice is gone, a live indicator is shown", await js(`!document.body.innerText.includes('Seeded demo orders') && document.body.innerText.includes('Live')`));
  ok("the tab title shows the waiting count", await waitFor(`document.title.startsWith('(1) ')`, 8000), await js("document.title"));
  ok("the new-order sound switch is shown (on by default)", await js(`document.body.innerText.includes('New order sound: on')`));
  await shot("1-board");

  // 2. accept it from the ticket
  await js(`(() => { const li=[...document.querySelectorAll('li.ticket-wrap')].find(x=>x.innerText.includes(${JSON.stringify(first.number)})); [...li.querySelectorAll('button')].find(b=>b.innerText.includes('Accept order')).click(); })()`);
  ok("after Accept the order moves to the Accepted lane", await waitFor(`(${lane("Accepted")}).includes(${JSON.stringify(first.number)})`, 10000));
  const row = (await sb.from("orders").select("status").eq("id", first.id).single()).data;
  ok("once nothing is waiting the tab title is plain again", await waitFor(`!document.title.startsWith('(')`, 8000), await js("document.title"));
  ok("and the database says accepted", row.status === "accepted", JSON.stringify(row));
  const hist = (await sb.from("order_status_history").select("new_status,actor_label").eq("order_id", first.id).order("created_at")).data;
  ok("with the change recorded by a staff member", hist.map((h) => h.new_status).join(">") === "placed>accepted" && hist[1].actor_label.includes("@"), JSON.stringify(hist));

  // sound switch is remembered across a reload
  await js(`[...document.querySelectorAll('button')].find(b=>b.innerText.includes('New order sound'))?.click()`);
  ok("switching sound off shows 'off'", await waitFor(`document.body.innerText.includes('New order sound: off')`, 4000));
  await send("Page.reload");
  ok("and the choice survives a reload", await waitFor(`document.body.innerText.includes('New order sound: off')`, 40000));
  await js(`[...document.querySelectorAll('button')].find(b=>b.innerText.includes('New order sound'))?.click()`);

  await waitFor(`document.body.innerText.includes(${JSON.stringify(first.number)})`, 40000);
  // 3. open it
  await js(`[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.includes(${JSON.stringify(first.number)}))?.click()`);
  ok("the drawer shows address, note, items, price and history", await waitFor(`(() => { const t=document.body.innerText; return t.includes('Hohe Straße 12, Wesel-Mitte, 46483 Wesel') && t.includes('Bitte zweimal klingeln') && t.includes('Salami') && t.includes('Total') && t.includes('Status history'); })()`, 8000));
  ok("the history names who accepted it", await js(`/@/.test(document.body.innerText.split('Status history')[1] || '')`));
  await shot("2-drawer");
  await js(`document.querySelector('[aria-label="Close"], button[aria-label*="lose"]')?.click(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
  await sleep(600);

  // 4. a new order arrives while the page is open, without a reload
  const second = await placeOrder("Work", "Dorfstraße 3");
  ok("a second order appears on its own (within the refresh time)", await waitFor(`document.body.innerText.includes(${JSON.stringify(second.number)})`, 25000));
  ok("with a new-order alert", await js(`document.body.innerText.includes('New order') && document.body.innerText.includes(${JSON.stringify(second.number)})`));
  await shot("3-arrival");

  // 5. a stale click: someone else already moved the order; the screen must say so and show the truth
  await sb.rpc("advance_order_status", { p_order: second.id, p_new: "accepted", p_actor_staff: admin.id, p_actor_label: "other-tablet", p_reason: "" });
  await js(`(() => { const li=[...document.querySelectorAll('li.ticket-wrap')].find(x=>x.innerText.includes(${JSON.stringify(second.number)})); [...li.querySelectorAll('button')].find(b=>b.innerText.includes('Accept order'))?.click(); })()`);
  ok("a stale Accept is refused with a clear message", await waitFor(`document.querySelector('[role=alert]') && document.querySelector('[role=alert]').innerText.length > 5`, 8000));
  ok("and the board then shows the order where it really is", await waitFor(`(${lane("Accepted")}).includes(${JSON.stringify(second.number)})`, 10000));
  await shot("4-stale");

  // 6. reject needs a reason dialog and keeps the order out of the board
  const third = await placeOrder("Other", "Mühlenweg 5");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(third.number)})`, 25000);
  await js(`[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.includes(${JSON.stringify(third.number)}))?.click()`);
  await waitFor(`[...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='Reject')`, 6000);
  await js(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Reject').click()`);
  await sleep(500);
  await js(`(() => { const t=document.querySelector('textarea'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(t,'Kitchen closed'); t.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await js(`[...document.querySelectorAll('button')].filter(b=>b.innerText.trim()==='Reject').pop().click()`);
  await sleep(2500);
  const rej = (await sb.from("orders").select("status").eq("id", third.id).single()).data;
  const rejH = (await sb.from("order_status_history").select("reason").eq("order_id", third.id).eq("new_status", "rejected")).data;
  ok("Reject saves status and reason", rej.status === "rejected" && rejH[0]?.reason === "Kitchen closed", JSON.stringify([rej, rejH]));

  // 7. the Overview uses the same real orders
  const fourth = await placeOrder("Home", "Rheinstraße 9");
  await send("Page.navigate", { url: BASE + "/" });
  ok("Overview lists the new order under 'Needs your attention'", await waitFor(`document.body.innerText.includes(${JSON.stringify(fourth.number)})`, 40000));
  ok("Overview figures are real: today's orders and revenue in euros, no demo notice", await js(`(() => { const t=document.body.innerText; return t.includes('Orders today') && /[0-9],[0-9][0-9] €/.test(t.replace(/ /g,' ')) && !t.includes('seeded demo'); })()`));
  await shot("5-overview");
} finally {
  try { ws?.close(); } catch { /* closed */ }
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* in use */ }
  for (const c of customers) { await sb.from("orders").delete().eq("customer_id", c); await sb.from("customers").delete().eq("id", c); }
  const left = await sb.from("orders").select("id", { count: "exact", head: true });
  console.log(`\ncleanup: ${left.count} orders left in the database`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
