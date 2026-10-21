// Uploads generated pictures to the product-images bucket and sets image_path through the admin API (audited, bumps the catalog version).
// Usage (from backend/): node --env-file=.env.local scripts/import-images.mjs <folder with products/ and categories/> [--dry]
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const dry = process.argv.includes("--dry");
if (!dir) { console.error("Give the folder that holds products/ and categories/."); process.exit(1); }
const BASE = process.env.BASE ?? "http://localhost:3000";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET } = process.env;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: admin } = await sb.from("staff_users").select("id").eq("role", "super_admin").eq("status", "active").limit(1).single();
const payload = Buffer.from(JSON.stringify({ uid: admin.id, exp: Math.floor(Date.now() / 1000) + 3000 })).toString("base64url");
const cookie = `cc_session=${payload}.${createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url")}`;

const categories = (await sb.from("categories").select("id,slug")).data;
const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
const jobs = [];
for (const f of readdirSync(join(dir, "categories"))) {
  const slug = f.replace(/\.webp$/, "");
  if (bySlug.has(slug)) jobs.push({ kind: "categories", key: slug, id: bySlug.get(slug), file: join(dir, "categories", f) });
  else console.log("skip (no such category):", f);
}
const productIds = new Set((await sb.from("products").select("id")).data.map((p) => p.id));
for (const f of readdirSync(join(dir, "products"))) {
  const id = f.replace(/\.webp$/, "");
  if (productIds.has(id)) jobs.push({ kind: "products", key: id, id, file: join(dir, "products", f) });
  else console.log("skip (no such product):", f);
}
console.log(`${jobs.length} pictures to import${dry ? " (dry run)" : ""}`);
if (dry) process.exit(0);

let ok = 0; const failed = [];
async function run(job) {
  const path = `${job.kind}/${job.key}.webp`;
  const up = await sb.storage.from("product-images").upload(path, readFileSync(job.file), { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  if (up.error) throw new Error("upload: " + up.error.message);
  const res = await fetch(`${BASE}/api/admin/${job.kind}/${job.id}`, {
    method: "PATCH", headers: { "content-type": "application/json", cookie, origin: BASE }, body: JSON.stringify({ image_path: path }),
  });
  if (!res.ok) throw new Error(`PATCH ${res.status} ${(await res.text()).slice(0, 120)}`);
}
const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let job; (job = queue.shift()); ) {
    try { await run(job); ok++; } catch (e) { failed.push(`${job.kind}/${job.key}: ${e.message}`); }
    if ((ok + failed.length) % 25 === 0) console.log(`${ok + failed.length}/${jobs.length}`);
  }
}));
console.log(`done: ${ok} imported, ${failed.length} failed`);
failed.slice(0, 10).forEach((l) => console.log("  " + l));
process.exit(failed.length ? 1 : 0);
