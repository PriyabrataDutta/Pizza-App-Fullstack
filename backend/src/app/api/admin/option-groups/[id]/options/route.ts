import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { optionsReplace } from "@/modules/catalog/admin/schemas";
import { replaceOptions } from "@/modules/catalog/admin/service";

// Replaces the whole option list: ids are kept, new options created, omitted ones removed.
export const PUT = adminRoute<{ id: string }>("menu", "manage", async ({ actor, req, params }) => replaceOptions(actor, params.id, (await readJson(req, optionsReplace)).options));
