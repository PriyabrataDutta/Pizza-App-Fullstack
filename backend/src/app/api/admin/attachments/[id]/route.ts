import { adminRoute } from "@/modules/catalog/admin/http";
import { deleteAttachment } from "@/modules/catalog/admin/service";

export const DELETE = adminRoute<{ id: string }>("menu", "manage", async ({ actor, params }) => deleteAttachment(actor, params.id), 204);
