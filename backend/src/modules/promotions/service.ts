import "server-only";
import { writeAudit } from "@/modules/access/repository";
import { AdminError } from "@/modules/catalog/admin/errors";
import { publicImageUrl, type Actor } from "@/modules/catalog/admin/service";
import { stateOf, toPublic, type PromotionRow } from "./domain";
import { promotions } from "./repository";
import type { PromotionCreate, PromotionUpdate } from "./schemas";

// Use cases for the offer banners. Every change is audited. Banners may be hard-deleted: no order refers to one.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missing = () => new AdminError("NOT_FOUND", "That banner does not exist.");

const audit = (actor: Actor, action: string, targetId: string, details: Record<string, unknown> = {}) =>
  writeAudit({ actorId: actor.id, actorEmail: actor.email, action, targetId, details });

const dto = (p: PromotionRow, now = new Date()) => ({
  id: p.id, title: p.title, detail: p.detail, coupon_code: p.coupon_code, image_path: p.image_path, image_url: publicImageUrl(p.image_path),
  sort_order: p.sort_order, is_active: p.is_active, starts_at: p.starts_at, ends_at: p.ends_at, state: stateOf(p, now),
});

/** What the app shows on Home: the banners that are on, started and not ended, in the restaurant's order. */
export async function publicPromotions(now = new Date()) {
  return { items: toPublic(await promotions.active(), now, publicImageUrl) };
}

export async function listPromotions() {
  const now = new Date();
  return { items: (await promotions.all()).map((p) => dto(p, now)) };
}

export async function createPromotion(actor: Actor, input: PromotionCreate) {
  const row = await promotions.insert({
    title: input.title, detail: input.detail, coupon_code: input.coupon_code, image_path: input.image_path, is_active: input.is_active,
    starts_at: input.starts_at, ends_at: input.ends_at, sort_order: await promotions.nextSort(),
  });
  await audit(actor, "promotion_created", row.id, { title: row.title });
  return dto(row);
}

export async function updatePromotion(actor: Actor, id: string, patch: PromotionUpdate) {
  const current = UUID.test(id) ? await promotions.get(id) : null;
  if (!current) throw missing();
  // The dates are checked together with what is already stored, so changing only one of them cannot make an end before the start.
  const starts = patch.starts_at !== undefined ? patch.starts_at : current.starts_at;
  const ends = patch.ends_at !== undefined ? patch.ends_at : current.ends_at;
  if (starts && ends && new Date(ends).getTime() <= new Date(starts).getTime()) throw new AdminError("VALIDATION_ERROR", "The end must be after the start.");
  const row = await promotions.update(id, patch);
  await audit(actor, "promotion_updated", id, { fields: Object.keys(patch) });
  return dto(row);
}

export async function deletePromotion(actor: Actor, id: string) {
  const current = UUID.test(id) ? await promotions.get(id) : null;
  if (!current) throw missing();
  await promotions.remove(id);
  await audit(actor, "promotion_deleted", id, { title: current.title });
}

export async function reorderPromotions(actor: Actor, ids: string[]) {
  const existing = new Set((await promotions.all()).map((p) => p.id));
  if (ids.length !== existing.size || ids.some((id) => !existing.has(id))) throw new AdminError("VALIDATION_ERROR", "List every banner exactly once.");
  await promotions.setOrder(ids);
  await audit(actor, "promotions_reordered", ids[0], { count: ids.length });
  return listPromotions();
}
