import { can } from "@/modules/access/permissions";
import { adminRoute, HttpError, readJson } from "@/modules/catalog/admin/http";
import { uploadRequest } from "@/modules/catalog/admin/schemas";
import { createUpload } from "@/modules/catalog/admin/service";

// Returns a signed URL; the browser uploads the file straight to storage (jpg, png or webp, up to 5 MB), then saves `path`.
export const POST = adminRoute("menu", "view", async ({ actor, principal, req }) => {
  const body = await readJson(req, uploadRequest);
  if (!can(principal, body.kind === "category" ? "categories" : body.kind === "promotion" ? "offers" : "menu", "manage")) throw new HttpError(403, "FORBIDDEN", "You do not have access to this.");
  return createUpload(actor, body.kind, body.content_type);
}, 201);
