// Live check of the admin API against the real project: creates clearly named test data (prefix "ZZ Test"), exercises the
// endpoints as the existing super admin, then removes everything it created. Run from backend/ with --env-file=.env.local.
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE ?? "http://localhost:3000";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET } = process.env;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Same cookie the dashboard issues: payload.signature (HMAC-SHA256, base64url).
const b64u = (b) => Buffer.from(b).toString("base64url");
const { data: admin } = await sb.from("staff_users").select("id,email").eq("role", "super_admin").eq("status", "active").limit(1).single();
const payload = b64u(JSON.stringify({ uid: admin.id, exp: Math.floor(Date.now() / 1000) + 600 }));
const cookie = `cc_session=${payload}.${createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url")}`;

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? (pass++, console.log("  ok   " + name)) : (fail++, console.log("  FAIL " + name + " " + extra)); };

async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method, headers: { cookie, origin: BASE, "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 */ }
  return { status: res.status, json };
}

const created = { categories: [], products: [], groups: [], objects: [] };
try {
  // ---- Access --------------------------------------------------------------------------------------------------------
  const anon = await fetch(BASE + "/api/admin/categories");
  ok("no session -> 401", anon.status === 401);
  const forged = await fetch(BASE + "/api/admin/categories", { headers: { cookie: "cc_session=abc.def" } });
  ok("forged session -> 401", forged.status === 401);
  const evil = await call("POST", "/api/admin/categories", { name: "ZZ Test Evil" }, { origin: "https://evil.example" });
  ok("cross-site mutation -> 403 CROSS_SITE", evil.status === 403 && evil.json.error.code === "CROSS_SITE", JSON.stringify(evil));

  // ---- Categories ------------------------------------------------------------------------------------------------------
  const list = await call("GET", "/api/admin/categories");
  ok("lists the 15 seeded categories with counts", list.status === 200 && list.json.items.length >= 15 && list.json.items.some((c) => c.slug === "pizza" && c.product_count === 67), JSON.stringify(list.json).slice(0, 200));

  const cat = await call("POST", "/api/admin/categories", { name: "ZZ Test Bäckerei", description: "temp" });
  ok("create category (slug from name, German letters spelled out)", cat.status === 201 && cat.json.slug === "zz-test-baeckerei", JSON.stringify(cat.json));
  created.categories.push(cat.json.id);
  const dup = await call("POST", "/api/admin/categories", { name: "ZZ Test Bäckerei" });
  ok("same name gets the next free slug", dup.status === 201 && dup.json.slug === "zz-test-baeckerei-2", JSON.stringify(dup.json));
  created.categories.push(dup.json.id);
  const taken = await call("POST", "/api/admin/categories", { name: "x", slug: "pizza" });
  ok("an explicit slug that exists -> 409 SLUG_TAKEN", taken.status === 409 && taken.json.error.code === "SLUG_TAKEN");

  const patched = await call("PATCH", `/api/admin/categories/${cat.json.id}`, { name: "ZZ Test Backwaren" });
  ok("a PATCH changes only the given field (description kept)", patched.status === 200 && patched.json.name === "ZZ Test Backwaren" && patched.json.description === "temp" && patched.json.is_active === true, JSON.stringify(patched.json));
  ok("an empty PATCH -> 400", (await call("PATCH", `/api/admin/categories/${cat.json.id}`, {})).status === 400);

  const child = await call("POST", "/api/admin/categories", { name: "ZZ Test Kind", parent_id: cat.json.id });
  ok("sub-category allowed", child.status === 201, JSON.stringify(child.json));
  created.categories.push(child.json.id);
  const deep = await call("POST", "/api/admin/categories", { name: "ZZ Test Enkel", parent_id: child.json.id });
  ok("third level -> 400 CATEGORY_DEPTH", deep.status === 400 && deep.json.error.code === "CATEGORY_DEPTH", JSON.stringify(deep.json));
  if (deep.status === 201) created.categories.push(deep.json.id);

  const reorder = await call("POST", "/api/admin/categories/reorder", { ids: [dup.json.id, cat.json.id] });
  ok("reorder siblings", reorder.status === 200);
  const mixed = await call("POST", "/api/admin/categories/reorder", { ids: [cat.json.id, child.json.id] });
  ok("reorder across parents -> 400", mixed.status === 400);

  // ---- Option groups ------------------------------------------------------------------------------------------------------
  const groups = await call("GET", "/api/admin/option-groups");
  const topping = groups.json.items.find((g) => g.name === "Extra Zutaten");
  const pasta = groups.json.items.find((g) => g.name === "Nudelsorte");
  ok("lists the seeded groups", groups.status === 200 && topping && pasta);

  const g = await call("POST", "/api/admin/option-groups", { name: "ZZ Test Sauce", kind: "extra", min_select: 0, max_select: 2 });
  ok("create group", g.status === 201, JSON.stringify(g.json));
  created.groups.push(g.json.id);
  ok("min > max -> 400", (await call("POST", "/api/admin/option-groups", { name: "ZZ Test Bad", kind: "extra", min_select: 3, max_select: 1 })).status === 400);
  const opts = await call("PUT", `/api/admin/option-groups/${g.json.id}/options`, { options: [{ name: "Ketchup", default_price_minor: 50 }, { name: "Mayo", default_price_minor: 50 }] });
  ok("replace options", opts.status === 200 && opts.json.options.length === 2, JSON.stringify(opts.json));
  const twice = await call("PUT", `/api/admin/option-groups/${g.json.id}/options`, { options: [{ id: opts.json.options[0].id, name: "Ketchup", default_price_minor: 60 }] });
  ok("a second replace keeps the id, updates the price and removes the omitted option", twice.status === 200 && twice.json.options.length === 1 && twice.json.options[0].id === opts.json.options[0].id && twice.json.options[0].default_price_minor === 60, JSON.stringify(twice.json));
  const freeBad = await call("PUT", `/api/admin/option-groups/${pasta.id}/options`, { options: [{ name: "Spaghetti", default_price_minor: 10 }] });
  ok("a free choice group refuses prices -> 400 CHOICE_PRICE", freeBad.status === 400 && freeBad.json.error.code === "CHOICE_PRICE", JSON.stringify(freeBad.json));
  const pastaAfter = await call("GET", `/api/admin/option-groups/${pasta.id}`);
  ok("...and was left untouched", pastaAfter.json.options.length === 4);

  // ---- Products ---------------------------------------------------------------------------------------------------------
  const noPortion = await call("POST", "/api/admin/products", { category_id: cat.json.id, name: "ZZ Test Brot", diet: "veg", portions: [] });
  ok("a product without a portion -> 400", noPortion.status === 400);
  const prod = await call("POST", "/api/admin/products", {
    category_id: cat.json.id, name: "ZZ Test Brot", diet: "veg", description: "frisch",
    portions: [{ key: "klein", label: "Klein", price_minor: 300 }, { key: "gross", label: "Groß", price_minor: 500 }],
  });
  ok("create product with portions", prod.status === 201 && prod.json.portions.length === 2 && prod.json.product.slug === "zz-test-brot", JSON.stringify(prod.json).slice(0, 300));
  const pid = prod.json.product.id;
  created.products.push(pid);

  const price = await call("PATCH", `/api/admin/products/${pid}`, { is_new: true });
  ok("PATCH one flag leaves everything else (description, visibility, portions)", price.json.product.is_new === true && price.json.product.description === "frisch" && price.json.product.is_active === true && price.json.portions.length === 2, JSON.stringify(price.json).slice(0, 300));
  const swap = await call("PATCH", `/api/admin/products/${pid}`, { portions: [{ key: "klein", label: "Klein", price_minor: 350 }] });
  ok("replacing portions updates one and removes the other", swap.json.portions.length === 1 && swap.json.portions[0].price_minor === 350, JSON.stringify(swap.json.portions));
  await call("PATCH", `/api/admin/products/${pid}`, { portions: [{ key: "klein", label: "Klein", price_minor: 350 }, { key: "gross", label: "Groß", price_minor: 550 }] });

  // attach the shared topping group with a price grid for a few options, and an inherited one check
  const toppingFull = await call("GET", `/api/admin/option-groups/${topping.id}`);
  const first = toppingFull.json.options[0], second = toppingFull.json.options[1];
  const attach = await call("PUT", "/api/admin/attachments", {
    scope: "product", target_id: pid, group_id: topping.id, sort_order: 1,
    prices: [{ option_id: first.id, portion_key: "klein", price_minor: 70 }, { option_id: first.id, portion_key: "gross", price_minor: 120 }, { option_id: second.id, portion_key: null, price_minor: 90 }],
  });
  ok("attach a group with a price grid", attach.status === 200 && attach.json.prices.length === 3, JSON.stringify(attach.json).slice(0, 200));
  const preview = await call("GET", `/api/admin/products/${pid}/preview`);
  const grp = preview.json.groups.find((x) => x.name === "Extra Zutaten");
  const o1 = grp.options.find((o) => o.id === first.id), o2 = grp.options.find((o) => o.id === second.id);
  ok("the preview shows prices per portion as the app will get them", o1.prices.klein === 70 && o1.prices.gross === 120 && o2.prices.klein === 90 && o2.prices.gross === 90, JSON.stringify([o1.prices, o2.prices]));
  const choicePrice = await call("PUT", "/api/admin/attachments", { scope: "product", target_id: pid, group_id: pasta.id, prices: [{ option_id: pasta.options?.[0]?.id ?? pastaAfter.json.options[0].id, portion_key: null, price_minor: 5 }] });
  ok("a price on a free choice group -> 400 CHOICE_PRICE", choicePrice.status === 400 && choicePrice.json.error.code === "CHOICE_PRICE", JSON.stringify(choicePrice.json));
  const wrongOpt = await call("PUT", "/api/admin/attachments", { scope: "product", target_id: pid, group_id: topping.id, default_option_id: pastaAfter.json.options[0].id });
  ok("a default option from another group -> 400 OPTION_NOT_IN_GROUP", wrongOpt.status === 400 && wrongOpt.json.error.code === "OPTION_NOT_IN_GROUP", JSON.stringify(wrongOpt.json));
  const listAtt = await call("GET", `/api/admin/attachments?scope=product&target_id=${pid}`);
  ok("list attachments of a product", listAtt.status === 200 && listAtt.json.items.length === 1);

  // visibility: hidden products disappear from the public API at once
  const publicBefore = await fetch(BASE + `/api/products/${pid}`);
  ok("an active product is public", publicBefore.status === 200);
  const hide = await call("PATCH", `/api/admin/products/${pid}/availability`, { is_active: false });
  ok("hide a product", hide.status === 200 && hide.json.product.is_active === false);
  const publicAfter = await fetch(BASE + `/api/products/${pid}`);
  ok("a hidden product is gone from the public API", publicAfter.status === 404);
  ok("...but the admin preview still works", (await call("GET", `/api/admin/products/${pid}/preview`)).status === 200);
  await call("PATCH", `/api/admin/products/${pid}/availability`, { is_active: true });
  const soldOut = await call("PATCH", `/api/admin/products/${pid}/availability`, { portion_key: "gross", is_available: false });
  ok("mark one size sold out", soldOut.status === 200 && soldOut.json.portions.find((p) => p.key === "gross").is_available === false);
  ok("an unknown portion -> 404", (await call("PATCH", `/api/admin/products/${pid}/availability`, { portion_key: "huge", is_available: false })).status === 404);

  const copy = await call("POST", `/api/admin/products/${pid}/duplicate`);
  ok("duplicate starts hidden, with portions and group", copy.status === 201 && copy.json.product.is_active === false && copy.json.portions.length === 2 && copy.json.attachments.length === 1, JSON.stringify(copy.json).slice(0, 250));
  created.products.push(copy.json.product.id);

  const search = await call("GET", "/api/admin/products?search=ZZ%20Test&limit=10");
  ok("admin product list includes hidden products and search", search.status === 200 && search.json.items.length === 2, JSON.stringify(search.json).slice(0, 200));
  ok("a bad filter -> 400", (await call("GET", "/api/admin/products?active=maybe")).status === 400);

  // ---- Deleting ---------------------------------------------------------------------------------------------------------
  const delCat = await call("DELETE", `/api/admin/categories/${cat.json.id}`);
  ok("a category with products or sub-categories cannot be deleted -> 409", delCat.status === 409 && delCat.json.error.code === "CATEGORY_NOT_EMPTY", JSON.stringify(delCat.json));
  const delGroup = await call("DELETE", `/api/admin/option-groups/${topping.id}`);
  ok("a group in use cannot be deleted -> 409 IN_USE", delGroup.status === 409 && delGroup.json.error.code === "IN_USE", JSON.stringify(delGroup.json));
  const removeAtt = await call("DELETE", `/api/admin/attachments/${attach.json.id}`);
  ok("remove an attachment", removeAtt.status === 204);

  // ---- Images -----------------------------------------------------------------------------------------------------------
  const up = await call("POST", "/api/admin/uploads", { kind: "product", content_type: "image/png" });
  ok("prepare an upload", up.status === 201 && /^products\/[0-9a-f-]{36}\.png$/.test(up.json.path), JSON.stringify(up.json).slice(0, 200));
  ok("svg is refused", (await call("POST", "/api/admin/uploads", { kind: "product", content_type: "image/svg+xml" })).status === 400);
  // a real 1x1 PNG goes straight to storage through the signed URL
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
  const put = await fetch(up.json.upload_url, { method: "PUT", headers: { "content-type": "image/png", authorization: `Bearer ${up.json.token}` }, body: png });
  created.objects.push(up.json.path);
  ok("the browser can upload through the signed URL", put.status === 200 || put.status === 201, `status ${put.status} ${await put.text().catch(() => "")}`.slice(0, 160));
  const pub = await fetch(up.json.public_url);
  ok("the uploaded image is publicly readable", pub.status === 200 && (pub.headers.get("content-type") ?? "").includes("image/png"), `status ${pub.status}`);
  const withImage = await call("PATCH", `/api/admin/products/${pid}`, { image_path: up.json.path });
  ok("save the image on the product", withImage.status === 200 && withImage.json.product.image_url === up.json.public_url);
  ok("a path with .. is refused", (await call("PATCH", `/api/admin/products/${pid}`, { image_path: "../x.png" })).status === 400);
} finally {
  // ---- Clean up: remove everything this run created ---------------------------------------------------------------------
  for (const id of created.products) await sb.from("products").delete().eq("id", id);
  for (const id of created.groups) await sb.from("option_groups").delete().eq("id", id);
  for (const id of created.categories.reverse()) await sb.from("categories").delete().eq("id", id);
  if (created.objects.length > 0) await sb.storage.from("product-images").remove(created.objects);
  const left = await sb.from("categories").select("id").like("name", "ZZ Test%");
  const leftP = await sb.from("products").select("id").like("name", "ZZ Test%");
  const leftG = await sb.from("option_groups").select("id").like("name", "ZZ Test%");
  console.log(`\ncleanup: ${left.data.length} test categories, ${leftP.data.length} products, ${leftG.data.length} groups left`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
