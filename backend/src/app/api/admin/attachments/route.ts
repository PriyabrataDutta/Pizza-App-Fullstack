import { AdminError } from "@/modules/catalog/admin/errors";
import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { attachmentSet } from "@/modules/catalog/admin/schemas";
import { getAttachments, setAttachment } from "@/modules/catalog/admin/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/admin/attachments?scope=category|product&target_id=...   The groups that apply to one category or product, with their prices.
export const GET = adminRoute("menu", "view", async ({ req }) => {
  const q = req.nextUrl.searchParams;
  const scope = q.get("scope");
  const target = q.get("target_id") ?? "";
  if ((scope !== "category" && scope !== "product") || !UUID.test(target)) throw new AdminError("VALIDATION_ERROR", "scope (category or product) and target_id are required.");
  return { items: await getAttachments(scope, target) };
});

// Attaches a group to a category or product (or updates it), optionally replacing its whole price grid.
export const PUT = adminRoute("menu", "manage", async ({ actor, req }) => setAttachment(actor, await readJson(req, attachmentSet)));
