// Creates the first super admin. Run once after applying the migrations.
//   node --env-file=.env.local scripts/create-super-admin.mjs "Full Name" email@example.com
// The temporary password goes to .first-super-admin.txt (git-ignored), not to the terminal.
// They must change it at first sign-in.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [fullName, emailArg] = process.argv.slice(2);
if (!fullName || !emailArg) {
  console.error('Usage: node --env-file=.env.local scripts/create-super-admin.mjs "Full Name" email@example.com');
  process.exit(1);
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = emailArg.trim().toLowerCase();

const { count, error: countErr } = await sb.from("staff_users").select("id", { count: "exact", head: true }).eq("role", "super_admin");
if (countErr) throw new Error(countErr.message);
if (count > 0) {
  console.error("A super admin already exists. Manage users from the Users & access screen instead.");
  process.exit(1);
}

const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = Array.from(randomBytes(16), (b) => alphabet[b % alphabet.length]).join("");

const created = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) throw new Error(`Could not create login: ${created.error.message}`);
const id = created.data.user.id;

const profile = await sb.from("staff_users").insert({ id, full_name: fullName.trim(), email, role: "super_admin" });
if (profile.error) {
  await sb.auth.admin.deleteUser(id);
  throw new Error(`Could not create profile: ${profile.error.message}`);
}
await sb.from("audit_log").insert({ actor_id: id, actor_email: email, action: "user_created", target_id: id, target_email: email, details: { role: "super_admin", bootstrap: true } });

writeFileSync(".first-super-admin.txt", `email: ${email}\ntemporary password: ${password}\n(change it at first sign-in, then delete this file)\n`);
console.log(`Super admin created: ${email}`);
console.log("Temporary password saved to backend/.first-super-admin.txt. Change it at first sign-in, then delete that file.");
