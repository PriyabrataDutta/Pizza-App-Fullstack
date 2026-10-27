// Applies every migration in supabase/migrations to an in-memory Postgres (PGlite), in order, and checks the launch-readiness
// migration against data that already exists in production. Touches no real database. Run: npm run test:migrations
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = process.argv[2] ?? fileURLToPath(new URL("../supabase/migrations", import.meta.url));
const db = new PGlite({ extensions: { pg_trgm } });
// Stand-ins for what Supabase provides.
await db.exec(`
  create schema if not exists extensions; create schema if not exists auth; create schema if not exists storage;
  create role anon; create role authenticated; create role service_role;
  create function public.rls_auto_enable() returns void language sql as $$ select 1 $$; create table auth.users (id uuid primary key default gen_random_uuid());
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`);
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : (fail++, console.log("  FAIL " + n)); };
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  if (f.startsWith("20261027")) {
    // Data that exists in production before this migration: a guest with an order, a product, an order line.
    await db.exec(`
      insert into public.customers (token_hash) values (repeat('a', 64)), (repeat('b', 64));
      insert into public.categories (slug, name) values ('pizza', 'Pizza');
      insert into public.products (category_id, slug, name, diet) select id, 'margherita', 'Margherita', 'veg' from public.categories;
    `);
    await db.exec(`
      insert into public.orders (order_number, customer_id, payment_method, payment_status, subtotal_minor, total_minor,
        delivery_label, delivery_line1, delivery_locality, delivery_city, delivery_postal_code, idempotency_key)
      select 'CC-1', id, 'cod', 'pending', 1000, 1000, 'Home', 'Hohe Strasse 12', 'Mitte', 'Wesel', '46483', 'key-00000001' from public.customers limit 1;
    `);
  }
  try { await db.exec(readFileSync(`${dir}/${f}`, "utf8")); console.log("applied", f); }
  catch (e) { console.log("FAILED", f, e.message); process.exit(1); }
}
const q = async (sql) => (await db.query(sql)).rows;

// existing data survived and got its device
ok("both guests have a device", (await q("select count(*)::int c from public.customer_devices"))[0].c === 2);
ok("device hashes copied", (await q("select count(*)::int c from public.customer_devices d join public.customers c on c.token_hash=d.token_hash"))[0].c === 2);
ok("old order readable, contact empty", (await q("select contact_name, contact_phone from public.orders"))[0].contact_name === null);
ok("settings row exists", (await q("select accepting_orders, time_zone from public.restaurant_settings"))[0].accepting_orders === true);
ok("existing customers not blocked", (await q("select count(*)::int c from public.customers where is_blocked"))[0].c === 0);

// constraints
const bad = async (sql) => { try { await db.exec(sql); return false; } catch { return true; } };
ok("phone must look like a phone", await bad("update public.orders set contact_phone='abc'"));
ok("good phone accepted", !(await bad("update public.orders set contact_phone='+49 281 12345', contact_name='Max'")));
ok("empty contact name refused", await bad("update public.orders set contact_name='   '"));
ok("settings is a single row", await bad("insert into public.restaurant_settings (id) values (2)"));
ok("closing must be after opening", await bad("insert into public.opening_hours (weekday, opens_at, closes_at) values (1,'20:00','10:00')"));
ok("weekday 8 refused", await bad("insert into public.opening_hours (weekday, opens_at, closes_at) values (8,'10:00','20:00')"));
ok("opening hours accepted", !(await bad("insert into public.opening_hours (weekday, opens_at, closes_at) values (1,'11:00','22:00')")));
ok("vat 7 accepted", !(await bad("update public.products set vat_rate = 7")));
ok("vat 300 refused", await bad("update public.products set vat_rate = 300"));
ok("device token must be a sha-256 hex", await bad("insert into public.customer_devices (customer_id, token_hash) select id, 'x' from public.customers limit 1"));

// shared rate limiter
const hits = [];
for (let i = 0; i < 5; i++) hits.push((await q("select public.rate_limit_hit('login:a@b.c', 3, 60) r"))[0].r);
ok("limiter allows 3 then refuses", JSON.stringify(hits) === JSON.stringify([true, true, true, false, false]));
ok("limiter keys are independent", (await q("select public.rate_limit_hit('login:other', 3, 60) r"))[0].r === true);

// access
ok("anon has no access to rate_limits", (await q("select has_table_privilege('anon','public.rate_limits','select') p"))[0].p === false);
ok("authenticated has no access to devices", (await q("select has_table_privilege('authenticated','public.customer_devices','select') p"))[0].p === false);
ok("service_role can use devices", (await q("select has_table_privilege('service_role','public.customer_devices','insert') p"))[0].p === true);
ok("anon cannot run the limiter", (await q("select has_function_privilege('anon','public.rate_limit_hit(text,integer,integer)','execute') p"))[0].p === false);
ok("RLS on for all new tables", (await q("select count(*)::int c from pg_class where relname in ('customer_devices','restaurant_settings','opening_hours','rate_limits') and relrowsecurity"))[0].c === 4);

// the old flow still works: place_order for an existing guest, no new fields
const cust = (await q("select id from public.customers limit 1"))[0].id;
const r = (await db.query(`select public.place_order(jsonb_build_object('customer_id','${cust}','idempotency_key','abcdefgh-1','payment_method','cod','subtotal_minor',1000,'total_minor',1000,'address',jsonb_build_object('label','Home','line1','x','locality','y','city','Wesel','postal_code','46483'),'items',jsonb_build_array(jsonb_build_object('quantity',1,'unit_price_minor',1000,'line_total_minor',1000,'portion_key','gross','product_name','Margherita','portion_label','Groß')))) as r`)).rows[0].r;
ok("old-style place_order still works", r.created === true);
console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
