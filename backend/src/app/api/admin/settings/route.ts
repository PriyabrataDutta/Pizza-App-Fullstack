import { writeAudit } from "@/modules/access/repository";
import { adminRoute, readJson } from "@/modules/catalog/admin/http";
import { adminRestaurant, updateRestaurant } from "@/modules/settings/http";
import { settingsUpdate } from "@/modules/settings/schemas";

export const GET = adminRoute("settings", "view", async () => adminRestaurant());

// Switch ordering on or off, set the message, preparation time, opening hours. Every change is audited.
export const PATCH = adminRoute("settings", "manage", async ({ actor, req }) => {
  const patch = await readJson(req, settingsUpdate);
  const result = await updateRestaurant(patch);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "settings_changed", details: { fields: Object.keys(patch) } });
  return result;
});
