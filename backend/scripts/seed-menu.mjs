// Loads the menu in scripts/seed/niki-menu.json into the catalog tables. Safe to run again: it matches by name or slug and
// converges on the file's content (it creates what is missing and updates what changed).
//
//   node --env-file=.env.local scripts/seed-menu.mjs            # dry run: validates and prints what it would do
//   node --env-file=.env.local scripts/seed-menu.mjs --apply    # writes to the database in SUPABASE_URL
//
// The file is the source of truth for the seed. Edit it (by hand or with the dashboard's import later), then run this again.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const seed = JSON.parse(readFileSync(new URL("./seed/niki-menu.json", import.meta.url), "utf8"));

// ---- Validate the file before touching anything -----------------------------------------------------------------------
const problems = [];
const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const groupByName = new Map(seed.groups.map((g) => [g.name, g]));
const setByName = new Map(seed.portionSets.map((s) => [s.name, s]));
const categoryBySlug = new Map(seed.categories.map((c) => [c.slug, c]));
if (groupByName.size !== seed.groups.length) problems.push("duplicate group names");
if (categoryBySlug.size !== seed.categories.length) problems.push("duplicate category slugs");
const productSlugs = new Set();
for (const g of seed.groups) {
  if (g.min > g.max) problems.push(`group ${g.name}: min > max`);
  if (g.required && g.min < 1) problems.push(`group ${g.name}: required needs min >= 1`);
  if (g.kind === "choice" && g.options.some((o) => o.defaultPriceMinor !== 0)) problems.push(`group ${g.name}: choices must be free`);
  if (new Set(g.options.map((o) => o.name)).size !== g.options.length) problems.push(`group ${g.name}: duplicate option names`);
}
function checkAttachments(owner, list) {
  const seen = new Set();
  for (const a of list) {
    const group = groupByName.get(a.group);
    if (!group) { problems.push(`${owner}: unknown group ${a.group}`); continue; }
    if (seen.has(a.group)) problems.push(`${owner}: group ${a.group} attached twice`);
    seen.add(a.group);
    if (a.defaultOption && !group.options.some((o) => o.name === a.defaultOption)) problems.push(`${owner}: default ${a.defaultOption} is not an option of ${a.group}`);
    if (a.prices && group.kind === "choice") problems.push(`${owner}: choice group ${a.group} cannot have prices`);
  }
}
for (const c of seed.categories) {
  if (!slugRe.test(c.slug)) problems.push(`category slug ${c.slug}`);
  if (!setByName.has(c.portionSet)) problems.push(`category ${c.slug}: unknown portion set`);
  checkAttachments(`category ${c.slug}`, c.groupAttachments);
}
for (const p of seed.products) {
  if (!slugRe.test(p.slug)) problems.push(`product slug ${p.slug}`);
  if (productSlugs.has(p.slug)) problems.push(`duplicate product slug ${p.slug}`);
  productSlugs.add(p.slug);
  if (!categoryBySlug.has(p.category)) problems.push(`${p.slug}: unknown category ${p.category}`);
  if (p.portions.length === 0) problems.push(`${p.slug}: no portions`);
  if (new Set(p.portions.map((x) => x.key)).size !== p.portions.length) problems.push(`${p.slug}: duplicate portion keys`);
  if (p.portions.some((x) => !Number.isInteger(x.priceMinor) || x.priceMinor < 0)) problems.push(`${p.slug}: bad price`);
  checkAttachments(p.slug, p.groupAttachments);
}
if (problems.length > 0) {
  console.error("The seed file has problems:\n - " + problems.join("\n - "));
  process.exit(1);
}

const counts = {
  portionSets: seed.portionSets.length, groups: seed.groups.length, options: seed.groups.reduce((n, g) => n + g.options.length, 0),
  categories: seed.categories.length, products: seed.products.length, portions: seed.products.reduce((n, p) => n + p.portions.length, 0),
  attachments: seed.categories.reduce((n, c) => n + c.groupAttachments.length, 0) + seed.products.reduce((n, p) => n + p.groupAttachments.length, 0),
};
console.log("Seed file is valid:", counts);
console.log("Flagged for the restaurant to confirm:\n - " + seed.meta.toConfirmWithRestaurant.join("\n - "));
if (!apply) {
  console.log("\nDry run: nothing was written. Run again with --apply to write to", process.env.SUPABASE_URL ?? "(SUPABASE_URL not set)");
  process.exit(0);
}

// ---- Write ------------------------------------------------------------------------------------------------------------
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ok = (result, what) => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
};
const chunks = (list, size = 100) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
async function upsert(table, rows, onConflict, select = "*") {
  const out = [];
  for (const part of chunks(rows)) out.push(...ok(await db.from(table).upsert(part, { onConflict }).select(select), `upsert ${table}`));
  return out;
}

// Portion sets
const sets = await upsert("portion_sets", seed.portionSets.map((s) => ({ name: s.name })), "name", "id,name");
const setId = new Map(sets.map((s) => [s.name, s.id]));
await upsert("portion_set_items", seed.portionSets.flatMap((s) => s.items.map((it, i) => ({ set_id: setId.get(s.name), key: it.key, label: it.label, sort_order: i + 1 }))), "set_id,key");

// Option groups and options
const groups = await upsert("option_groups", seed.groups.map((g) => ({
  name: g.name, kind: g.kind, min_select: g.min, max_select: g.max, is_required: g.required, is_active: true,
})), "name", "id,name");
const groupId = new Map(groups.map((g) => [g.name, g.id]));
const options = await upsert("options", seed.groups.flatMap((g) => g.options.map((o, i) => ({
  group_id: groupId.get(g.name), name: o.name, default_price_minor: o.defaultPriceMinor, sort_order: i + 1, is_active: true,
}))), "group_id,name", "id,group_id,name");
const optionId = new Map(options.map((o) => [`${o.group_id}|${o.name}`, o.id]));
const optionsOfGroup = (name) => options.filter((o) => o.group_id === groupId.get(name));

// Categories and products
const categories = await upsert("categories", seed.categories.map((c) => ({
  slug: c.slug, name: c.name, sort_order: c.sortOrder, is_active: true, default_portion_set_id: setId.get(c.portionSet),
})), "slug", "id,slug");
const categoryId = new Map(categories.map((c) => [c.slug, c.id]));

const products = await upsert("products", seed.products.map((p) => ({
  slug: p.slug, category_id: categoryId.get(p.category), name: p.name, description: p.description, diet: p.diet,
  is_spicy: p.isSpicy, is_bestseller: p.isBestseller, is_new: p.isNew, fulfillment: p.fulfillment, sort_order: p.sortOrder, is_active: true,
})), "slug", "id,slug");
const productId = new Map(products.map((p) => [p.slug, p.id]));

// Portions: upsert the wanted ones, remove any others the seeded products still have.
const wantedPortions = seed.products.flatMap((p) => p.portions.map((x, i) => ({
  product_id: productId.get(p.slug), key: x.key, label: x.label, price_minor: x.priceMinor, currency: "EUR", is_available: true, sort_order: i + 1,
})));
await upsert("product_portions", wantedPortions, "product_id,key");
const idsOfSeeded = [...productId.values()];
let removedPortions = 0;
for (const part of chunks(idsOfSeeded, 50)) {
  const existing = ok(await db.from("product_portions").select("id,product_id,key").in("product_id", part), "read portions");
  const wanted = new Set(wantedPortions.map((w) => `${w.product_id}|${w.key}`));
  const stale = existing.filter((e) => !wanted.has(`${e.product_id}|${e.key}`)).map((e) => e.id);
  if (stale.length > 0) { ok(await db.from("product_portions").delete().in("id", stale), "delete stale portions"); removedPortions += stale.length; }
}

// Group attachments (category level and product level) and their price grids.
const desired = [];
seed.categories.forEach((c) => c.groupAttachments.forEach((a, i) => desired.push({ scope: "category", target: categoryId.get(c.slug), a, i })));
seed.products.forEach((p) => p.groupAttachments.forEach((a, i) => desired.push({ scope: "product", target: productId.get(p.slug), a, i })));

const existingAttachments = [];
for (const part of chunks([...categoryId.values()], 50)) existingAttachments.push(...ok(await db.from("group_attachments").select("*").eq("scope", "category").in("category_id", part), "read category attachments"));
for (const part of chunks(idsOfSeeded, 50)) existingAttachments.push(...ok(await db.from("group_attachments").select("*").eq("scope", "product").in("product_id", part), "read product attachments"));
const keyOf = (scope, target, group) => `${scope}|${target}|${group}`;
const existingByKey = new Map(existingAttachments.map((e) => [keyOf(e.scope, e.scope === "category" ? e.category_id : e.product_id, e.group_id), e]));

const attachmentRows = []; // final rows with ids
for (const d of desired) {
  const gid = groupId.get(d.a.group);
  const row = {
    scope: d.scope, category_id: d.scope === "category" ? d.target : null, product_id: d.scope === "product" ? d.target : null,
    group_id: gid, sort_order: d.i + 1, default_option_id: d.a.defaultOption ? optionId.get(`${gid}|${d.a.defaultOption}`) : null,
  };
  const existing = existingByKey.get(keyOf(d.scope, d.target, gid));
  if (existing) {
    ok(await db.from("group_attachments").update({ sort_order: row.sort_order, default_option_id: row.default_option_id }).eq("id", existing.id), "update attachment");
    attachmentRows.push({ id: existing.id, d });
  } else {
    const [created] = ok(await db.from("group_attachments").insert(row).select("id"), "insert attachment");
    attachmentRows.push({ id: created.id, d });
  }
}
const desiredKeys = new Set(desired.map((d) => keyOf(d.scope, d.target, groupId.get(d.a.group))));
const staleAttachments = existingAttachments.filter((e) => !desiredKeys.has(keyOf(e.scope, e.scope === "category" ? e.category_id : e.product_id, e.group_id))).map((e) => e.id);
if (staleAttachments.length > 0) ok(await db.from("group_attachments").delete().in("id", staleAttachments), "delete stale attachments");

// Price grids: replace the rows of every attachment that has prices.
const priced = attachmentRows.filter((r) => r.d.a.prices);
for (const part of chunks(priced.map((r) => r.id), 50)) ok(await db.from("option_prices").delete().in("attachment_id", part), "clear prices");
const priceRows = priced.flatMap((r) =>
  optionsOfGroup(r.d.a.group).flatMap((o) =>
    Object.entries(r.d.a.prices).map(([portionKey, cents]) => ({
      attachment_id: r.id, option_id: o.id, portion_key: portionKey === "*" ? null : portionKey, price_minor: cents,
    })),
  ),
);
for (const part of chunks(priceRows, 500)) ok(await db.from("option_prices").insert(part), "insert prices");

// ---- Verify -----------------------------------------------------------------------------------------------------------
const total = async (table) => (await db.from(table).select("*", { count: "exact", head: true })).count;
console.log("\nWritten. Rows now in the database:", {
  categories: await total("categories"), products: await total("products"), portions: await total("product_portions"),
  groups: await total("option_groups"), options: await total("options"), attachments: await total("group_attachments"), prices: await total("option_prices"),
});
console.log(`Removed ${removedPortions} stale portions and ${staleAttachments.length} stale attachments. Price rows written: ${priceRows.length}.`);
