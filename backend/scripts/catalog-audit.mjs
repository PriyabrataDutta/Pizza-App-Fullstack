// Orders every product on the menu, in every size, through the real server quote, and checks the prices.
// For each product and size: the server's price must equal the price the menu lists, plus the price of the required choices that
// were picked; for products with extras, a priced extra must add exactly its listed price for that size. Also checks the menu itself
// (images, sizes, no duplicates). Creates one guest and no orders; the guest is removed at the end.
// Usage (from backend/, dev server on :3000): node --env-file=.env.local scripts/catalog-audit.mjs
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const problems = [];
const ok = (name, cond, extra = "") => { cond ? pass++ : (fail++, problems.push(`${name} ${extra}`)); };
// One request at a time, at most ~7 per second, and a pause-and-retry on 429: the audit makes thousands of calls and the API
// (rightly) allows 600 a minute per address.
let gate = Promise.resolve();
const paced = (fn) => { const run = gate.then(async () => { await new Promise((r) => setTimeout(r, 90)); return fn(); }); gate = run.catch(() => {}); return run; };
const withRetry = async (fn) => { for (let i = 0; i < 6; i++) { const r = await paced(fn); if (r.status !== 429) return r; await new Promise((r2) => setTimeout(r2, 8000)); } return paced(fn); };
const get = async (path) => (await withRetry(async () => { const res = await fetch(BASE + path); return { status: res.status, json: await res.json() }; })).json;

const guest = await (await fetch(BASE + "/api/customers/guest", { method: "POST" })).json();
const quote = (items) => withRetry(async () => {
  const res = await fetch(BASE + "/api/pricing/quote", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${guest.token}` }, body: JSON.stringify({ items }) });
  return { status: res.status, json: await res.json() };
});

try {
  const categories = (await get("/api/categories")).items;
  const products = [];
  let cursor = null;
  do { const j = await get("/api/products?limit=200" + (cursor ? `&cursor=${cursor}` : "")); products.push(...j.items); cursor = j.next_cursor; } while (cursor);
  console.log(`${categories.length} categories, ${products.length} products`);

  // ---- the menu itself ---------------------------------------------------------------------------------------------------------
  const ids = new Set(products.map((p) => p.id));
  ok("product ids are unique", ids.size === products.length);
  const names = new Map();
  for (const p of products) names.set(`${p.category_id}|${p.name.toLowerCase()}`, (names.get(`${p.category_id}|${p.name.toLowerCase()}`) ?? 0) + 1);
  const dup = [...names.entries()].filter(([, n]) => n > 1);
  ok("no product name appears twice in a category", dup.length === 0, JSON.stringify(dup.slice(0, 3)));
  const catIds = new Set(categories.map((c) => c.id));
  for (const p of products) {
    ok(`${p.name}: belongs to a visible category`, catIds.has(p.category_id));
    ok(`${p.name}: has at least one size`, p.portions.length > 0);
    ok(`${p.name}: every price is a positive whole number of cents`, p.portions.every((x) => Number.isInteger(x.price_minor) && x.price_minor > 0));
    ok(`${p.name}: has a picture and a thumbnail`, !!p.image_url && !!p.thumb_url);
    ok(`${p.name}: sizes have distinct keys`, new Set(p.portions.map((x) => x.key)).size === p.portions.length);
  }
  for (const c of categories) ok(`category ${c.name}: has a picture`, !!c.image_url && !!c.thumb_url);
  for (const c of categories) ok(`category ${c.name}: has products`, products.some((p) => p.category_id === c.id));

  // ---- every product, every size, through the server --------------------------------------------------------------------------------
  // One quote per product carries every size as separate lines (the server returns the lines in the same order), which keeps the number
  // of requests low: each size alone, three of each, and each with its first priced extra.
  let checked = 0, withExtras = 0, withChoices = 0, unavailable = 0;
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null; // for a quick re-check of a few products
  const queue = products.filter((p) => !only || only.includes(p.name));
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let p; (p = queue.shift()); ) {
      const detail = await get(`/api/products/${p.id}`);
      const required = detail.groups.filter((g) => g.required);
      // as many options as the group demands (a "2 toppings of your choice" group needs two)
      const picks = required.flatMap((g) => g.options.slice(0, Math.max(g.min, 1)).map((o) => ({ g, o })));
      if (required.length) withChoices++;
      if (p.fulfillment === "pickup_only") {
        // Alcohol is for pickup only: it must show up on the menu but be refused for delivery, with a clear reason.
        const refused = await quote([{ product_id: p.id, portion_key: detail.portions[0].key, option_ids: picks.map((x) => x.o.id), quantity: 1 }]);
        ok(`${p.name}: a pickup-only item is refused for delivery with a clear reason`, refused.status === 400 && /only available for pickup/.test(refused.json?.error?.message ?? ""), `HTTP ${refused.status}`);
        continue;
      }
      const sizes = detail.portions.filter((x) => x.available);
      unavailable += detail.portions.length - sizes.length;
      const lines = [];   // what we send
      const expect = [];  // what each line should cost: [name, expected unit price, quantity]
      let extraUsed = false;
      for (const portion of sizes) {
        const base = { product_id: p.id, portion_key: portion.key, option_ids: picks.map((x) => x.o.id), quantity: 1 };
        const unit = portion.price_minor + picks.reduce((sum, x) => sum + (x.o.prices?.[portion.key] ?? 0), 0);
        lines.push(base); expect.push([`${p.name} (${portion.label})`, unit, 1]);
        lines.push({ ...base, quantity: 3 }); expect.push([`${p.name} (${portion.label}) x3`, unit, 3]);
        const extra = detail.groups.filter((g) => !g.required && g.kind === "extra").map((g) => g.options.find((o) => o.prices && portion.key in o.prices)).find(Boolean);
        if (extra) {
          extraUsed = true;
          lines.push({ ...base, option_ids: [...base.option_ids, extra.id] });
          expect.push([`${p.name} (${portion.label}) + extra "${extra.name}"`, unit + extra.prices[portion.key], 1]);
        }
      }
      if (extraUsed) withExtras++;
      const q = await quote(lines);
      checked += sizes.length;
      if (q.status !== 200) { ok(`${p.name}: can be ordered`, false, `HTTP ${q.status} ${q.json?.error?.message ?? ""}`); continue; }
      ok(`${p.name}: the server returned one line per request line`, q.json.lines.length === lines.length);
      expect.forEach(([name, unit, qty], i) => {
        const line = q.json.lines[i];
        ok(`${name}: server price ${line?.unit_price_minor} equals the menu price ${unit}`, line?.unit_price_minor === unit);
        ok(`${name}: line total is unit price x ${qty}`, line?.line_total_minor === unit * qty);
      });
      ok(`${p.name}: the subtotal is the sum of the lines`, q.json.subtotal_minor === expect.reduce((sum, [, unit, qty]) => sum + unit * qty, 0));
      // a choice that is required must really be required
      if (required.length) {
        const q0 = await quote([{ product_id: p.id, portion_key: detail.portions[0].key, option_ids: [], quantity: 1 }]);
        ok(`${p.name}: ordering without the required choice is refused`, q0.status === 400, `HTTP ${q0.status}`);
      }
      // a size that does not exist is refused
      const qs = await quote([{ product_id: p.id, portion_key: "does_not_exist", option_ids: [], quantity: 1 }]);
      ok(`${p.name}: an unknown size is refused`, [400, 404, 422].includes(qs.status), `HTTP ${qs.status}`);
    }
  }));
  console.log(`quoted ${checked} product sizes (${withChoices} products with required choices, ${withExtras} with priced extras, ${unavailable} sold-out sizes skipped)`);
} finally {
  await sb.from("customers").delete().eq("id", guest.customer_id);
}
console.log(`\n${pass} checks passed, ${fail} failed`);
for (const p of problems.slice(0, 25)) console.log("  FAIL " + p);
if (problems.length > 25) console.log(`  ... and ${problems.length - 25} more`);
process.exit(fail ? 1 : 0);
