// Makes the 480 px thumbnails (thumbs/products/<id>.webp, thumbs/categories/<slug>.webp) for pictures that were imported before
// the server started making them itself. Same rule as src/modules/catalog/image-paths.ts.
// Usage (from backend/): node --env-file=.env.local scripts/make-thumbnails.mjs <folder with products/ and categories/>
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("Give the folder that holds products/ and categories/."); process.exit(1); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const jobs = ["products", "categories"].flatMap((kind) => readdirSync(join(dir, kind)).filter((f) => f.endsWith(".webp")).map((f) => ({ kind, f })));
let ok = 0, before = 0, after = 0; const failed = [];
const queue = [...jobs];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let j; (j = queue.shift()); ) {
    try {
      const src = readFileSync(join(dir, j.kind, j.f));
      const small = await sharp(src).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
      const up = await sb.storage.from("product-images").upload(`thumbs/${j.kind}/${j.f}`, small, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
      if (up.error) throw new Error(up.error.message);
      ok++; before += src.length; after += small.length;
    } catch (e) { failed.push(`${j.kind}/${j.f}: ${e.message}`); }
  }
}));
console.log(`${ok} thumbnails made, ${failed.length} failed. Average ${Math.round(before / ok / 1024)} KB -> ${Math.round(after / ok / 1024)} KB`);
failed.slice(0, 5).forEach((l) => console.log("  " + l));
process.exit(failed.length ? 1 : 0);
