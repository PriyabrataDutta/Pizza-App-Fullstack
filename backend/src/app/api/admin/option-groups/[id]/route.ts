import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { groupUpdate } from "@/modules/catalog/admin/schemas";
import { deleteGroup, getGroup, updateGroup } from "@/modules/catalog/admin/service";

type P = { id: string };

export const GET = adminRoute<P>("menu", "view", async ({ params }) => getGroup(params.id));

export const PATCH = adminRoute<P>("menu", "manage", async ({ actor, req, params }) => updateGroup(actor, params.id, await readJson(req, groupUpdate)));

// Only a group that is not used anywhere can be deleted.
export const DELETE = adminRoute<P>("menu", "manage", async ({ actor, params }) => deleteGroup(actor, params.id), 204);
