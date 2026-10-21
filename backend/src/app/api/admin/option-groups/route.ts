import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { groupCreate } from "@/modules/catalog/admin/schemas";
import { createGroup, listGroups } from "@/modules/catalog/admin/service";

export const GET = adminRoute("menu", "view", async () => ({ items: await listGroups() }));

export const POST = adminRoute("menu", "manage", async ({ actor, req }) => createGroup(actor, await readJson(req, groupCreate)), 201);
